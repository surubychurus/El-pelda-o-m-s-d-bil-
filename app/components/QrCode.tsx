import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

// Fondo blanco y margen: así lo lee bien cualquier cámara
export function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  return (
    <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
      <QRCode value={value} size={size} backgroundColor="#fff" color="#000" />
    </View>
  );
}
