import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Reveal } from "../../lib/anim";
import { kickPlayer, leaveRoom, startGame, updateConfig, type RoomConfig } from "../../lib/api";
import { useSession } from "../../lib/session";
import { ensureForegroundPermission } from "../../lib/tracking";
import { colors, glow } from "../../lib/theme";
import { Button, Card, Choice, Heading, Stepper } from "../../lib/ui";
import { useRoom } from "../../lib/useRoom";

export default function Lobby() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { player } = useSession();
  const { room, error, kicked } = useRoom(code);
  const [config, setConfig] = useState<RoomConfig | null>(null);
  const [saveError, setSaveError] = useState("");

  const isOwner = !!room && room.ownerId === player?.id;

  // El servidor es la fuente de verdad; la copia local permite que los botones respondan al instante
  useEffect(() => {
    if (room) setConfig(room.config);
  }, [room]);

  // Cuando el creador empieza, todos pasan a la pantalla de partida
  useEffect(() => {
    if (room && room.status !== "lobby") router.replace(`/game/${code}`);
  }, [room, code, router]);

  const start = async () => {
    try {
      if (!(await ensureForegroundPermission())) {
        setSaveError("Necesito permiso de ubicación para fijar el punto de inicio");
        return;
      }
      // El punto de inicio es donde está el creador al empezar
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await startGame(code, pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo empezar");
    }
  };

  useEffect(() => {
    if (kicked) {
      Alert.alert("Te han expulsado de la sala");
      router.replace("/home");
    }
  }, [kicked, router]);

  const change = async (patch: Partial<RoomConfig>) => {
    if (!config) return;
    const next = { ...config, ...patch };
    setConfig(next);
    try {
      await updateConfig(code, next);
      setSaveError("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar");
      if (room) setConfig(room.config);
    }
  };

  const leave = async () => {
    try {
      await leaveRoom(code);
    } finally {
      router.replace("/home");
    }
  };

  if (!room || !config) {
    return (
      <Screen center>
        <Text style={s.muted}>{error || "Conectando..."}</Text>
        {error ? <Button title="Volver" secondary onPress={() => router.replace("/home")} /> : null}
      </Screen>
    );
  }

  const ro = !isOwner;
  const manual = config.mode === "classic" && config.hunterPick === "manual";

  return (
    <Screen scroll>
      <Pressable onPress={() => Share.share({ message: `Únete a mi partida de Manhunt con el código ${room.code}` })}>
        <Text style={s.small}>CÓDIGO DE SALA</Text>
        <View style={s.codeRow}>
          {room.code.split("").map((ch, i) => (
            <Reveal key={i} delay={0.1 + i * 0.12} y={-40} style={[s.tile, glow(colors.hunter, 14)]}>
              <Text style={s.tileText}>{ch}</Text>
            </Reveal>
          ))}
        </View>
        <Text style={[s.muted, { textAlign: "center" }]}>Toca para compartir</Text>
      </Pressable>

      <Heading>{`Jugadores · ${room.players.length}`}</Heading>
      <Card>
        {room.players.map((p, i) => {
          const isHunter = manual && config.hunterId === p.id;
          return (
            <Reveal key={p.id} delay={0.3 + i * 0.07} y={16}>
              <View style={s.playerRow}>
                <Pressable style={{ flex: 1 }} disabled={ro || !manual} onPress={() => change({ hunterId: isHunter ? null : p.id })}>
                  <Text style={[s.player, isHunter && { color: colors.hunter }]}>
                    {p.id === room.ownerId ? "👑 " : ""}
                    {isHunter ? "🎯 " : ""}
                    {p.nickname}
                    {p.id === player?.id ? "  (tú)" : ""}
                  </Text>
                </Pressable>
                {isOwner && p.id !== player?.id ? (
                  <Pressable onPress={() => kickPlayer(code, p.id)}>
                    <Text style={s.kick}>EXPULSAR</Text>
                  </Pressable>
                ) : null}
              </View>
            </Reveal>
          );
        })}
      </Card>

      <Heading>{ro ? "Configuración · la define el creador" : "Configuración"}</Heading>
      <Reveal delay={0.5}>
        <Card>
          <Choice
            label="Modo"
            value={config.mode}
            disabled={ro}
            options={[
              { value: "classic", label: "Clásico" },
              { value: "teams", label: "Equipos" },
            ]}
            onChange={(mode) => change({ mode })}
          />
          {config.mode === "classic" ? (
            <>
              <Choice
                label="Cazador"
                value={config.hunterPick}
                disabled={ro}
                options={[
                  { value: "random", label: "Al azar" },
                  { value: "manual", label: "Elijo yo" },
                ]}
                onChange={(hunterPick) => change({ hunterPick, hunterId: null })}
              />
              {config.hunterPick === "manual" ? (
                <Text style={s.muted}>
                  {isOwner ? "Toca a un jugador de la lista para elegirlo." : "El creador elige al cazador."}
                </Text>
              ) : null}
            </>
          ) : (
            <Stepper label="Nº de cazadores" value={config.hunterCount} min={1} max={10} disabled={ro} onChange={(hunterCount) => change({ hunterCount })} />
          )}
          <Stepper label="Duración" value={config.durationMin} unit="min" step={5} min={5} max={480} disabled={ro} onChange={(durationMin) => change({ durationMin })} />
          <Stepper label="Espera" value={config.waitMin} unit="min" min={0} max={60} disabled={ro} onChange={(waitMin) => change({ waitMin })} />
          <Stepper label="Radio de juego" value={config.radiusM} unit="m" step={50} min={50} max={5000} disabled={ro} onChange={(radiusM) => change({ radiusM })} />
          <Stepper label="Alerta cada" value={config.alertEveryMin} unit="min" min={1} max={120} disabled={ro} onChange={(alertEveryMin) => change({ alertEveryMin })} />
          <Stepper label="Alerta dura" value={config.alertDurationSec} unit="s" step={10} min={10} max={300} disabled={ro} onChange={(alertDurationSec) => change({ alertDurationSec })} />
          <Choice
            label="Al ser capturado"
            value={config.onCapture}
            disabled={ro}
            options={[
              { value: "eliminated", label: "Eliminado" },
              { value: "hunter", label: "Cazador" },
            ]}
            onChange={(onCapture) => change({ onCapture })}
          />
        </Card>
      </Reveal>
      {saveError ? <Text style={s.error}>{saveError}</Text> : null}

      {isOwner ? <Button title="Empezar partida aquí" onPress={start} /> : <Text style={[s.muted, { textAlign: "center" }]}>Esperando a que el creador empiece...</Text>}
      <Button title="Salir de la sala" secondary onPress={leave} />
    </Screen>
  );
}

const s = StyleSheet.create({
  small: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 4, textAlign: "center", marginBottom: 10 },
  codeRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 8 },
  tile: {
    width: 66,
    height: 84,
    borderRadius: 14,
    backgroundColor: "rgba(255,46,77,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { color: colors.text, fontSize: 46, fontWeight: "900" },
  playerRow: { flexDirection: "row", alignItems: "center", minHeight: 42 },
  player: { color: colors.text, fontSize: 17, fontWeight: "600" },
  kick: { color: colors.danger, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
});
