import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { QrCode } from "../../components/QrCode";
import { Screen } from "../../components/Screen";
import { Reveal } from "../../lib/anim";
import { getMyQr, qrPayload } from "../../lib/api";
import { colors } from "../../lib/theme";
import { Button } from "../../lib/ui";

export default function MyQr() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyQr(code)
      .then((r) => setToken(r.token))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar tu QR"));
  }, [code]);

  return (
    <Screen center accent={colors.hider}>
      <Reveal>
        <Text style={s.title}>TU QR</Text>
        <Text style={s.hint}>Si un cazador te encuentra, déjale escanearlo. Sé el único que lo ve: quien lo tenga puede capturarte.</Text>
      </Reveal>
      <View style={{ alignItems: "center", marginVertical: 12 }}>
        {token ? (
          <Reveal delay={0.3}>
            <QrCode value={qrPayload(code, token)} size={250} />
          </Reveal>
        ) : (
          <Text style={s.hint}>{error || "Cargando..."}</Text>
        )}
      </View>
      <Button title="Volver" secondary onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: colors.hider, fontSize: 28, fontWeight: "900", letterSpacing: 8, textAlign: "center" },
  hint: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 },
});
