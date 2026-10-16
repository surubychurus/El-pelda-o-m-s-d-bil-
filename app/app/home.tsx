import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createRoom } from "../lib/api";
import { useSession } from "../lib/session";
import { Button } from "../lib/ui";

export default function Home() {
  const { player, rename, logout } = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player?.nickname ?? "");
  const [error, setError] = useState("");

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
    <View style={s.container}>
      {editing ? (
        <View style={s.row}>
          <TextInput style={s.input} value={name} onChangeText={setName} maxLength={20} />
          <Pressable style={s.small} onPress={save}>
            <Text style={s.buttonText}>Guardar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={s.hello}>Hola, {player?.nickname}</Text>
          <Text style={s.hint}>Toca para cambiar tu apodo</Text>
        </Pressable>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={{ gap: 12, marginVertical: 24 }}>
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
        <Button title="Unirse con código" secondary onPress={() => router.push("/join")} />
      </View>

      <Pressable
        onPress={async () => {
          await logout();
          router.replace("/nickname");
        }}
      >
        <Text style={s.hint}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: "center" },
  hello: { color: "#fff", fontSize: 28, fontWeight: "700" },
  hint: { color: "#777", fontSize: 14 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "#222", color: "#fff", padding: 12, borderRadius: 10, fontSize: 18 },
  small: { backgroundColor: "#e63946", paddingHorizontal: 16, justifyContent: "center", borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#ff6b6b" },
});
