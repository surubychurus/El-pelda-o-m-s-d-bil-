import { Pressable, StyleSheet, Text, View } from "react-native";

export function Button({
  title,
  onPress,
  disabled,
  secondary,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      style={[s.button, secondary && s.secondary, disabled && s.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
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
      <View style={s.stepper}>
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
      <View style={s.stepper}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            disabled={disabled}
            style={[s.chip, value === o.value && s.chipOn]}
            onPress={() => onChange(o.value)}
          >
            <Text style={s.chipText}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  button: { backgroundColor: "#e63946", padding: 16, borderRadius: 10, alignItems: "center" },
  secondary: { backgroundColor: "#2a2a2a" },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  label: { color: "#ccc", fontSize: 15, flexShrink: 1, marginRight: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  step: { backgroundColor: "#2a2a2a", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  value: { color: "#fff", fontSize: 16, fontWeight: "600", minWidth: 64, textAlign: "center" },
  chip: { backgroundColor: "#2a2a2a", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  chipOn: { backgroundColor: "#e63946" },
  chipText: { color: "#fff", fontWeight: "600" },
});
