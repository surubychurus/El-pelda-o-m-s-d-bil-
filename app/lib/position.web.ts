// Navegador: ubicación del navegador, o una posición simulada ("modo prueba") para jugar con un solo móvil
import * as Location from "expo-location";

export type Pos = { lat: number; lng: number };

const KEY = "manhunt_debug_pos";
const listeners = new Set<(p: Pos | null) => void>();

export function getDebugPos(): Pos | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pos) : null;
  } catch {
    return null;
  }
}

export function setDebugPos(p: Pos | null) {
  if (p) localStorage.setItem(KEY, JSON.stringify(p));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l(p));
}

export function onDebugPos(cb: (p: Pos | null) => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export async function ensurePermission() {
  if (getDebugPos()) return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPos(): Promise<Pos> {
  const d = getDebugPos();
  if (d) return d;
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

export async function watchPos(cb: (p: Pos) => void): Promise<{ remove: () => void }> {
  const d = getDebugPos();
  if (d) cb(d);
  const off = onDebugPos((p) => p && cb(p));
  let real: Location.LocationSubscription | undefined;
  let removed = false;
  Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (p) => {
    if (!getDebugPos()) cb({ lat: p.coords.latitude, lng: p.coords.longitude });
  })
    .then((s) => (removed ? s.remove() : (real = s)))
    .catch(() => {});
  return {
    remove: () => {
      removed = true;
      off();
      real?.remove();
    },
  };
}
