const RN = window.Capacitor?.registerPlugin?.('RichNotif');
const $ = (id) => document.getElementById(id);
const ICONS = { ic_stat_notif: '🔔', ic_stat_star: '⭐', ic_stat_heart: '❤️', ic_stat_check: '✅', ic_stat_alarm: '⏰', ic_stat_gift: '🎁' };
const BTN_KINDS = {
  read: 'Marcar como leído',
  reply: 'Responder (texto)',
  snooze: 'Posponer…',
  timer: 'Iniciar temporizador…',
  open: 'Abrir la app',
};
const NEEDS_MIN = new Set(['snooze', 'timer']);

// Estado en localStorage: grupo -> datos (para regenerar repeticiones con placeholders)
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem('notifs') || '{}'); } catch { return {}; } },
  set: (v) => localStorage.setItem('notifs', JSON.stringify(v)),
};
let icon = 'ic_stat_notif';
let imageData = null; // base64 jpeg (sin prefijo)

function renderIcons() {
  $('icons').innerHTML = '';
  for (const [name, emoji] of Object.entries(ICONS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = emoji;
    b.className = name === icon ? 'sel' : '';
    b.onclick = () => { icon = name; renderIcons(); };
    $('icons').append(b);
  }
}

function addButtonRow(label = '', kind = 'read', minutes = 10) {
  if ($('buttons').children.length >= 3) return;
  const row = document.createElement('div');
  row.className = 'btnrow';
  row.innerHTML = `<input class="lbl" placeholder="Texto del botón" maxlength="24">
    <div class="sub"><select>${Object.entries(BTN_KINDS).map(([k, v]) => `<option value="${k}"${k === kind ? ' selected' : ''}>${v}</option>`).join('')}</select>
    <input class="min" type="number" min="1" max="1440" value="${minutes}" title="minutos"></div>
    <button type="button" class="del" aria-label="Quitar">✕</button>`;
  row.querySelector('.lbl').value = label;
  const sel = row.querySelector('select'), min = row.querySelector('.min');
  const sync = () => { min.style.display = NEEDS_MIN.has(sel.value) ? '' : 'none'; };
  sel.addEventListener('change', sync); sync();
  row.querySelector('.del').onclick = () => { row.remove(); renderPreview(); };
  $('buttons').append(row);
}

function readButtons() {
  return [...$('buttons').children].map((r) => ({
    title: r.querySelector('.lbl').value.trim(), kind: r.querySelector('select').value,
    minutes: Number(r.querySelector('.min').value) || 10,
  })).filter((b) => b.title);
}

// Reduce la imagen a máx. 1024px JPEG para que la notificación sea ligera
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (x) => String(x).padStart(2, '0');
const MAX_OCC = 30;

// Placeholders: {fecha} {hora} {dia} {mes} {año} {n} {random:a|b|c}
function fill(text, date, n) {
  if (!text) return text;
  return text
    .replace(/\{fecha\}/gi, `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`)
    .replace(/\{hora\}/gi, `${pad(date.getHours())}:${pad(date.getMinutes())}`)
    .replace(/\{dia\}/gi, DIAS[date.getDay()])
    .replace(/\{mes\}/gi, MESES[date.getMonth()])
    .replace(/\{año\}/gi, String(date.getFullYear()))
    .replace(/\{n\}/gi, String(n))
    .replace(/\{random:([^}]+)\}/gi, (_, opts) => { const a = opts.split('|'); return a[Math.floor(Math.random() * a.length)]; });
}
const hasPlaceholders = (d) => /\{[^}]+\}/.test(`${d.title} ${d.body} ${d.bigText}`);

function addStep(start, repeat, k) {
  const d = new Date(start);
  const ms = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3 }[repeat];
  if (ms) return new Date(d.getTime() + ms * k);
  if (repeat === 'month') d.setMonth(d.getMonth() + k); else d.setFullYear(d.getFullYear() + k);
  return d;
}

async function buildOne(data, date, n, slot, every) {
  const big = fill(data.bigText, date, n);
  return {
    id: data.group * 100 + slot, at: date.getTime(), repeat: every || '',
    title: fill(data.title, date, n), body: fill(data.body, date, n), bigText: big,
    importance: Number(data.importance), icon: data.icon, color: data.color, ongoing: data.ongoing,
    image: data.image || '', imageMode: data.imageMode, chrono: data.chrono, buttons: data.buttons,
  };
}

// Programa un grupo. Con repetición + placeholders se expanden las próximas ocurrencias.
async function schedule(data) {
  if (data.imageData) { await RN.saveImage({ name: data.image, data: data.imageData }); delete data.imageData; }
  const start = new Date(data.at);
  const list = [];
  if (data.repeat && hasPlaceholders(data)) {
    data.expand = true;
    let k = 0;
    while (addStep(start, data.repeat, k) <= new Date()) k++;
    for (let i = 0; i < MAX_OCC; i++) list.push(await buildOne(data, addStep(start, data.repeat, k + i), k + i + 1, i, ''));
  } else {
    list.push(await buildOne(data, start, 1, 0, data.repeat || ''));
  }
  await RN.schedule({ notifications: list });
  const all = store.get(); all[data.group] = data; store.set(all);
}

async function cancelGroup(group) {
  const { notifications } = await RN.getPending();
  const ids = notifications.filter((n) => Math.floor(n.id / 100) === Number(group)).map((n) => n.id);
  if (ids.length) await RN.cancel({ ids });
}

// Al abrir la app: renueva las ocurrencias de las repetidas con placeholders
async function refreshExpanded() {
  for (const d of Object.values(store.get())) {
    if (!d.expand) continue;
    await cancelGroup(d.group);
    await schedule(d);
  }
}

async function refreshList() {
  const { notifications } = await RN.getPending();
  const all = store.get();
  const groups = {};
  for (const n of notifications) (groups[Math.floor(n.id / 100)] ||= []).push(n);
  for (const g of Object.keys(all)) if (!groups[g]) delete all[g];
  store.set(all);
  const keys = Object.keys(groups);
  $('count').textContent = keys.length; $('count').hidden = !keys.length;
  $('list').innerHTML = keys.length ? '' : '<div class="empty">Nada programado todavía</div>';
  for (const [g, items] of Object.entries(groups)) {
    const d = all[g];
    items.sort((a, b) => a.at - b.at);
    const extra = [d?.repeat ? `cada ${d.repeat}` : '', d?.image ? '🖼' : '', d?.chrono?.mode === 'up' ? '⏱' : d?.chrono?.mode === 'down' ? `⏳ ${d.chrono.minutes} min` : '', d?.buttons?.length ? `${d.buttons.length} botón(es)` : ''].filter(Boolean).join(' · ');
    const li = document.createElement('li');
    li.innerHTML = `<div class="emoji">${ICONS[items[0].icon] || '🔔'}</div><div class="txt"><strong></strong><small>${new Date(items[0].at).toLocaleString()}${extra ? ' · ' + extra : ''}</small></div><button class="del">Borrar</button>`;
    li.querySelector('strong').textContent = items[0].title;
    li.querySelector('.del').onclick = async () => { await cancelGroup(g); refreshList(); };
    $('list').append(li);
  }
}

const newGroup = () => Math.floor(Date.now() / 1000) % 20000000;

function formData(atOverride) {
  const at = atOverride || new Date(`${$('date').value}T${$('time').value}`).toISOString();
  const mode = $('chrono').value;
  const group = newGroup();
  return {
    group, title: $('title').value.trim(), body: $('body').value.trim(), bigText: $('bigText').value.trim(),
    at, repeat: $('repeat').value || null, importance: $('importance').value,
    icon, color: $('color').value, ongoing: $('ongoing').checked, buttons: readButtons(),
    image: imageData ? `img_${group}.jpg` : '', imageData, imageMode: $('imageMode').value,
    chrono: { mode, minutes: Number($('chronoMin').value) || 5 },
  };
}

const addLog = (e, top = true) => {
  const li = document.createElement('li');
  li.innerHTML = '<div class="emoji">✅</div><div class="txt"><strong></strong><small></small></div>';
  li.querySelector('strong').textContent = e.title;
  li.querySelector('small').textContent = `${e.label}${e.text ? ` → "${e.text}"` : ''} · ${new Date(e.t).toLocaleString()}`;
  top ? $('log').prepend(li) : $('log').append(li);
};

function showError(msg) {
  const b = $('banner');
  b.hidden = false; b.textContent = (b.textContent ? b.textContent + '\n' : '') + msg;
}
window.addEventListener('error', (e) => showError('Error: ' + e.message));
window.addEventListener('unhandledrejection', (e) => showError('Error: ' + (e.reason?.message || e.reason)));

function renderPreview() {
  const now = new Date();
  const d = formData(now.toISOString());
  $('pvIcon').textContent = ICONS[d.icon] || '🔔'; $('pvIcon').style.background = d.color;
  $('pvTitle').textContent = fill(d.title, now, 1) || 'Título';
  $('pvBody').textContent = fill(d.body, now, 1) || 'El texto aparecerá aquí';
  const img = $('pvImg');
  img.hidden = !(imageData && d.imageMode === 'big'); if (imageData) img.src = $('imgPrev').src;
  $('pvChrono').textContent = d.chrono.mode === 'up' ? '00:00' : d.chrono.mode === 'down' ? `${String(d.chrono.minutes).padStart(2, '0')}:00` : '';
  $('pvActions').innerHTML = '';
  for (const b of d.buttons) { const s = document.createElement('span'); s.textContent = b.title; $('pvActions').append(s); }
}

function setTab(name) {
  for (const v of ['crear', 'lista', 'log']) $(`view-${v}`).hidden = v !== name;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('actionbar').hidden = name !== 'crear';
  document.body.classList.toggle('no-bar', name !== 'crear');
  if (name === 'lista') refreshList().catch((e) => showError(e.message));
  window.scrollTo(0, 0);
}

function setPerm(state) {
  const p = $('permPill');
  p.textContent = state === 'granted' ? '🔔 Permiso OK' : '🔕 Sin permiso';
  p.className = 'pill ' + (state === 'granted' ? 'ok' : 'bad');
  p.onclick = async () => { try { setPerm((await RN.requestPermissions()).display); } catch (e) { showError(e.message); } };
}

async function main() {
  document.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });
  renderIcons(); addButtonRow('Responder', 'reply'); addButtonRow('Leído', 'read');
  $('addBtn').onclick = () => { addButtonRow(); renderPreview(); };
  $('whatsapp').onclick = () => { $('buttons').innerHTML = ''; addButtonRow('Responder', 'reply'); addButtonRow('Marcar como leído', 'read'); renderPreview(); };
  const now = new Date(Date.now() + 5 * 60000);
  $('date').value = now.toLocaleDateString('sv'); $('time').value = now.toTimeString().slice(0, 5);

  // variables: se insertan en el último campo de texto usado
  let lastField = $('title');
  ['title', 'body', 'bigText'].forEach((id) => $(id).addEventListener('focus', () => { lastField = $(id); }));
  document.querySelectorAll('#vars button').forEach((b) => {
    b.onclick = () => {
      const f = lastField, i = f.selectionStart ?? f.value.length;
      f.value = f.value.slice(0, i) + b.dataset.v + f.value.slice(f.selectionEnd ?? i);
      f.focus(); f.selectionStart = f.selectionEnd = i + b.dataset.v.length; renderPreview();
    };
  });

  $('chrono').onchange = () => { $('chronoWrap').style.display = $('chrono').value === 'down' ? '' : 'none'; renderPreview(); };
  $('chrono').onchange();
  $('imageFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const url = await loadImage(f);
      imageData = url.split(',')[1];
      $('imgPrev').src = url; $('imgBox').hidden = false; renderPreview();
    } catch (err) { showError('No se pudo leer la imagen'); }
  };
  $('imgClear').onclick = () => { imageData = null; $('imageFile').value = ''; $('imgBox').hidden = true; renderPreview(); };
  $('form').addEventListener('input', renderPreview);
  $('form').addEventListener('change', renderPreview);
  renderPreview();

  if (!RN || !window.Capacitor?.isNativePlatform?.()) {
    showError('Esta pantalla solo funciona dentro de la app Android (Capacitor).');
    return;
  }

  // Los botones se enlazan ANTES de pedir permisos para que nunca queden muertos
  $('form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = formData();
      if (new Date(d.at) <= new Date() && !d.repeat) { alert('Elige una fecha futura'); return; }
      await schedule(d); await refreshList(); setTab('lista');
    } catch (err) { showError('No se pudo programar: ' + (err.message || err)); }
  };
  $('testNow').onclick = async () => {
    try {
      if (!$('title').value.trim()) { alert('Pon un título'); return; }
      await schedule(formData(new Date(Date.now() + 3000).toISOString())); await refreshList();
    } catch (err) { showError('No se pudo enviar: ' + (err.message || err)); }
  };
  $('clearLog').onclick = async () => { try { await RN.clearEvents(); $('log').innerHTML = ''; } catch (err) { showError(err.message); } };

  try {
    let perm = await RN.checkPermissions();
    if (perm.display !== 'granted') perm = await RN.requestPermissions();
    setPerm(perm.display);
  } catch (err) { setPerm('denied'); showError('Permisos: ' + (err.message || err)); }

  try { await refreshExpanded(); } catch (err) { showError('Repeticiones: ' + (err.message || err)); }
  try {
    RN.addListener('action', (e) => { addLog(e); refreshList(); });
    const { events } = await RN.getEvents();
    events.forEach((e) => addLog(e, false));
    await refreshList();
  } catch (err) { showError('Plugin: ' + (err.message || err)); }
}
main().catch((e) => showError('Error al iniciar: ' + (e.message || e)));
