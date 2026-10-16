import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { sendLocation } from "./api";

const TASK = "manhunt-location";
const ROOM_KEY = "manhunt_room";

// Se ejecuta aunque la app esté en segundo plano, así que el código de sala se lee del almacén seguro
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations[locations.length - 1];
  const code = await SecureStore.getItemAsync(ROOM_KEY);
  if (!last || !code) return;
  try {
    await sendLocation(code, last.coords.latitude, last.coords.longitude);
  } catch {
    // Sin red: se reintenta con la siguiente lectura
  }
});

export async function ensureForegroundPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

// Devuelve true si el seguimiento en segundo plano quedó activo
export async function startTracking(code: string) {
  if (!(await ensureForegroundPermission())) return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  await SecureStore.setItemAsync(ROOM_KEY, code);
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return bg.status === "granted";
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15_000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Manhunt en curso",
      notificationBody: "Compartiendo tu ubicación durante la partida",
    },
  });
  return bg.status === "granted";
}

export async function stopTracking() {
  await SecureStore.deleteItemAsync(ROOM_KEY);
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
