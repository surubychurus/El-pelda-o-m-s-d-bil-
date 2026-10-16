import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { sendLocation } from "./api";
import { storage } from "./storage";

const TASK = "manhunt-location";
const ROOM_KEY = "manhunt_room";

// Se ejecuta aunque la app esté en segundo plano, así que el código de sala se lee del almacén seguro
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations[locations.length - 1];
  const code = await storage.get(ROOM_KEY);
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
  await storage.set(ROOM_KEY, code);
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
  await storage.remove(ROOM_KEY);
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
}

export { distanceMeters } from "./geo";
