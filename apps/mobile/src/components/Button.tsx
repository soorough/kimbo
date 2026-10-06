import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors, fonts, radius, space } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { T } from "./Text";

type Kind = "primary" | "secondary" | "ghost" | "danger";

const KIND = {
  primary: { bg: colors.leaf, fg: colors.white, border: colors.leaf },
  secondary: { bg: colors.surface, fg: colors.leafDeep, border: colors.line },
  ghost: { bg: "transparent", fg: colors.leaf, border: "transparent" },
  danger: { bg: "transparent", fg: colors.terracotta, border: "transparent" },
} as const;

export function Button({
  label,
  onPress,
  kind = "primary",
  icon,
  loading,
  disabled,
  compact,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: Kind;
  icon?: IconName;
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
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={compact ? 16 : 18} color={k.fg} /> : null}
          <T style={{ fontFamily: fonts.bold, fontSize: compact ? 14 : 16, color: k.fg }}>{label}</T>
        </View>
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
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
