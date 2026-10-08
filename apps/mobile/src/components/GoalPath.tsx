import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useReduceMotion } from "@/lib/motion";
import { colors, space } from "@/lib/theme";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

const H = 150;
const PAD_X = 22;
const TOP = 30;
const BOTTOM = 34;
const KIMBO = 34;
const DRAW_MS = 1400;

/** 0 → 1 once, eased; jumps straight to 1 when motion is reduced. */
export function useDrawProgress(ms = DRAW_MS, onDone?: () => void) {
  const still = useReduceMotion();
  const [p, setP] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (still) {
      setP(1);
      return;
    }
    const id = v.addListener(({ value }) => setP(value));
    Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(
      ({ finished }) => finished && done.current?.(),
    );
    return () => v.removeListener(id);
  }, [ms, still, v]);
  return p;
}

/**
 * The user's own plan as a line that draws itself: today's weight to the goal weight, landing on the
 * date Kimbo calculated. Kimbo rides the leading point and cheers when it lands. Every point is the
 * plan's maths (a steady weekly pace), not an illustration.
 */
export function GoalPath({
  startLabel,
  goalLabel,
  dateLabel,
  losing,
}: {
  /** e.g. "76.2 kg" */
  startLabel: string;
  goalLabel: string;
  /** e.g. "6 Jan" */
  dateLabel: string;
  losing: boolean;
}) {
  const [w, setW] = useState(0);
  const [landed, setLanded] = useState(false);
  const p = useDrawProgress(DRAW_MS, () => {
    setLanded(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  });

  const left = PAD_X;
  const right = w - PAD_X;
  const yStart = losing ? TOP : H - BOTTOM;
  const yGoal = losing ? H - BOTTOM : TOP;
  // A steady pace is a straight line; soften only the two ends so it reads as a journey.
  const at = (t: number) => {
    const k = 0.75 * t + 0.25 * t * t * (3 - 2 * t);
    return { x: left + (right - left) * t, y: yStart + (yGoal - yStart) * k };
  };
  const steps = 48;
  const n = Math.max(2, Math.round(steps * p) + 1);
  const pts = Array.from({ length: n }, (_, i) => at((i / (n - 1)) * p));
  const line = pts.map((q, i) => `${i ? "L" : "M"} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ");
  const tip = pts.at(-1)!;
  const area = `${line} L ${tip.x.toFixed(1)} ${H - BOTTOM + 6} L ${left} ${H - BOTTOM + 6} Z`;
  const labels = Math.max(0, Math.min(1, (p - 0.85) / 0.15));

  return (
    <View
      style={styles.wrap}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Your plan: ${startLabel} today to ${goalLabel} around ${dateLabel}`}
    >
      {w > 0 ? (
        <>
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.leaf} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.leaf} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#goalFill)" />
            <Path d={line} stroke={colors.leaf} strokeWidth={3} fill="none" strokeLinecap="round" />
            <Circle cx={left} cy={yStart} r={6} fill={colors.surface} stroke={colors.ink} strokeWidth={2.5} />
            {landed ? (
              <Circle cx={right} cy={yGoal} r={7} fill={colors.leaf} stroke={colors.surface} strokeWidth={2.5} />
            ) : null}
          </Svg>
          <View pointerEvents="none" style={[styles.kimbo, { left: tip.x - KIMBO / 2, top: tip.y - KIMBO - 4 }]}>
            <Kimbo mood={landed ? "cheer" : "happy"} size={KIMBO} leaves={landed ? 3 : 1} />
          </View>
          <View pointerEvents="none" style={[styles.labelRow, { opacity: labels }]}>
            <View>
              <T variant="label" tone="soft">
                Today
              </T>
              <T variant="caption">{startLabel}</T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T variant="label" tone="leaf">
                {dateLabel}
              </T>
              <T variant="caption">{goalLabel}</T>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: H + 30,
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingTop: space.sm,
    overflow: "hidden",
  },
  kimbo: { position: "absolute", width: KIMBO, height: KIMBO },
  labelRow: {
    position: "absolute",
    left: PAD_X - 6,
    right: PAD_X - 6,
    bottom: space.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
