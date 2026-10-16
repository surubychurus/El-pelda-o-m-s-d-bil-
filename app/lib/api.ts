import Constants from "expo-constants";
import { storage } from "./storage";

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string);

export type Player = { id: string; nickname: string };
export type RoomPlayer = Player & {
  role: "hunter" | "hider" | "spectator" | null;
  state: "alive" | "captured";
};

const TOKEN_KEY = "manhunt_token";

export const getToken = () => storage.get(TOKEN_KEY);
export const setToken = (t: string) => storage.set(TOKEN_KEY, t);
export const clearToken = () => storage.remove(TOKEN_KEY);

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
  players: RoomPlayer[];
  startedAt: string | null;
  originLat: number | null;
  originLng: number | null;
  winner: "hunters" | "hiders" | null;
  alert: { id: string; endsAt: string } | null;
  serverNow: number;
};

export const createRoom = () => request<Room>("/rooms", { method: "POST" });

export const joinRoom = (code: string) =>
  request<Room>("/rooms/join", { method: "POST", body: JSON.stringify({ code }) });

export const updateConfig = (code: string, config: RoomConfig) =>
  request<Room>(`/rooms/${code}/config`, { method: "PATCH", body: JSON.stringify(config) });

export const leaveRoom = (code: string) => request<{ ok: true }>(`/rooms/${code}/leave`, { method: "POST" });

export const kickPlayer = (code: string, playerId: string) =>
  request<{ ok: true }>(`/rooms/${code}/kick`, { method: "POST", body: JSON.stringify({ playerId }) });

export const startGame = (code: string, lat: number, lng: number) =>
  request<{ ok: true }>(`/rooms/${code}/start`, { method: "POST", body: JSON.stringify({ lat, lng }) });

export const sendLocation = (code: string, lat: number, lng: number) =>
  request<{ ok: boolean }>(`/rooms/${code}/location`, { method: "POST", body: JSON.stringify({ lat, lng }) });

export const getMyRoom = () => request<{ code: string; status: Room["status"] } | null>("/me/room");

export type MapPoint = { lat: number; lng: number; hunter: boolean; age: number };

export const launchAlert = (code: string) => request<{ ok: true }>(`/rooms/${code}/alert`, { method: "POST" });

export const getMyQr = (code: string) => request<{ token: string }>(`/rooms/${code}/qr`);

export const getPoints = (code: string) =>
  request<{ alertId: string | null; points: MapPoint[] }>(`/rooms/${code}/points`);

export const capture = (code: string, token: string, lat: number, lng: number) =>
  request<{ ok: true; nickname: string }>(`/rooms/${code}/capture`, {
    method: "POST",
    body: JSON.stringify({ token, lat, lng }),
  });

// El QR lleva el código de sala y el token secreto del jugador
export const qrPayload = (code: string, token: string) => `manhunt:${code}:${token}`;
export function parseQr(data: string): { code: string; token: string } | null {
  const m = /^manhunt:([A-Z]{4}):([A-Za-z0-9]{8,100})$/.exec(data.trim());
  return m ? { code: m[1], token: m[2] } : null;
}
