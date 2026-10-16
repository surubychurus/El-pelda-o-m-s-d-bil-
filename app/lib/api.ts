import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string);

export type Player = { id: string; nickname: string };

const TOKEN_KEY = "manhunt_token";

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

export async function loginWithNickname(nickname: string): Promise<Player> {
  const { token, player } = await request<{ token: string; player: Player }>("/auth/guest", {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
  await setToken(token);
  return player;
}

export const getMe = () => request<Player>("/me");

export const changeNickname = (nickname: string) =>
  request<Player>("/me", { method: "PATCH", body: JSON.stringify({ nickname }) });

export type RoomConfig = {
  mode: "classic" | "teams";
  hunterCount: number;
  hunterPick: "random" | "manual";
  hunterId: string | null;
  durationMin: number;
  waitMin: number;
  radiusM: number;
  alertEveryMin: number;
  alertDurationSec: number;
  onCapture: "eliminated" | "hunter";
};

export type Room = {
  code: string;
  status: "lobby" | "waiting" | "playing" | "finished";
  ownerId: string;
  config: RoomConfig;
  players: Player[];
};

export const createRoom = () => request<Room>("/rooms", { method: "POST" });

export const joinRoom = (code: string) =>
  request<Room>("/rooms/join", { method: "POST", body: JSON.stringify({ code }) });

export const updateConfig = (code: string, config: RoomConfig) =>
  request<Room>(`/rooms/${code}/config`, { method: "PATCH", body: JSON.stringify(config) });

export const leaveRoom = (code: string) => request<{ ok: true }>(`/rooms/${code}/leave`, { method: "POST" });

export const kickPlayer = (code: string, playerId: string) =>
  request<{ ok: true }>(`/rooms/${code}/kick`, { method: "POST", body: JSON.stringify({ playerId }) });
