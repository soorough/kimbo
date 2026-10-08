import type { GoalRequest } from "@kimbo/shared";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius } from "@/lib/theme";
import { Kimbo, type KimboMood } from "./Kimbo";
import { T } from "./Text";

export type SceneStep = "name" | "goal" | "diet" | "barriers" | "sex" | "age" | "height" | "weight" | "activity" | "goalWeight" | "pace";

type Activity = GoalRequest["activity"];

const W = 240;
const H = 128;
const KIMBO = 86;

/** Loop period per activity level: the busier the day, the faster Kimbo jogs. */
const JOG_MS: Record<Activity, number> = {
  sedentary: 1600,
  light: 760,
  moderate: 480,
  active: 340,
  very_active: 250,
};

/**
 * Kimbo acts out the current onboarding question and reacts to the live answer:
 * stretching beside a ruler for height, standing on a scale for weight, jogging faster
 * as the day gets busier. Decorative only; the question text carries the meaning.
 */
export function KimboScene({
  step,
  heightCm,
  weightLabel,
  goalWeightLabel,
  activity,
  pace,
}: {
  step: SceneStep;
  heightCm: number;
  weightLabel: string;
  goalWeightLabel: string;
  activity: Activity | null;
  /** 0..1 — where the chosen weekly pace sits among the options */
  pace: number | null;
}) {
  const still = useReduceMotion();

  return (
    <View style={styles.stage} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={W} height={8} style={styles.ground}>
        <Rect x={20} y={0} width={W - 40} height={8} rx={4} fill={colors.sunk} />
      </Svg>
      {step === "name" ? <Solo mood="wave" /> : null}
      {step === "diet" ? <Solo mood="happy" /> : null}
      {step === "barriers" ? <Solo mood="focus" /> : null}
      {step === "goal" ? <SignpostScene still={still} /> : null}
      {step === "sex" ? <Solo mood="wave" /> : null}
      {step === "age" ? <CakeScene still={still} /> : null}
      {step === "height" ? <HeightScene cm={heightCm} still={still} /> : null}
      {step === "weight" ? <ScaleScene label={weightLabel} still={still} /> : null}
      {step === "activity" ? <JogScene activity={activity} still={still} /> : null}
      {step === "goalWeight" ? <TargetScene still={still} label={goalWeightLabel} /> : null}
      {step === "pace" ? <WalkScene pace={pace} still={still} /> : null}
    </View>
  );
}

/** A 0→1→0 loop with the given half-period; parked at 0 when motion is reduced. */
function useLoop(halfMs: number, still: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    if (still) return;
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: halfMs, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: halfMs, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halfMs, still, v]);
  return v;
}

function Solo({ mood }: { mood: KimboMood }) {
  return (
    <View style={styles.center}>
      <Kimbo mood={mood} size={KIMBO} />
    </View>
  );
}

/** Kimbo grows with the chosen height, measured against a ruler. */
function HeightScene({ cm, still }: { cm: number; still: boolean }) {
  const target = 0.78 + Math.max(0, Math.min(1, (cm - 140) / 60)) * 0.44;
  const grow = useRef(new Animated.Value(target)).current;
  const breathe = useLoop(900, still);

  useEffect(() => {
    Animated.spring(grow, { toValue: target, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [grow, target]);

  const scaleY = Animated.multiply(grow, breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }));
  // Kimbo's sprout tip sits ~17% below the top of its square canvas; 4 is the row's bottom padding.
  const top = H - 4 - KIMBO * target * 0.83;

  return (
    <View style={styles.row}>
      <Svg width={34} height={H}>
        <Rect x={10} y={8} width={14} height={H - 16} rx={3} fill={colors.turmericSoft} />
        {Array.from({ length: 11 }, (_, i) => (
          <Line
            key={i}
            x1={10}
            x2={i % 5 === 0 ? 22 : 17}
            y1={8 + i * ((H - 16) / 10)}
            y2={8 + i * ((H - 16) / 10)}
            stroke={colors.turmericDeep}
            strokeWidth={1.5}
          />
        ))}
        <Line x1={2} x2={32} y1={top} y2={top} stroke={colors.leaf} strokeWidth={2} strokeDasharray="3 3" />
      </Svg>
      <Animated.View style={{ transform: [{ scaleY }, { scaleX: Animated.divide(1, Animated.add(0.5, Animated.multiply(scaleY, 0.5))) }], transformOrigin: "bottom" }}>
        <Kimbo mood="focus" size={KIMBO} />
      </Animated.View>
    </View>
  );
}

/** Kimbo hops onto a bathroom scale that reads the chosen weight. */
function ScaleScene({ label, still }: { label: string; still: boolean }) {
  const squash = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current || still) {
      first.current = false;
      return;
    }
    squash.setValue(0.9);
    Animated.spring(squash, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [label, squash, still]);

  return (
    <View style={styles.center}>
      <Animated.View style={{ transform: [{ scaleY: squash }], transformOrigin: "bottom", marginBottom: -6 }}>
        <Kimbo mood="happy" size={KIMBO - 8} />
      </Animated.View>
      <View style={styles.scale}>
        <View style={styles.readout}>
          <T style={styles.readoutText}>{label}</T>
        </View>
      </View>
    </View>
  );
}

/** A birthday cake with a flickering candle. */
function CakeScene({ still }: { still: boolean }) {
  const flicker = useLoop(260, still);
  return (
    <View style={[styles.row, { gap: 4 }]}>
      <Kimbo mood="cheer" size={KIMBO} />
      <View style={{ width: 70, height: 74 }}>
        <Animated.View
          style={[
            styles.flame,
            {
              opacity: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
              transform: [{ scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) }],
            },
          ]}
        />
        <Svg width={70} height={74} style={StyleSheet.absoluteFill}>
          <Rect x={32} y={14} width={6} height={18} rx={2} fill={colors.plum} />
          <Rect x={6} y={32} width={58} height={20} rx={6} fill={colors.plumSoft} />
          <Path d="M6 40 q7 7 14 0 t15 0 t15 0 t14 0" stroke={colors.white} strokeWidth={3} fill="none" />
          <Rect x={2} y={50} width={66} height={22} rx={6} fill={colors.turmericSoft} />
          <Circle cx={18} cy={61} r={2.5} fill={colors.leaf} />
          <Circle cx={35} cy={61} r={2.5} fill={colors.plum} />
          <Circle cx={52} cy={61} r={2.5} fill={colors.leaf} />
        </Svg>
      </View>
    </View>
  );
}

/** Kimbo jogs on the spot; more active days mean a faster bounce and speed lines. */
function JogScene({ activity, still }: { activity: Activity | null; still: boolean }) {
  const half = JOG_MS[activity ?? "sedentary"] / 2;
  const sitting = activity === "sedentary";
  const bounce = useLoop(half, still || activity === null || sitting);
  const fast = activity === "moderate" || activity === "active" || activity === "very_active";

  return (
    <View style={styles.row}>
      {fast ? (
        <Svg width={36} height={60}>
          {[14, 30, 46].map((y, i) => (
            <Line key={y} x1={4 + i * 4} x2={32} y1={y} y2={y} stroke={colors.inkFaint} strokeWidth={3} strokeLinecap="round" />
          ))}
        </Svg>
      ) : null}
      <Animated.View
        style={{
          transform: [
            { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
            { rotate: bounce.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "4deg"] }) },
          ],
        }}
      >
        <Kimbo mood={activity === null ? "idle" : sitting ? "sleepy" : fast ? "cheer" : "happy"} size={KIMBO} />
      </Animated.View>
    </View>
  );
}

/** Kimbo strolls toward the goal; a faster pace means a quicker walk. */
function WalkScene({ pace, still }: { pace: number | null; still: boolean }) {
  const half = 1500 - (pace ?? 0.33) * 1000;
  const walk = useLoop(half, still);
  return (
    <View style={styles.row}>
      <Animated.View
        style={{
          transform: [
            { translateX: walk.interpolate({ inputRange: [0, 1], outputRange: [-46, 10] }) },
            { translateY: walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -6, 0, -6, 0] }) },
          ],
        }}
      >
        <Kimbo mood="focus" size={KIMBO - 10} />
      </Animated.View>
      <Stopwatch turnMs={half * 2} still={still} />
    </View>
  );
}

/** Three ways to go — down, level, up — like the three goals below. */
function SignpostScene({ still }: { still: boolean }) {
  const sway = useLoop(900, still);
  return (
    <View style={[styles.row, { gap: 6 }]}>
      <Kimbo mood="thinking" size={KIMBO} />
      <Animated.View
        style={{
          transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }) }],
          transformOrigin: "bottom",
        }}
      >
        <Svg width={78} height={96}>
          <Rect x={36} y={10} width={6} height={86} rx={3} fill={colors.inkSoft} />
          <Path d="M40 14 h28 l8 8 -8 8 h-28 z" fill={colors.leaf} transform="rotate(14 40 22)" />
          <Path d="M40 40 h30 l8 8 -8 8 h-30 z" fill={colors.turmeric} />
          <Path d="M38 64 h-28 l-8 8 8 8 h28 z" fill={colors.plum} transform="rotate(14 38 72)" />
          <Path d="M48 23 l10 6 m0 0 l-5 1 m5 -1 l-1 -5" stroke={colors.white} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M48 48 h14" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M30 75 l-12 -5 m0 0 l3 4 m-3 -4 l5 -1" stroke={colors.white} strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A bullseye with the goal weight pinned to it. */
function TargetScene({ still, label }: { still: boolean; label: string }) {
  const pulse = useLoop(800, still);
  return (
    <View style={[styles.row, { gap: 10 }]}>
      <Kimbo mood="proud" size={KIMBO} />
      <View style={{ alignItems: "center" }}>
        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
          <Svg width={76} height={76}>
            <Circle cx={38} cy={38} r={36} fill={colors.plumSoft} />
            <Circle cx={38} cy={38} r={26} fill={colors.white} />
            <Circle cx={38} cy={38} r={16} fill={colors.plumSoft} />
            <Circle cx={38} cy={38} r={7} fill={colors.plum} />
          </Svg>
        </Animated.View>
        <View style={[styles.tag, { position: "relative", left: 0, top: -6 }]}>
          <T style={styles.tagText}>{label}</T>
        </View>
      </View>
    </View>
  );
}

/** A stopwatch whose hand goes round once per stride. */
function Stopwatch({ turnMs, still }: { turnMs: number; still: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spin.setValue(0);
    if (still) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: turnMs, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin, still, turnMs]);
  return (
    <View style={{ width: 64, height: 74 }}>
      <Svg width={64} height={74} style={StyleSheet.absoluteFill}>
        <Rect x={27} y={0} width={10} height={8} rx={2} fill={colors.inkSoft} />
        <Circle cx={32} cy={42} r={29} fill={colors.surface} stroke={colors.leafDeep} strokeWidth={4} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <Line
              key={i}
              x1={32 + Math.sin(a) * 21}
              y1={42 - Math.cos(a) * 21}
              x2={32 + Math.sin(a) * 25}
              y2={42 - Math.cos(a) * 25}
              stroke={colors.inkFaint}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      <Animated.View
        style={[
          styles.hand,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
        ]}
      >
        <View style={styles.handStick} />
      </Animated.View>
      <View style={styles.hub} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: W, height: H, alignSelf: "center", justifyContent: "flex-end", alignItems: "center" },
  ground: { position: "absolute", bottom: 0 },
  center: { alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 4 },
  scale: {
    width: 112,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  readout: { backgroundColor: colors.leafDeep, borderRadius: 4, paddingHorizontal: 6 },
  readoutText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.white },
  flame: {
    position: "absolute",
    left: 30,
    top: 2,
    width: 10,
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.turmeric,
    transformOrigin: "bottom",
  },
  tag: {
    position: "absolute",
    left: 14,
    top: 30,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  hand: { position: "absolute", left: 32 - 2, top: 42 - 20, width: 4, height: 40 },
  handStick: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.plum },
  hub: { position: "absolute", left: 32 - 4, top: 42 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  tagText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: colors.leafDeep },
});
