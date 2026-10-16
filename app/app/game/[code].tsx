import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { leaveRoom } from "../../lib/api";
import { useSession } from "../../lib/session";
import { distanceMeters, startTracking, stopTracking } from "../../lib/tracking";
import { Button } from "../../lib/ui";
import { useRoom } from "../../lib/useRoom";

const fmt = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, "0")}`;
};

export default function Game() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { player } = useSession();
  const { room, clockOffset } = useRoom(code);
  const [now, setNow] = useState(Date.now());
  const [dist, setDist] = useState<number | null>(null);
  const [bgOk, setBgOk] = useState(true);

  const active = room?.status === "waiting" || room?.status === "playing";

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Envío de ubicación (también en segundo plano) mientras dura la partida
  useEffect(() => {
    if (!active) return;
    startTracking(code).then(setBgOk);
    return () => {
      stopTracking();
    };
  }, [active, code]);

  // Distancia al punto de inicio, para avisar si te sales del radio
  useEffect(() => {
    if (!active || room?.originLat == null || room.originLng == null) return;
    const { originLat, originLng } = room;
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (pos) =>
      setDist(distanceMeters(pos.coords.latitude, pos.coords.longitude, originLat, originLng)),
    ).then((s) => (cancelled ? s.remove() : (sub = s)));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active, room?.originLat, room?.originLng]);

  if (!room || !room.startedAt) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Conectando...</Text>
      </View>
    );
  }

  const me = room.players.find((p) => p.id === player?.id);
  const serverNow = now + clockOffset;
  const start = new Date(room.startedAt).getTime();
  const waitEnd = start + room.config.waitMin * 60_000;
  const gameEnd = waitEnd + room.config.durationMin * 60_000;
  const isHunter = me?.role === "hunter";
  const outside = dist != null && dist > room.config.radiusM;
  const hunters = room.players.filter((p) => p.role === "hunter");

  const leave = () =>
    Alert.alert("¿Salir de la partida?", "Pasarás a ser espectador y no podrás volver a jugar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await stopTracking();
          await leaveRoom(code).catch(() => {});
          router.replace("/home");
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Stack.Screen options={{ title: `Partida ${room.code}`, headerBackVisible: false }} />

      <Text style={[s.role, isHunter ? s.hunter : s.hider]}>
        {me?.role === "spectator" ? "👀 Espectador" : isHunter ? "🎯 Eres cazador" : "🙈 Eres escondido"}
      </Text>

      {room.status === "waiting" && (
        <>
          <Text style={s.big}>{fmt(waitEnd - serverNow)}</Text>
          <Text style={s.text}>
            {isHunter
              ? "Los escondidos se están escondiendo. Quédate en el punto de inicio hasta que acabe la cuenta atrás."
              : "¡Escóndete! Los cazadores salen cuando acabe la cuenta atrás."}
          </Text>
        </>
      )}

      {room.status === "playing" && (
        <>
          <Text style={s.big}>{fmt(gameEnd - serverNow)}</Text>
          <Text style={s.text}>Tiempo restante de partida.</Text>
        </>
      )}

      {room.status === "finished" && (
        <>
          <Text style={s.big}>{room.winner === "hunters" ? "Ganan los cazadores" : "Ganan los escondidos"}</Text>
          <Text style={s.text}>Fin de la partida.</Text>
          <Button
            title="Volver al inicio"
            onPress={async () => {
              await leaveRoom(code).catch(() => {});
              router.replace("/home");
            }}
          />
        </>
      )}

      {active && outside && (
        <View style={s.warn}>
          <Text style={s.warnText}>
            ⚠️ Te has salido de la zona de juego ({Math.round(dist!)} m del centro, radio {room.config.radiusM} m). Vuelve.
          </Text>
        </View>
      )}
      {active && dist != null && !outside && (
        <Text style={s.muted}>
          A {Math.round(dist)} m del centro · radio {room.config.radiusM} m
        </Text>
      )}
      {active && !bgOk && (
        <View style={s.warn}>
          <Text style={s.warnText}>
            Sin permiso de ubicación "siempre", tu posición solo se comparte con la app abierta. Actívalo en los ajustes del móvil.
          </Text>
        </View>
      )}

      <Text style={s.h2}>Cazadores</Text>
      <Text style={s.text}>{hunters.map((h) => h.nickname).join(", ") || "—"}</Text>

      {active && <Button title="Salir de la partida" secondary onPress={leave} />}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 24, gap: 16, alignItems: "stretch" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  role: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  hunter: { color: "#e63946" },
  hider: { color: "#4cc9f0" },
  big: { color: "#fff", fontSize: 56, fontWeight: "900", textAlign: "center", marginVertical: 8 },
  text: { color: "#ccc", fontSize: 16, textAlign: "center" },
  h2: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 8 },
  muted: { color: "#888", fontSize: 14, textAlign: "center" },
  warn: { backgroundColor: "#4a1d1d", padding: 14, borderRadius: 10 },
  warnText: { color: "#ffb4b4", fontSize: 15 },
});
