// Navegador: envía la posición mientras la pestaña esté abierta (no hay ubicación en segundo plano en web)
import { sendLocation } from "./api";
import { getCurrentPos, watchPos, ensurePermission, type Pos } from "./position";

export { distanceMeters } from "./geo";

export async function ensureForegroundPermission() {
  return ensurePermission();
}

let stop: (() => void) | null = null;

export async function startTracking(code: string) {
  stopTrackingSync();
  if (!(await ensurePermission())) return false;
  let last: Pos | null = null;
  let lastSent = 0;
  const send = (p: Pos) => {
    last = p;
    lastSent = Date.now();
    sendLocation(code, p.lat, p.lng).catch(() => {});
  };
  const sub = await watchPos((p) => {
    last = p;
    if (Date.now() - lastSent > 4000) send(p);
  });
  getCurrentPos().then(send).catch(() => {});
  // Reenvía cada 15 s aunque no te muevas, para que tu punto no se considere antiguo
  const timer = setInterval(() => last && send(last), 15_000);
  stop = () => {
    sub.remove();
    clearInterval(timer);
  };
  return true; // en web no hay "ubicación en segundo plano": el aviso se muestra aparte
}

function stopTrackingSync() {
  stop?.();
  stop = null;
}

export async function stopTracking() {
  stopTrackingSync();
}
