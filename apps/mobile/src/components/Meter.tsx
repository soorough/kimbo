import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import { useIntro } from "@/lib/intro";
import { useReduceMotion } from "@/lib/motion";
import Svg, { Circle } from "react-native-svg";
import { colors, radius } from "@/lib/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress. Values past the max wrap into a calm second colour rather than turning red.
 * The arc draws itself in when it first appears (once the launch intro is out of the way) and
 * glides to new values, so logging a meal visibly fills it.
 */
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
  const still = useReduceMotion();
  const introDone = useIntro((s) => s.done);
  // Animated in "fraction of a lap" (0..2): the first lap is the main colour, the second the overflow.
  const shown = useRef(new Animated.Value(still ? Math.min(2, ratio) : 0)).current;
  useEffect(() => {
    const to = Math.min(2, Math.max(0, ratio));
    if (still) {
      shown.setValue(to);
      return;
    }
    if (!introDone) return;
    Animated.timing(shown, { toValue: to, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ratio, still, introDone, shown]);

  const main = shown.interpolate({ inputRange: [0, 1, 2], outputRange: [c, 0, 0], extrapolate: "clamp" });
  const over = shown.interpolate({ inputRange: [0, 1, 2], outputRange: [c, c, 0], extrapolate: "clamp" });
  // A zero-length arc with round caps would still draw a dot, so each arc fades in as it starts.
  const mainOn = shown.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: "clamp" });
  const overOn = shown.interpolate({ inputRange: [1, 1.01], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={main}
          opacity={mainOn}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={overColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={over}
          opacity={overOn}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Bar({
  value,
  max,
  color = colors.leaf,
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: colors.sunk, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: radius.pill, backgroundColor: color }} />
    </View>
  );
}

/** A ring split into proportional coloured segments, e.g. the calorie share of each macro. */
export function SegmentRing({
  segments,
  size = 220,
  stroke = 16,
  gap = 0.012,
  children,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  /** gap between segments, as a fraction of the circle */
  gap?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        {segments.map((s, i) => {
          const share = s.value / total;
          const length = Math.max(0, share - gap) * c;
          const dash = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${length} ${c}`}
              strokeDashoffset={-offset * c}
            />
          );
          offset += share;
          return dash;
        })}
      </Svg>
      {children}
    </View>
  );
}
