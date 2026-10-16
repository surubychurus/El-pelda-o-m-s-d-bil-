import { gsap } from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

// GSAP anima un objeto plano y vuelca el valor en un Animated.Value (no necesita DOM, funciona igual en iOS, Android y web)
function useTweenValue(run: (p: { t: number }, set: () => void) => gsap.core.Tween | gsap.core.Timeline, deps: unknown[]) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const p = { t: 0 };
    const anim = run(p, () => value.setValue(p.t));
    return () => {
      anim.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

// Entrada con fundido y desplazamiento, con retardo para escalonar listas
export function Reveal({
  delay = 0,
  y = 24,
  style,
  children,
}: {
  delay?: number;
  y?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const v = useTweenValue(
    (p, set) => gsap.to(p, { t: 1, duration: 0.75, delay, ease: "power3.out", onUpdate: set }),
    [delay],
  );
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// "Pop" cada vez que cambia `key` (por ejemplo, los segundos de la cuenta atrás)
export function Pop({ trigger, style, children }: { trigger: unknown; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useTweenValue(
    (p, set) =>
      gsap
        .timeline({ onUpdate: set })
        .set(p, { t: 1 })
        .to(p, { t: 0, duration: 0.45, ease: "power2.out" }),
    [trigger],
  );
  return (
    <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Latido continuo (para elementos que piden atención)
export function Pulse({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useTweenValue(
    (p, set) => gsap.to(p, { t: 1, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1, onUpdate: set }),
    [],
  );
  return (
    <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Escala con rebote elástico al pulsar
export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (target: number, ease: string, duration: number) => {
    const p = { s: (scale as unknown as { _value: number })._value };
    gsap.to(p, { s: target, duration, ease, onUpdate: () => scale.setValue(p.s) });
  };
  return {
    scale,
    onPressIn: () => to(0.95, "power2.out", 0.12),
    onPressOut: () => to(1, "elastic.out(1,0.4)", 0.6),
  };
}
