import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View, Pressable } from "react-native";
import * as Location from "expo-location";
import { kickPlayer, leaveRoom, startGame, updateConfig, type RoomConfig } from "../../lib/api";
import { ensureForegroundPermission } from "../../lib/tracking";
import { useSession } from "../../lib/session";
import { Button, Choice, Stepper } from "../../lib/ui";
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
      <View style={s.center}>
        <Text style={s.muted}>{error || "Conectando..."}</Text>
        {error ? <Button title="Volver" secondary onPress={() => router.replace("/home")} /> : null}
      </View>
    );
  }

  const ro = !isOwner;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Stack.Screen options={{ title: `Sala ${room.code}`, headerBackVisible: false }} />

      <Pressable onPress={() => Share.share({ message: `Únete a mi partida de Manhunt con el código ${room.code}` })}>
        <Text style={s.code}>{room.code}</Text>
        <Text style={[s.muted, { textAlign: "center" }]}>Toca para compartir el código</Text>
      </Pressable>

      <Text style={s.h2}>Jugadores ({room.players.length})</Text>
      <View style={s.card}>
        {room.players.map((p) => {
          const isHunter = config.mode === "classic" && config.hunterPick === "manual" && config.hunterId === p.id;
          return (
            <View key={p.id} style={s.playerRow}>
              <Pressable
                style={{ flex: 1 }}
                disabled={ro || config.mode !== "classic" || config.hunterPick !== "manual"}
                onPress={() => change({ hunterId: isHunter ? null : p.id })}
              >
                <Text style={s.player}>
                  {p.id === room.ownerId ? "👑 " : ""}
                  {isHunter ? "🎯 " : ""}
                  {p.nickname}
                  {p.id === player?.id ? " (tú)" : ""}
                </Text>
              </Pressable>
              {isOwner && p.id !== player?.id ? (
                <Pressable onPress={() => kickPlayer(code, p.id)}>
                  <Text style={s.kick}>Expulsar</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={s.h2}>Configuración {ro ? "(la define el creador)" : ""}</Text>
      <View style={s.card}>
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
      </View>
      {saveError ? <Text style={s.error}>{saveError}</Text> : null}

      {isOwner ? <Button title="Empezar partida aquí" onPress={start} /> : <Text style={s.muted}>Esperando a que el creador empiece...</Text>}
      <Button title="Salir de la sala" secondary onPress={leave} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  center: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  code: { color: "#fff", fontSize: 64, fontWeight: "900", letterSpacing: 10, textAlign: "center" },
  h2: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: "#1c1c1c", borderRadius: 12, padding: 14, gap: 4 },
  playerRow: { flexDirection: "row", alignItems: "center", minHeight: 40 },
  player: { color: "#fff", fontSize: 17 },
  kick: { color: "#ff6b6b", fontSize: 13 },
  muted: { color: "#888", fontSize: 14 },
  error: { color: "#ff6b6b" },
});
