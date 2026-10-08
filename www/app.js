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
  row.innerHTML = `<input class="lbl" placeholder="Texto del botón" maxlength="24" value="${label}">
    <select>${Object.entries(BTN_KINDS).map(([k, v]) => `<option value="${k}"${k === kind ? ' selected' : ''}>${v}</option>`).join('')}</select>
    <input class="min" type="number" min="1" max="1440" value="${minutes}" title="minutos">
    <button type="button" class="ghost">✕</button>`;
  const sel = row.querySelector('select'), min = row.querySelector('.min');
  const sync = () => { min.style.display = NEEDS_MIN.has(sel.value) ? '' : 'none'; };
  sel.onchange = sync; sync();
  row.querySelector('button').onclick = () => row.remove();
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
  $('list').innerHTML = Object.keys(groups).length ? '' : '<small>Nada programado.</small>';
  for (const [g, items] of Object.entries(groups)) {
    const d = all[g];
    items.sort((a, b) => a.at - b.at);
    const li = document.createElement('li');
    const extra = [d?.repeat ? `cada ${d.repeat}` : '', d?.image ? '🖼' : '', d?.chrono?.mode === 'up' ? '⏱ cronómetro' : d?.chrono?.mode === 'down' ? `⏳ ${d.chrono.minutes} min` : '', d?.buttons?.length ? `${d.buttons.length} botón(es)` : ''].filter(Boolean).join(' · ');
    li.innerHTML = `<div><strong>${ICONS[items[0].icon] || '🔔'} ${items[0].title}</strong><small>${new Date(items[0].at).toLocaleString()}${extra ? ' · ' + extra : ''}</small></div><button>Borrar</button>`;
    li.querySelector('button').onclick = async () => { await cancelGroup(g); refreshList(); };
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
  li.innerHTML = `<div><strong>${e.title}</strong><small>${e.label}${e.text ? ` → "${e.text}"` : ''} · ${new Date(e.t).toLocaleString()}</small></div>`;
  top ? $('log').prepend(li) : $('log').append(li);
};

async function main() {
  if (!RN || !window.Capacitor?.isNativePlatform?.()) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px">Abre esto dentro de la app Android (Capacitor).</p>'); return; }
  renderIcons(); addButtonRow('Responder', 'reply'); addButtonRow('Leído', 'read');
  $('addBtn').onclick = () => addButtonRow();
  $('whatsapp').onclick = () => { $('buttons').innerHTML = ''; addButtonRow('Responder', 'reply'); addButtonRow('Marcar como leído', 'read'); };
  const now = new Date(Date.now() + 5 * 60000);
  $('date').value = now.toLocaleDateString('sv'); $('time').value = now.toTimeString().slice(0, 5);

  $('chrono').onchange = () => { $('chronoMin').style.display = $('chrono').value === 'down' ? '' : 'none'; };
  $('chrono').onchange();

  $('imageFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = await loadImage(f);
    imageData = url.split(',')[1];
    $('imgPrev').src = url; $('imgBox').style.display = '';
  };
  $('imgClear').onclick = () => { imageData = null; $('imageFile').value = ''; $('imgBox').style.display = 'none'; };

  let perm = await RN.checkPermissions();
  if (perm.display !== 'granted') perm = await RN.requestPermissions();
  await refreshExpanded();

  $('form').onsubmit = async (e) => {
    e.preventDefault();
    const d = formData();
    if (new Date(d.at) <= new Date() && !d.repeat) { alert('Elige una fecha futura'); return; }
    await schedule(d); refreshList();
  };
  $('testNow').onclick = async () => {
    if (!$('title').value.trim()) { alert('Pon un título'); return; }
    await schedule(formData(new Date(Date.now() + 3000).toISOString())); refreshList();
  };
  $('clearLog').onclick = async () => { await RN.clearEvents(); $('log').innerHTML = ''; };

  const preview = () => {
    const d = formData(new Date().toISOString());
    $('preview').textContent = hasPlaceholders(d) ? `Vista previa: ${fill(d.title, new Date(), 1)} — ${fill(d.body, new Date(), 1)}` : '';
  };
  ['title', 'body', 'bigText'].forEach((id) => $(id).addEventListener('input', preview));

  RN.addListener('action', (e) => { addLog(e); refreshList(); });
  const { events } = await RN.getEvents();
  events.forEach((e) => addLog(e, false));
  refreshList();
}
main();
