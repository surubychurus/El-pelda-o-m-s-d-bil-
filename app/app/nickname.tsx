import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../lib/session";

export default function Nickname() {
  const { login } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await login(nickname.trim());
      router.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Manhunt</Text>
      <Text style={s.label}>¿Cómo te llamas?</Text>
      <TextInput
        style={s.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="Tu apodo"
        placeholderTextColor="#777"
        maxLength={20}
        autoFocus
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable
        style={[s.button, (busy || nickname.trim().length < 2) && s.disabled]}
        disabled={busy || nickname.trim().length < 2}
        onPress={submit}
      >
        <Text style={s.buttonText}>{busy ? "Entrando..." : "Entrar"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { color: "#fff", fontSize: 40, fontWeight: "800", marginBottom: 24 },
  label: { color: "#aaa", fontSize: 16 },
  input: { backgroundColor: "#222", color: "#fff", padding: 14, borderRadius: 10, fontSize: 18 },
  error: { color: "#ff6b6b" },
  button: { backgroundColor: "#e63946", padding: 16, borderRadius: 10, alignItems: "center" },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
