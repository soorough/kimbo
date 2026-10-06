import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { colors, fonts, radius, space } from "@/lib/theme";
import { T } from "./Text";

type Kind = "primary" | "secondary" | "ghost" | "danger";

const KIND = {
  primary: { bg: colors.leaf, fg: colors.white, border: colors.leaf },
  secondary: { bg: colors.surface, fg: colors.leafDeep, border: colors.lineStrong },
  ghost: { bg: "transparent", fg: colors.leaf, border: "transparent" },
  danger: { bg: "transparent", fg: colors.terracotta, border: "transparent" },
} as const;

/** Buttons are text-only by design: the label says what happens; icons live in rows and tiles. */
export function Button({
  label,
  onPress,
  kind = "primary",
  loading,
  disabled,
  compact,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: Kind;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
}) {
  const k = KIND[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: k.bg, borderColor: k.border, opacity: disabled ? 0.45 : 1 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <T style={{ fontFamily: fonts.bold, fontSize: compact ? 14 : 16, color: k.fg }}>{label}</T>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: { minHeight: 40, paddingHorizontal: space.lg },
});
