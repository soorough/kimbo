import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import { colors } from "@/lib/theme";

export type IconName = ComponentProps<typeof Feather>["name"];

/** One icon family (Feather) app-wide: consistent stroke weight, a single small font file. */
export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}
