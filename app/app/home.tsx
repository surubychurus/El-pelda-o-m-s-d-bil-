import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../lib/session";

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

      <Text style={s.soon}>Crear y unirse a salas llega en la fase 1.</Text>

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
  soon: { color: "#aaa", fontSize: 16, marginVertical: 24 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "#222", color: "#fff", padding: 12, borderRadius: 10, fontSize: 18 },
  small: { backgroundColor: "#e63946", paddingHorizontal: 16, justifyContent: "center", borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#ff6b6b" },
});
