import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { T } from "./Text";

export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0.5,
  max = 50,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
}) {
  const change = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) Haptics.selectionAsync().catch(() => {});
    onChange(clamped);
  };
  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Less"
        disabled={value <= min}
        onPress={() => change(value - step)}
        style={[styles.btn, value <= min && { opacity: 0.35 }]}
        hitSlop={8}
      >
        <Icon name="minus" size={18} color={colors.leafDeep} />
      </Pressable>
      <T variant="heading" style={styles.value}>
        {formatQty(value)}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More"
        disabled={value >= max}
        onPress={() => change(value + step)}
        style={[styles.btn, value >= max && { opacity: 0.35 }]}
        hitSlop={8}
      >
        <Icon name="plus" size={18} color={colors.leafDeep} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.sunk, borderRadius: radius.pill, padding: 4 },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  value: { minWidth: 44, textAlign: "center" },
});
