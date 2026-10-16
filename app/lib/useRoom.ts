import { useEffect, useRef, useState } from "react";
import { API_URL, getToken, type Room } from "./api";
import { useSession } from "./session";

// Se suscribe a la sala por WebSocket y se reconecta si se corta
export function useRoom(code: string) {
  const { player } = useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [kicked, setKicked] = useState(false);
  // Diferencia entre el reloj del servidor y el del móvil, para que la cuenta atrás sea igual para todos
  const [clockOffset, setClockOffset] = useState(0);
  const closed = useRef(false);

  useEffect(() => {
    closed.current = false;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;

    const connect = async () => {
      const token = await getToken();
      if (closed.current || !token) return;
      ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws?token=${token}`);
      ws.onopen = () => ws?.send(JSON.stringify({ type: "subscribe", code }));
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "room") {
          setRoom(msg.room);
          setClockOffset(msg.room.serverNow - Date.now());
          setError("");
        } else if (msg.type === "kicked" && msg.playerId === player?.id) {
          closed.current = true;
          setKicked(true);
        } else if (msg.type === "error") {
          setError(msg.error);
        }
      };
      ws.onclose = () => {
        if (!closed.current) timer = setTimeout(connect, 2000);
      };
    };
    connect();

    return () => {
      closed.current = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [code, player?.id]);

  return { room, error, kicked, clockOffset };
}
