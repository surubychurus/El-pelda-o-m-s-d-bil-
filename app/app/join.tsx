import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { joinRoom } from "../lib/api";
import { Button } from "../lib/ui";

export default function Join() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const room = await joinRoom(code);
      router.replace(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>Código de la sala</Text>
      <TextInput
        style={s.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z]/g, ""))}
        maxLength={4}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        placeholder="ABCD"
        placeholderTextColor="#555"
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title={busy ? "Entrando..." : "Entrar"} disabled={busy || code.length !== 4} onPress={submit} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: "center" },
  label: { color: "#aaa", fontSize: 16 },
  input: { backgroundColor: "#222", color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: 12, textAlign: "center", padding: 16, borderRadius: 12 },
  error: { color: "#ff6b6b" },
});
