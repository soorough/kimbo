import type { ReactNode } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { colors, type, type TypeVariant } from "@/lib/theme";

const TONES = {
  ink: colors.ink,
  soft: colors.inkSoft,
  faint: colors.inkFaint,
  leaf: colors.leaf,
  plum: colors.plum,
  terracotta: colors.terracotta,
  turmeric: colors.turmericDeep,
  white: colors.white,
} as const;

export type Tone = keyof typeof TONES;

/** The only text primitive in the app, so every string follows the type scale. */
export function T({
  variant = "body",
  tone,
  align,
  numberOfLines,
  style,
  children,
  onPress,
}: {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle["textAlign"];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      style={[type[variant], tone && { color: TONES[tone] }, align && { textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
