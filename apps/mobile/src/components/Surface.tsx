import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadow, space } from "@/lib/theme";

/** A card. Pass onPress to make the whole card a touch target. */
export function Surface({
  children,
  style,
  tint = "surface",
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: "surface" | "leaf" | "turmeric" | "plum" | "sunk";
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const bg = {
    surface: colors.surface,
    leaf: colors.leafSoft,
    turmeric: colors.turmericSoft,
    plum: colors.plumSoft,
    sunk: colors.sunk,
  }[tint];
  const content = [styles.card, { backgroundColor: bg }, tint === "surface" && shadow.card, style];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [content, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
});
