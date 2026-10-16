// MODO PRUEBA (solo navegador): mueve tu posición a mano para jugar con un solo móvil.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getCurrentPos, getDebugPos, onDebugPos, setDebugPos, type Pos } from "../lib/position";
import { colors } from "../lib/theme";

const M_PER_DEG_LAT = 111_320;
const STEPS = [5, 20, 100];

export function DebugMover({ origin }: { origin?: { lat: number; lng: number } | null }) {
  const [pos, setPos] = useState<Pos | null>(getDebugPos());
  const [step, setStep] = useState(20);
  useEffect(() => onDebugPos(setPos), []);

  const move = async (dNorthM: number, dEastM: number) => {
    const base = pos ?? origin ?? (await getCurrentPos());
    const dLat = dNorthM / M_PER_DEG_LAT;
    const dLng = dEastM / (M_PER_DEG_LAT * Math.cos((base.lat * Math.PI) / 180));
    setDebugPos({ lat: base.lat + dLat, lng: base.lng + dLng });
  };

  const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable style={s.btn} onPress={onPress}>
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.box}>
      <Text style={s.title}>MODO PRUEBA · solo navegador</Text>
      <Text style={s.small}>
        {pos ? `Posición simulada: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : "Usando la ubicación real del navegador"}
      </Text>
      <View style={s.row}>
        {STEPS.map((m) => (
          <Pressable key={m} style={[s.chip, step === m && s.chipOn]} onPress={() => setStep(m)}>
            <Text style={s.btnText}>{m} m</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.pad}>
        <Btn label="↑ N" onPress={() => move(step, 0)} />
        <View style={s.row}>
          <Btn label="← O" onPress={() => move(0, -step)} />
          <Btn label="↓ S" onPress={() => move(-step, 0)} />
          <Btn label="→ E" onPress={() => move(0, step)} />
        </View>
      </View>
      <View style={s.row}>
        {origin ? <Btn label="Ir al centro" onPress={() => setDebugPos(origin)} /> : null}
        <Btn label="Ubicación real" onPress={() => setDebugPos(null)} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderStyle: "dashed", borderColor: "#f5a524", borderRadius: 14, padding: 12, gap: 8, backgroundColor: "rgba(245,165,36,0.07)" },
  title: { color: "#f5a524", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  small: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  pad: { alignItems: "center", gap: 8 },
  btn: { backgroundColor: "rgba(255,255,255,0.1)", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  chip: { backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  chipOn: { backgroundColor: "#f5a524" },
  btnText: { color: colors.text, fontWeight: "700", fontSize: 13 },
});
