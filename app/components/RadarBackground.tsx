// Versión web (y por defecto)
import { Canvas } from "@react-three/fiber";
import { StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { RadarScene } from "./RadarScene";

export function RadarBackground({ accent = colors.hunter, paused = false }: { accent?: string; paused?: boolean }) {
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      frameloop={paused ? "never" : "always"}
      dpr={1}
      camera={{ position: [0, 2.5, 19], fov: 50 }}
      gl={{ antialias: false }}
    >
      <RadarScene accent={accent} friendly={colors.hider} bg={colors.bg} />
    </Canvas>
  );
}
