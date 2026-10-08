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

async function schedule(data) {
  const typeId = await registerActions(data.id, data.buttons);
  const channelId = await ensureChannel(data.importance);
  const schedule = { at: new Date(data.at), allowWhileIdle: true };
  if (data.repeat) schedule.every = data.repeat;
  await LN.schedule({
    notifications: [{
      id: data.id, title: data.title, body: data.body || ' ',
      largeBody: data.bigText || undefined, summaryText: data.bigText ? data.title : undefined,
      smallIcon: data.icon, iconColor: data.color, channelId,
      ongoing: data.ongoing, autoCancel: !data.ongoing,
      actionTypeId: typeId, schedule, extra: { snoozeOf: data.id },
    }],
  });
  const all = store.get(); all[data.id] = data; store.set(all);
}

async function reregisterAll() {
  const all = store.get();
  for (const d of Object.values(all)) await registerActions(d.id, d.buttons);
}

async function refreshList() {
  const { notifications } = await LN.getPending();
  const all = store.get();
  // limpia lo que ya no está pendiente y no se repite
  const pend = new Set(notifications.map((n) => n.id));
  for (const id of Object.keys(all)) if (!pend.has(Number(id))) delete all[id];
  store.set(all);
  $('list').innerHTML = notifications.length ? '' : '<small>Nada programado.</small>';
  for (const n of notifications) {
    const d = all[n.id];
    const li = document.createElement('li');
    const when = d ? new Date(d.at).toLocaleString() + (d.repeat ? ` · cada ${d.repeat}` : '') : '';
    li.innerHTML = `<div><strong>${ICONS[d?.icon] || '🔔'} ${n.title}</strong><small>${when}</small></div><button>Borrar</button>`;
    li.querySelector('button').onclick = async () => { await LN.cancel({ notifications: [{ id: n.id }] }); refreshList(); };
    $('list').append(li);
  }
}

function formData(atOverride) {
  const at = atOverride || new Date(`${$('date').value}T${$('time').value}`).toISOString();
  return {
    id: Math.floor(Date.now() % 2147483000),
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
    const d = store.get()[n.id];
    if (kind === 'snooze' && d) {
      await schedule({ ...d, id: Math.floor(Date.now() % 2147483000), at: new Date(Date.now() + 10 * 60000).toISOString(), repeat: null });
      refreshList();
    }
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${n.title}</strong><small>Botón: ${ev.actionId}${ev.inputValue ? ` → "${ev.inputValue}"` : ''} · ${new Date().toLocaleTimeString()}</small></div>`;
    $('log').prepend(li);
  });
  refreshList();
}
main();
