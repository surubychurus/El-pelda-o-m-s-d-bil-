import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { capture, parseQr } from "../../lib/api";
import { getCurrentPos } from "../../lib/position";
import { colors, textGlow } from "../../lib/theme";
import { Button } from "../../lib/ui";

export default function Scan() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [manual, setManual] = useState("");
  const busy = useRef(false); // evita enviar la misma captura varias veces mientras la cámara sigue leyendo

  const onScan = async (data: string) => {
    if (busy.current) return;
    busy.current = true;
    const qr = parseQr(data);
    try {
      if (!qr || qr.code !== code) throw new Error("Ese QR no es de esta partida");
      const pos = await getCurrentPos();
      const res = await capture(code, qr.token, pos.lat, pos.lng);
      Vibration.vibrate(400);
      setMessage({ text: `¡Has capturado a ${res.nickname}!`, ok: true });
      setTimeout(() => router.back(), 1600);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "No se pudo capturar", ok: false });
      setTimeout(() => {
        setMessage(null);
        busy.current = false;
      }, 2200);
    }
  };

  if (!permission) return <View style={s.root} />;
  // En web el campo para pegar el código funciona aunque no haya cámara
  if (!permission.granted && Platform.OS !== "web") {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.text}>Necesito la cámara para escanear el QR del jugador.</Text>
        <Button title="Dar permiso" onPress={requestPermission} />
        <Button title="Volver" secondary onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {permission.granted ? (
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      ) : null}
      <View style={s.frame} pointerEvents="none" />
      <View style={s.top} pointerEvents="none">
        <Text style={[s.title, textGlow(colors.hunter, 14)]}>ESCANEA SU QR</Text>
      </View>
      <View style={s.bottom}>
        {Platform.OS === "web" ? (
          <View style={{ gap: 8 }}>
            {!permission.granted ? <Button title="Permitir cámara (opcional)" secondary onPress={requestPermission} /> : null}
            <TextInput
              style={s.input}
              value={manual}
              onChangeText={setManual}
              placeholder="O pega aquí el código del QR (manhunt:…)"
              placeholderTextColor="#777"
              autoCapitalize="none"
            />
            <Button title="Capturar con este código" disabled={!manual.trim()} onPress={() => onScan(manual)} />
          </View>
        ) : null}
        {message ? (
          <Text style={[s.msg, { color: message.ok ? colors.hider : colors.danger }]}>{message.text}</Text>
        ) : null}
        <Button title="Cancelar" secondary onPress={() => router.back()} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { justifyContent: "center", padding: 24, gap: 14 },
  text: { color: colors.text, fontSize: 16, textAlign: "center" },
  top: { position: "absolute", top: 70, width: "100%", alignItems: "center" },
  title: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: 6 },
  frame: { position: "absolute", top: "28%", left: "15%", right: "15%", aspectRatio: 1, borderWidth: 3, borderColor: colors.hunter, borderRadius: 24 },
  bottom: { position: "absolute", bottom: 48, left: 24, right: 24, gap: 14 },
  input: { backgroundColor: "rgba(0,0,0,0.75)", color: "#fff", padding: 12, borderRadius: 10, fontSize: 14 },
  msg: { fontSize: 18, fontWeight: "800", textAlign: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 12, borderRadius: 12 },
});
