import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { colors } from "@/lib/theme";

/**
 * Kimbo's nine moods — one per cell of a 3×3 reaction sheet (after nilbuild/page-mascot),
 * so drawn art could replace this vector body without touching call sites.
 * The body never changes colour (it's one character); only the face and sprout react.
 */
export type KimboMood =
  | "idle" // resting on a screen
  | "thinking" // analysing a meal or report
  | "happy" // meal saved
  | "proud" // meal supported today's focus
  | "cheer" // consistency milestone
  | "thanks" // user corrected an AI result
  | "wave" // welcome back after a break
  | "focus" // a report became the daily focus
  | "sleepy"; // nothing logged yet

const BODY = "#F2A93B";
const BODY_SHADE = "#E08F22";
const CHEEK = "#F49A84";
const INK = colors.ink;

type Eyes = "open" | "happy" | "closed" | "wide";
type Mouth = "smile" | "grin" | "o" | "flat";

const FACE: Record<KimboMood, { eyes: Eyes; mouth: Mouth }> = {
  idle: { eyes: "open", mouth: "smile" },
  thinking: { eyes: "open", mouth: "o" },
  happy: { eyes: "happy", mouth: "grin" },
  proud: { eyes: "happy", mouth: "smile" },
  cheer: { eyes: "happy", mouth: "grin" },
  thanks: { eyes: "happy", mouth: "smile" },
  wave: { eyes: "open", mouth: "grin" },
  focus: { eyes: "wide", mouth: "smile" },
  sleepy: { eyes: "closed", mouth: "flat" },
};

/** Leaf positions up the sprout; Kimbo grows one per meal that helps the focus. */
const LEAF_SPOTS = [
  { x: 50, y: 24, side: 1 },
  { x: 50, y: 20, side: -1 },
  { x: 50, y: 15, side: 1 },
  { x: 50, y: 11, side: -1 },
  { x: 50, y: 7, side: 1 },
];

export function Kimbo({ mood = "idle", size = 96, leaves = 1 }: { mood?: KimboMood; size?: number; leaves?: number }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.setValue(0);
    const bounce = mood === "happy" || mood === "proud" || mood === "cheer";
    const loop = mood === "thinking" || mood === "idle" || mood === "sleepy" || mood === "wave";
    const there = Animated.timing(motion, {
      toValue: 1,
      duration: mood === "thinking" ? 650 : mood === "sleepy" ? 1800 : bounce ? 380 : 1500,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const back = Animated.timing(motion, { toValue: 0, duration: bounce ? 300 : 900, useNativeDriver: true });
    const run = loop ? Animated.loop(Animated.sequence([there, back])) : Animated.sequence([there, back]);
    run.start();
    return () => run.stop();
  }, [mood, motion]);

  const transform =
    mood === "thinking" || mood === "wave"
      ? [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-7deg", "7deg"] }) }]
      : mood === "happy" || mood === "proud" || mood === "cheer"
        ? [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.14] }) }]
        : [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, mood === "sleepy" ? 0.97 : 1.03] }) }];

  const { eyes, mouth } = FACE[mood];
  const leafCount = Math.max(1, Math.min(LEAF_SPOTS.length, Math.round(leaves)));
  const stemTop = LEAF_SPOTS[leafCount - 1]!.y - 2;

  return (
    <Animated.View style={{ width: size, height: size, transform }} accessibilityLabel={`Kimbo, feeling ${mood}`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* sprout */}
        <Path d={`M50 30 Q51 ${(30 + stemTop) / 2} 50 ${stemTop}`} stroke={colors.leaf} strokeWidth={3} strokeLinecap="round" fill="none" />
        {LEAF_SPOTS.slice(0, leafCount).map((l, i) => (
          <Path
            key={i}
            d="M0 0 C5 -7 13 -6 17 -1 C12 4 5 5 0 0 Z"
            fill={i % 2 ? colors.leafDeep : colors.leaf}
            transform={`translate(${l.x} ${l.y}) scale(${l.side} 1) rotate(-12)`}
          />
        ))}
        {/* body */}
        <Ellipse cx={50} cy={63} rx={39} ry={34} fill={BODY} />
        <Ellipse cx={50} cy={86} rx={30} ry={8} fill={BODY_SHADE} opacity={0.35} />
        <Ellipse cx={37} cy={48} rx={11} ry={7} fill="#FFFFFF" opacity={0.28} />
        {/* cheeks */}
        <Ellipse cx={29} cy={70} rx={6} ry={3.6} fill={CHEEK} opacity={0.75} />
        <Ellipse cx={71} cy={70} rx={6} ry={3.6} fill={CHEEK} opacity={0.75} />
        {/* eyes */}
        {[38, 62].map((x) => (
          <EyeShape key={x} x={x} kind={eyes} />
        ))}
        {/* mouth */}
        <MouthShape kind={mouth} />
        {/* extras */}
        {mood === "cheer" ? (
          <G fill={colors.turmeric}>
            <Path d="M12 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
            <Path d="M86 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" />
          </G>
        ) : null}
        {mood === "thinking" ? (
          <G fill={colors.inkFaint}>
            <Circle cx={80} cy={26} r={2.2} />
            <Circle cx={87} cy={20} r={2.8} />
            <Circle cx={95} cy={12} r={3.4} />
          </G>
        ) : null}
        {mood === "sleepy" ? (
          <Path d="M80 22 h8 l-8 9 h8" stroke={colors.inkFaint} strokeWidth={2} fill="none" strokeLinejoin="round" />
        ) : null}
        {mood === "wave" ? (
          <Path d="M88 52 q8 -6 6 -16" stroke={BODY_SHADE} strokeWidth={6} strokeLinecap="round" fill="none" />
        ) : null}
      </Svg>
    </Animated.View>
  );
}

function EyeShape({ x, kind }: { x: number; kind: Eyes }) {
  if (kind === "happy") return <Path d={`M${x - 5} 61 Q${x} 54 ${x + 5} 61`} stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />;
  if (kind === "closed") return <Path d={`M${x - 5} 59 Q${x} 63 ${x + 5} 59`} stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />;
  const r = kind === "wide" ? 5.4 : 4.6;
  return (
    <G>
      <Circle cx={x} cy={59} r={r} fill={INK} />
      <Circle cx={x + 1.6} cy={57.2} r={1.5} fill="#FFFFFF" />
    </G>
  );
}

function MouthShape({ kind }: { kind: Mouth }) {
  switch (kind) {
    case "grin":
      return <Path d="M42 69 Q50 80 58 69 Z" fill="#7E3524" stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
    case "o":
      return <Circle cx={50} cy={72} r={3.6} fill="none" stroke={INK} strokeWidth={2.5} />;
    case "flat":
      return <Path d="M45 72 h10" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
    default:
      return <Path d="M44 70 Q50 76 56 70" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />;
  }
}
