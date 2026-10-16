import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { Pulse, Reveal } from "../lib/anim";
import { createRoom, getMyRoom } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, textGlow } from "../lib/theme";
import { Button, Card } from "../lib/ui";

export default function Home() {
  const { player, rename, logout } = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player?.nickname ?? "");
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<{ code: string; status: string } | null>(null);

  useEffect(() => {
    getMyRoom().then(setCurrent).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await rename(name.trim());
      setEditing(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <Screen center>
      <Reveal delay={0.1} y={-20}>
        <Text style={[s.title, textGlow(colors.hunter, 20)]}>MANHUNT</Text>
      </Reveal>

      <Reveal delay={0.3}>
        <Card>
          {editing ? (
            <View style={s.row}>
              <TextInput style={s.input} value={name} onChangeText={setName} maxLength={20} />
              <Pressable style={s.save} onPress={save}>
                <Text style={s.saveText}>GUARDAR</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)}>
              <Text style={s.hint}>AGENTE</Text>
              <Text style={s.hello}>{player?.nickname}</Text>
              <Text style={s.hint2}>Toca para cambiar tu apodo</Text>
            </Pressable>
          )}
          {error ? <Text style={s.error}>{error}</Text> : null}
        </Card>
      </Reveal>

      {current ? (
        <Reveal delay={0.45}>
          <Pulse>
            <Button
              title={`Volver a tu partida · ${current.code}`}
              color={colors.hider}
              onPress={() => router.push(current.status === "lobby" ? `/room/${current.code}` : `/game/${current.code}`)}
            />
          </Pulse>
        </Reveal>
      ) : null}

      <Reveal delay={0.55}>
        <Button
          title="Crear sala"
          onPress={async () => {
            try {
              const room = await createRoom();
              router.push(`/room/${room.code}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo crear la sala");
            }
          }}
        />
      </Reveal>
      <Reveal delay={0.7}>
        <Button title="Unirse con código" secondary onPress={() => router.push("/join")} />
      </Reveal>

      <Reveal delay={0.9}>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/nickname");
          }}
        >
          <Text style={s.logout}>Cerrar sesión</Text>
        </Pressable>
      </Reveal>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 40, fontWeight: "900", letterSpacing: 8, textAlign: "center", marginBottom: 12 },
  hint: { color: colors.hunter, fontSize: 11, fontWeight: "800", letterSpacing: 4 },
  hello: { color: colors.text, fontSize: 30, fontWeight: "800", marginVertical: 2 },
  hint2: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", color: colors.text, padding: 12, borderRadius: 10, fontSize: 18 },
  save: { backgroundColor: colors.hunter, paddingHorizontal: 14, justifyContent: "center", borderRadius: 10 },
  saveText: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  error: { color: colors.danger },
  logout: { color: colors.muted, textAlign: "center", marginTop: 8 },
});
