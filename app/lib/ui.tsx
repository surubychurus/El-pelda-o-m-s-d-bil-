import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { usePressScale } from "./anim";
import { colors, glow } from "./theme";

export function Button({
  title,
  onPress,
  disabled,
  secondary,
  color = colors.hunter,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  color?: string;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={[{ borderRadius: 12, transform: [{ scale }] }, !secondary && !disabled && glow(color, 16)]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        onPress={onPress}
        style={[s.button, secondary ? s.secondary : { backgroundColor: color }, disabled && s.disabled]}
      >
        <Text style={s.buttonText}>{title.toUpperCase()}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Heading({ children }: { children: string }) {
  return <Text style={s.heading}>{children.toUpperCase()}</Text>;
}

export function Stepper({
  label,
  value,
  unit,
  step = 1,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.group}>
        {!disabled && (
          <Pressable style={s.step} onPress={() => onChange(Math.max(min, value - step))}>
            <Text style={s.stepText}>−</Text>
          </Pressable>
        )}
        <Text style={s.value}>
          {value}
          {unit ? ` ${unit}` : ""}
        </Text>
        {!disabled && (
          <Pressable style={s.step} onPress={() => onChange(Math.min(max, value + step))}>
            <Text style={s.stepText}>+</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.group}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            disabled={disabled}
            style={[s.chip, value === o.value && s.chipOn]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[s.chipText, value !== o.value && { color: colors.muted }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  button: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  secondary: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 2 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  heading: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 3, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46 },
  label: { color: colors.text, fontSize: 15, flexShrink: 1, marginRight: 8 },
  group: { flexDirection: "row", alignItems: "center", gap: 6 },
  step: {
    backgroundColor: "rgba(255,255,255,0.08)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: colors.text, fontSize: 20, fontWeight: "700" },
  value: { color: colors.text, fontSize: 16, fontWeight: "700", minWidth: 68, textAlign: "center" },
  chip: { backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  chipOn: { backgroundColor: colors.hunter },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
