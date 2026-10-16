import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { Reveal } from "../lib/anim";
import { joinRoom } from "../lib/api";
import { colors, glow } from "../lib/theme";
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
    <Screen center>
      <Reveal delay={0.1}>
        <Text style={s.label}>CÓDIGO DE LA SALA</Text>
        <TextInput
          style={[s.input, code.length === 4 && glow(colors.hunter, 14)]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z]/g, ""))}
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          placeholder="ABCD"
          placeholderTextColor="#3a3f52"
        />
      </Reveal>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Reveal delay={0.3}>
        <View style={{ gap: 12 }}>
          <Button title={busy ? "Entrando..." : "Entrar"} disabled={busy || code.length !== 4} onPress={submit} />
          <Button title="Atrás" secondary onPress={() => router.back()} />
        </View>
      </Reveal>
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 3, marginBottom: 10, textAlign: "center" },
  input: {
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: 14,
    textAlign: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, textAlign: "center" },
});
