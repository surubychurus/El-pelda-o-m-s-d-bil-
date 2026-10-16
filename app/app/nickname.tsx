import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { Reveal } from "../lib/anim";
import { useSession } from "../lib/session";
import { colors, textGlow } from "../lib/theme";
import { Button } from "../lib/ui";

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
    <Screen center>
      <Reveal delay={0.2} y={-30}>
        <Text style={[s.title, textGlow(colors.hunter, 24)]}>MANHUNT</Text>
        <Text style={s.tag}>CAZA EN LA VIDA REAL</Text>
      </Reveal>
      <View style={{ height: 36 }} />
      <Reveal delay={0.6}>
        <Text style={s.label}>¿CÓMO TE LLAMAN?</Text>
        <TextInput
          style={s.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Tu apodo"
          placeholderTextColor="#555b6e"
          maxLength={20}
        />
      </Reveal>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Reveal delay={0.8}>
        <Button title={busy ? "Entrando..." : "Entrar"} disabled={busy || nickname.trim().length < 2} onPress={submit} />
      </Reveal>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 52, fontWeight: "900", letterSpacing: 8, textAlign: "center" },
  tag: { color: colors.hunter, fontSize: 12, fontWeight: "800", letterSpacing: 6, textAlign: "center", marginTop: 4 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 3, marginBottom: 8 },
  input: {
    backgroundColor: colors.panel,
    color: colors.text,
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger },
});
