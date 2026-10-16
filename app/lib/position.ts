// iOS/Android: GPS del móvil
import * as Location from "expo-location";

export type Pos = { lat: number; lng: number };

export async function ensurePermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPos(): Promise<Pos> {
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

export async function watchPos(cb: (p: Pos) => void): Promise<{ remove: () => void }> {
  return Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (p) =>
    cb({ lat: p.coords.latitude, lng: p.coords.longitude }),
  );
}

// El modo prueba solo existe en web; aquí son vacías para que ambos archivos tengan la misma forma
export const getDebugPos = (): Pos | null => null;
export const setDebugPos = (_p: Pos | null) => {};
export const onDebugPos = (_cb: (p: Pos | null) => void) => () => {};
