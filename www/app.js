const LN = window.Capacitor?.Plugins?.LocalNotifications;
const $ = (id) => document.getElementById(id);
const ICONS = { ic_stat_notif: '🔔', ic_stat_star: '⭐', ic_stat_heart: '❤️', ic_stat_check: '✅', ic_stat_alarm: '⏰', ic_stat_gift: '🎁' };
const BTN_KINDS = { normal: 'Normal', snooze: 'Posponer 10 min', input: 'Con texto', silent: 'Sin abrir la app' };

// El estado vive en localStorage: id -> datos de la notificación (para re-registrar botones tras reiniciar)
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem('notifs') || '{}'); } catch { return {}; } },
  set: (v) => localStorage.setItem('notifs', JSON.stringify(v)),
};
let icon = 'ic_stat_notif';

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

function addButtonRow(label = '', kind = 'normal') {
  if ($('buttons').children.length >= 3) return;
  const row = document.createElement('div');
  row.className = 'btnrow';
  row.innerHTML = `<input placeholder="Texto del botón" maxlength="24" value="${label}">
    <select>${Object.entries(BTN_KINDS).map(([k, v]) => `<option value="${k}"${k === kind ? ' selected' : ''}>${v}</option>`).join('')}</select>
    <button type="button" class="ghost">✕</button>`;
  row.querySelector('button').onclick = () => row.remove();
  $('buttons').append(row);
}

function readButtons() {
  return [...$('buttons').children]
    .map((r, i) => ({ id: `${r.querySelector('select').value}_${i}`, title: r.querySelector('input').value.trim(), kind: r.querySelector('select').value }))
    .filter((b) => b.title);
}

async function registerActions(id, buttons) {
  if (!buttons.length) return undefined;
  const typeId = `act_${id}`;
  await LN.registerActionTypes({
    types: [{
      id: typeId,
      actions: buttons.map((b) => ({
        id: b.id, title: b.title,
        input: b.kind === 'input', foreground: b.kind !== 'silent',
      })),
    }],
  });
  return typeId;
}

async function ensureChannel(importance) {
  const id = `canal_${importance}`;
  await LN.createChannel({
    id, name: `Prioridad ${importance}`, importance: Number(importance),
    vibration: importance >= 3, visibility: 1,
  });
  return id;
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

async function buildOne(data, typeId, channelId, date, n, slot, every) {
  const schedule = { at: date, allowWhileIdle: true };
  if (every) schedule.every = every;
  const big = fill(data.bigText, date, n);
  return {
    id: data.group * 100 + slot, title: fill(data.title, date, n), body: fill(data.body, date, n) || ' ',
    largeBody: big || undefined, summaryText: big ? fill(data.title, date, n) : undefined,
    smallIcon: data.icon, iconColor: data.color, channelId,
    ongoing: data.ongoing, autoCancel: !data.ongoing, actionTypeId: typeId, schedule,
  };
}

// Programa (o reprograma) un grupo. Con repetición + placeholders se expanden las próximas ocurrencias.
async function schedule(data) {
  const typeId = await registerActions(data.group, data.buttons);
  const channelId = await ensureChannel(data.importance);
  const start = new Date(data.at);
  const list = [];
  if (data.repeat && hasPlaceholders(data)) {
    data.expand = true;
    let k = 0;
    while (addStep(start, data.repeat, k) <= new Date()) k++;
    for (let i = 0; i < MAX_OCC; i++) list.push(await buildOne(data, typeId, channelId, addStep(start, data.repeat, k + i), k + i + 1, i, null));
  } else {
    list.push(await buildOne(data, typeId, channelId, start, 1, 0, data.repeat || undefined));
  }
  await LN.schedule({ notifications: list });
  const all = store.get(); all[data.group] = data; store.set(all);
}

async function cancelGroup(group) {
  const { notifications } = await LN.getPending();
  const ids = notifications.filter((n) => Math.floor(n.id / 100) === Number(group)).map((n) => ({ id: n.id }));
  if (ids.length) await LN.cancel({ notifications: ids });
}

// Al abrir la app: renueva las ocurrencias de las repetidas con placeholders
async function refreshExpanded() {
  for (const d of Object.values(store.get())) {
    if (!d.expand) continue;
    await cancelGroup(d.group);
    await schedule(d);
  }
}

async function reregisterAll() {
  const all = store.get();
  for (const d of Object.values(all)) await registerActions(d.group, d.buttons);
}

async function refreshList() {
  const { notifications } = await LN.getPending();
  const all = store.get();
  const groups = {};
  for (const n of notifications) (groups[Math.floor(n.id / 100)] ||= []).push(n);
  for (const g of Object.keys(all)) if (!groups[g]) delete all[g];
  store.set(all);
  $('list').innerHTML = Object.keys(groups).length ? '' : '<small>Nada programado.</small>';
  for (const [g, items] of Object.entries(groups)) {
    const d = all[g];
    items.sort((a, b) => new Date(a.schedule?.at || 0) - new Date(b.schedule?.at || 0));
    const next = items[0].schedule?.at ? new Date(items[0].schedule.at) : (d ? new Date(d.at) : null);
    const li = document.createElement('li');
    const when = (next ? next.toLocaleString() : '') + (d?.repeat ? ` · cada ${d.repeat}` : '');
    li.innerHTML = `<div><strong>${ICONS[d?.icon] || '🔔'} ${items[0].title}</strong><small>${when}</small></div><button>Borrar</button>`;
    li.querySelector('button').onclick = async () => { await cancelGroup(g); refreshList(); };
    $('list').append(li);
  }
}

const newGroup = () => Math.floor(Date.now() / 1000) % 20000000;

function formData(atOverride) {
  const at = atOverride || new Date(`${$('date').value}T${$('time').value}`).toISOString();
  return {
    group: newGroup(),
    title: $('title').value.trim(), body: $('body').value.trim(), bigText: $('bigText').value.trim(),
    at, repeat: $('repeat').value || null, importance: $('importance').value,
    icon, color: $('color').value, ongoing: $('ongoing').checked, buttons: readButtons(),
  };
}

async function main() {
  if (!LN) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px">Abre esto dentro de la app Android (Capacitor).</p>'); return; }
  renderIcons(); addButtonRow('Hecho', 'normal'); addButtonRow('Más tarde', 'snooze');
  $('addBtn').onclick = () => addButtonRow();
  const now = new Date(Date.now() + 5 * 60000);
  $('date').value = now.toLocaleDateString('sv'); $('time').value = now.toTimeString().slice(0, 5);

  let perm = await LN.checkPermissions();
  if (perm.display !== 'granted') perm = await LN.requestPermissions();
  await reregisterAll();
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

  LN.addListener('localNotificationActionPerformed', async (ev) => {
    const kind = ev.actionId.split('_')[0];
    const n = ev.notification;
    const d = store.get()[Math.floor(n.id / 100)];
    if (kind === 'snooze' && d) {
      await schedule({ ...d, group: newGroup(), expand: false, at: new Date(Date.now() + 10 * 60000).toISOString(), repeat: null });
      refreshList();
    }
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${n.title}</strong><small>Botón: ${ev.actionId}${ev.inputValue ? ` → "${ev.inputValue}"` : ''} · ${new Date().toLocaleTimeString()}</small></div>`;
    $('log').prepend(li);
  });
  const preview = () => {
    const d = formData(new Date().toISOString());
    $('preview').textContent = hasPlaceholders(d) ? `Vista previa: ${fill(d.title, new Date(), 1)} — ${fill(d.body, new Date(), 1)}` : '';
  };
  ['title', 'body', 'bigText'].forEach((id) => $(id).addEventListener('input', preview));
  refreshList();
}
main();
