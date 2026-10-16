import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { RoleReveal } from "../../components/RoleReveal";
import { Screen } from "../../components/Screen";
import { Pop, Reveal } from "../../lib/anim";
import { leaveRoom } from "../../lib/api";
import { useSession } from "../../lib/session";
import { colors, textGlow } from "../../lib/theme";
import { distanceMeters, startTracking, stopTracking } from "../../lib/tracking";
import { Button, Card, Heading } from "../../lib/ui";
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
  const [revealed, setRevealed] = useState(false);

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
      <Screen center>
        <Text style={s.muted}>Conectando...</Text>
      </Screen>
    );
  }

  const me = room.players.find((p) => p.id === player?.id);
  const serverNow = now + clockOffset;
  const start = new Date(room.startedAt).getTime();
  const waitEnd = start + room.config.waitMin * 60_000;
  const gameEnd = waitEnd + room.config.durationMin * 60_000;
  const isHunter = me?.role === "hunter";
  const accent = isHunter ? colors.hunter : colors.hider;
  const outside = dist != null && dist > room.config.radiusM;
  const hunters = room.players.filter((p) => p.role === "hunter");
  const phaseMs = room.status === "waiting" ? waitEnd - serverNow : gameEnd - serverNow;
  const phaseTotal = room.status === "waiting" ? room.config.waitMin * 60_000 : room.config.durationMin * 60_000;
  const progress = Math.min(1, Math.max(0, 1 - phaseMs / phaseTotal));

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
    <View style={{ flex: 1 }}>
      {/* El 3D se congela durante la partida para ahorrar batería */}
      <Screen scroll accent={accent} paused={room.status === "playing"}>
        <Reveal delay={0.1}>
          <Text style={[s.role, textGlow(accent, 16), { color: accent }]}>
            {me?.role === "spectator" ? "ESPECTADOR" : isHunter ? "CAZADOR" : "ESCONDIDO"}
          </Text>
        </Reveal>

        {active && (
          <>
            <Text style={s.phase}>{room.status === "waiting" ? "ESPERA · SALEN LOS CAZADORES EN" : "TIEMPO DE PARTIDA"}</Text>
            <Pop trigger={Math.ceil(phaseMs / 1000)}>
              <Text style={[s.big, textGlow(accent, 22)]}>{fmt(phaseMs)}</Text>
            </Pop>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
            </View>
            <Text style={s.text}>
              {room.status === "waiting"
                ? isHunter
                  ? "Los escondidos se están escondiendo. Quédate en el punto de inicio."
                  : "¡Escóndete! Los cazadores salen cuando acabe la cuenta atrás."
                : isHunter
                  ? "Encuentra a los escondidos y escanea su QR."
                  : "Que no te encuentren."}
            </Text>
          </>
        )}

        {room.status === "finished" && (
          <Reveal delay={0.2}>
            <Text style={[s.big, textGlow(room.winner === "hunters" ? colors.hunter : colors.hider, 26), { fontSize: 38 }]}>
              {room.winner === "hunters" ? "GANAN LOS CAZADORES" : "GANAN LOS ESCONDIDOS"}
            </Text>
            <View style={{ height: 16 }} />
            <Button
              title="Volver al inicio"
              onPress={async () => {
                await leaveRoom(code).catch(() => {});
                router.replace("/home");
              }}
            />
          </Reveal>
        )}

        {active && outside && (
          <View style={s.warn}>
            <Text style={s.warnText}>
              ⚠️ Fuera de la zona de juego ({Math.round(dist!)} m del centro, radio {room.config.radiusM} m). Vuelve.
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

        <Heading>Cazadores</Heading>
        <Card>
          <Text style={s.hunters}>{hunters.map((h) => h.nickname).join("  ·  ") || "—"}</Text>
        </Card>

        {active && <Button title="Salir de la partida" secondary onPress={leave} />}
      </Screen>

      {!revealed && room.status === "waiting" && me?.role && me.role !== "spectator" && (
        <RoleReveal role={me.role} onDone={() => setRevealed(true)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  role: { fontSize: 22, fontWeight: "900", letterSpacing: 8, textAlign: "center" },
  phase: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 3, textAlign: "center", marginTop: 10 },
  big: { color: colors.text, fontSize: 76, fontWeight: "900", textAlign: "center", letterSpacing: 2 },
  bar: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 6 },
  barFill: { height: 4 },
  text: { color: colors.text, fontSize: 15, textAlign: "center", opacity: 0.85 },
  muted: { color: colors.muted, fontSize: 13, textAlign: "center" },
  warn: { backgroundColor: "rgba(255,46,77,0.16)", borderWidth: 1, borderColor: "rgba(255,46,77,0.5)", padding: 14, borderRadius: 12 },
  warnText: { color: "#ffb4b4", fontSize: 14 },
  hunters: { color: colors.hunter, fontSize: 17, fontWeight: "800", textAlign: "center" },
});
