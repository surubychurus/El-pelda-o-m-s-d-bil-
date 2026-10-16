import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors, textGlow } from "../lib/theme";

// Revelación del rol al empezar: destello, texto que entra con golpe y (si eres cazador) sacudida
export function RoleReveal({ role, onDone }: { role: "hunter" | "hider"; onDone: () => void }) {
  const v = useRef({ op: new Animated.Value(0), sc: new Animated.Value(2.8), flash: new Animated.Value(0.9), x: new Animated.Value(0) }).current;
  const [hidden, setHidden] = useState(false);
  const hunter = role === "hunter";
  const color = hunter ? colors.hunter : colors.hider;

  useEffect(() => {
    const p = { op: 0, sc: 2.8, flash: 0.9, x: 0 };
    const sync = () => {
      v.op.setValue(p.op);
      v.sc.setValue(p.sc);
      v.flash.setValue(p.flash);
      v.x.setValue(p.x);
    };
    const tl = gsap.timeline({
      onUpdate: sync,
      onComplete: () => {
        setHidden(true);
        onDone();
      },
    });
    tl.to(p, { op: 1, sc: 1, flash: 0, duration: 0.45, ease: "expo.out" });
    if (hunter) tl.to(p, { x: 14, duration: 0.045, repeat: 9, yoyo: true, ease: "none" }, 0.3).set(p, { x: 0 });
    tl.to(p, { sc: 1.05, duration: 1.2, ease: "sine.inOut" }).to(p, { op: 0, sc: 0.9, duration: 0.5, ease: "power2.in" });
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hidden) return null;
  return (
    <Animated.View pointerEvents="none" style={[s.overlay, { opacity: v.op.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
      <Animated.View style={[s.flash, { backgroundColor: color, opacity: v.flash }]} />
      <Animated.Text
        style={[s.text, textGlow(color, 28), { color, transform: [{ translateX: v.x }, { scale: v.sc }] }]}
      >
        {hunter ? "ERES\nCAZADOR" : "ERES\nESCONDIDO"}
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: "rgba(7,8,13,0.88)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  flash: { ...(StyleSheet.absoluteFill as object) },
  text: { fontSize: 54, fontWeight: "900", letterSpacing: 6, textAlign: "center", lineHeight: 58 },
});
