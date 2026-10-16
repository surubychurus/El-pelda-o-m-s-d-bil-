// Versión sin mapa nativo (web): radar plano con los puntos proyectados alrededor del centro
import { StyleSheet, Text, View } from "react-native";
import type { MapPoint } from "../lib/api";
import { colors } from "../lib/theme";
import { zoneRadiusMeters, type AlertMapProps } from "./alertMapShared";

const M_PER_DEG = 111_320;

export function AlertMap({ origin, radiusM, points, me, height = 340 }: AlertMapProps) {
  const half = zoneRadiusMeters(radiusM) * 1.15;
  const toXY = (p: { lat: number; lng: number }) => {
    const dx = (p.lng - origin.lng) * M_PER_DEG * Math.cos((origin.lat * Math.PI) / 180);
    const dy = (p.lat - origin.lat) * M_PER_DEG;
    return { left: `${50 + (dx / half) * 50}%` as const, top: `${50 - (dy / half) * 50}%` as const };
  };
  const dot = (p: MapPoint | { lat: number; lng: number; hunter?: boolean }, key: string, color: string, size: number) => (
    <View key={key} style={[s.dot, toXY(p), { backgroundColor: color, width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2 }]} />
  );
  return (
    <View style={[s.map, { height }]}>
      <View style={s.zone} />
      {points.map((p, i) => dot(p, `p${i}`, p.hunter ? colors.hunter : colors.hider, p.hunter ? 18 : 12))}
      {me ? dot(me, "me", "#fff", 12) : null}
      <Text style={s.label}>Radio {radiusM} m</Text>
    </View>
  );
}

const s = StyleSheet.create({
  map: { backgroundColor: "#0b0d14", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  zone: { position: "absolute", left: "8.7%", right: "8.7%", top: "8.7%", bottom: "8.7%", borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,46,77,0.7)", backgroundColor: "rgba(255,46,77,0.06)" },
  dot: { position: "absolute", borderWidth: 2, borderColor: "#fff" },
  label: { position: "absolute", bottom: 8, left: 12, color: colors.muted, fontSize: 11 },
});
