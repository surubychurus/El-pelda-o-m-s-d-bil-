import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, Vibration, View } from "react-native";
import { capture, parseQr } from "../../lib/api";
import { colors, textGlow } from "../../lib/theme";
import { Button } from "../../lib/ui";

export default function Scan() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const busy = useRef(false); // evita enviar la misma captura varias veces mientras la cámara sigue leyendo

  const onScan = async (data: string) => {
    if (busy.current) return;
    busy.current = true;
    const qr = parseQr(data);
    try {
      if (!qr || qr.code !== code) throw new Error("Ese QR no es de esta partida");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await capture(code, qr.token, pos.coords.latitude, pos.coords.longitude);
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
  if (!permission.granted) {
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
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <View style={s.frame} pointerEvents="none" />
      <View style={s.top} pointerEvents="none">
        <Text style={[s.title, textGlow(colors.hunter, 14)]}>ESCANEA SU QR</Text>
      </View>
      <View style={s.bottom}>
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
  msg: { fontSize: 18, fontWeight: "800", textAlign: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 12, borderRadius: 12 },
});
