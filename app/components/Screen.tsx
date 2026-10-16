import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../lib/theme";
import { RadarBackground } from "./RadarBackground";

// Pantalla con el radar 3D de fondo y una capa oscura para que el texto se lea bien
export function Screen({
  children,
  accent,
  paused,
  scroll,
  center,
}: {
  children: ReactNode;
  accent?: string;
  paused?: boolean;
  scroll?: boolean;
  center?: boolean;
}) {
  const body = { padding: 20, gap: 14, ...(center ? { flexGrow: 1, justifyContent: "center" as const } : null) };
  return (
    <View style={s.root}>
      <RadarBackground accent={accent} paused={paused} />
      <View style={s.veil} pointerEvents="none" />
      <SafeAreaView style={s.fill}>
        {scroll ? (
          <ScrollView contentContainerStyle={body}>{children}</ScrollView>
        ) : (
          <View style={[s.fill, body]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  veil: { ...StyleSheet.absoluteFill as object, backgroundColor: "rgba(7,8,13,0.28)" },
});
