// Versión iOS/Android: usa expo-gl. Se pausa cuando la app pasa a segundo plano para no gastar batería.
import { Canvas } from "@react-three/fiber/native";
import { useEffect, useState } from "react";
import { AppState, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { RadarScene } from "./RadarScene";

export function RadarBackground({ accent = colors.hunter, paused = false }: { accent?: string; paused?: boolean }) {
  const [state, setState] = useState(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", setState);
    return () => sub.remove();
  }, []);
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      frameloop={paused || state !== "active" ? "never" : "always"}
      camera={{ position: [0, 2.5, 19], fov: 50 }}
      gl={{ antialias: false }}
    >
      <RadarScene accent={accent} friendly={colors.hider} bg={colors.bg} />
    </Canvas>
  );
}
