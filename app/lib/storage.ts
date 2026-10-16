// Almacenamiento de la sesión, a prueba de fallos:
//  - Navegador: localStorage (el módulo SecureStore de web está vacío y no tiene funciones).
//  - iOS/Android: almacén seguro del sistema.
//  - Si el módulo nativo no coincide con el JavaScript (por ejemplo, una app compilada antes de actualizar
//    paquetes, o Expo Go), no se rompe la app: se usa memoria y la sesión dura hasta cerrarla.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();
let warned = false;
const warnOnce = (e: unknown) => {
  if (warned) return;
  warned = true;
  console.warn("Almacén seguro no disponible, la sesión no se guardará al cerrar la app:", e);
};

const isWeb = Platform.OS === "web";
const hasLocalStorage = () => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

export const storage = {
  async get(key: string): Promise<string | null> {
    if (isWeb) return hasLocalStorage() ? localStorage.getItem(key) : (memory.get(key) ?? null);
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      warnOnce(e);
      return memory.get(key) ?? null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (hasLocalStorage()) localStorage.setItem(key, value);
      else memory.set(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      warnOnce(e);
      memory.set(key, value);
    }
  },
  async remove(key: string): Promise<void> {
    memory.delete(key);
    if (isWeb) {
      if (hasLocalStorage()) localStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      warnOnce(e);
    }
  },
};
