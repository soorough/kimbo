import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, radius } from "@/lib/theme";

/** Circular progress. Values past the max wrap into a calm second colour rather than turning red. */
export function Ring({
  value,
  max,
  size = 148,
  stroke = 12,
  color = colors.leaf,
  overColor = colors.plum,
  track = colors.sunk,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  overColor?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? value / max : 0;
  const main = Math.min(1, ratio);
  const over = Math.min(1, Math.max(0, ratio - 1));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * main} ${c}`}
        />
        {over > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={overColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * over} ${c}`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ value, max, color = colors.leaf, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: colors.sunk, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: radius.pill, backgroundColor: color }} />
    </View>
  );
}
