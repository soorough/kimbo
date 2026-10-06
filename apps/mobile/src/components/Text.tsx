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

/**
 * How far each style may grow with the system text-size setting. Body text keeps
 * most of the user's preference; display type and big numbers grow less so
 * layouts built around them don't break.
 */
const MAX_SCALE: Record<TypeVariant, number> = {
  display: 1.15,
  title: 1.15,
  number: 1.1,
  heading: 1.25,
  body: 1.3,
  bodyStrong: 1.3,
  label: 1.3,
  caption: 1.3,
  overline: 1.2,
};

/** The only text primitive in the app, so every string follows the type scale. */
export function T({
  variant = "body",
  tone,
  align,
  numberOfLines,
  fit,
  style,
  children,
  onPress,
}: {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle["textAlign"];
  numberOfLines?: number;
  /** Single-line text that shrinks to fit rather than wrapping mid-word. */
  fit?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      numberOfLines={fit ? 1 : numberOfLines}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.75 : undefined}
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[type[variant], tone && { color: TONES[tone] }, align && { textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
