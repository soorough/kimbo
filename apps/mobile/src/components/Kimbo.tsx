import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

/**
 * Kimbo's nine moods — one per cell of a 3×3 reaction sheet (after nilbuild/page-mascot),
 * so drawn art can replace this vector body without touching call sites.
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

const EYES: Record<KimboMood, "open" | "closed" | "happy" | "wide"> = {
  idle: "open",
  thinking: "open",
  happy: "happy",
  proud: "happy",
  cheer: "happy",
  thanks: "happy",
  wave: "open",
  focus: "wide",
  sleepy: "closed",
};

const MOUTH: Record<KimboMood, "smile" | "grin" | "o" | "flat"> = {
  idle: "smile",
  thinking: "o",
  happy: "grin",
  proud: "grin",
  cheer: "grin",
  thanks: "smile",
  wave: "grin",
  focus: "smile",
  sleepy: "flat",
};

export function Kimbo({ mood = "idle", size = 96 }: { mood?: KimboMood; size?: number }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.setValue(0);
    const bounce = mood === "happy" || mood === "proud" || mood === "cheer";
    const loop = mood === "thinking" || mood === "idle" || mood === "sleepy" || mood === "wave";
    const anim = Animated.timing(motion, {
      toValue: 1,
      duration: mood === "thinking" ? 700 : mood === "sleepy" ? 1800 : bounce ? 420 : 1400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const run = loop
      ? Animated.loop(Animated.sequence([anim, Animated.timing(motion, { toValue: 0, duration: 700, useNativeDriver: true })]))
      : Animated.sequence([anim, Animated.timing(motion, { toValue: 0, duration: 300, useNativeDriver: true })]);
    run.start();
    return () => run.stop();
  }, [mood, motion]);

  const transform =
    mood === "thinking"
      ? [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] }) }]
      : mood === "wave"
        ? [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-10deg", "10deg"] }) }]
        : mood === "happy" || mood === "proud" || mood === "cheer"
          ? [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.18] }) }]
          : [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, mood === "sleepy" ? 0.97 : 1.03] }) }];

  const s = size / 100;
  const eyes = EYES[mood];
  const mouth = MOUTH[mood];
  const body = mood === "focus" || mood === "proud" ? colors.primary : colors.accent;

  return (
    <Animated.View style={{ width: size, height: size, transform }} accessibilityLabel={`Kimbo looks ${mood}`}>
      {/* leaf sprout */}
      <View style={[styles.leaf, { left: 50 * s, top: 0, width: 14 * s, height: 22 * s, borderRadius: 10 * s }]} />
      <View
        style={[
          styles.body,
          { top: 14 * s, width: 100 * s, height: 86 * s, borderRadius: 44 * s, backgroundColor: body },
        ]}
      >
        <View style={[styles.cheek, { left: 14 * s, top: 46 * s, width: 14 * s, height: 8 * s, borderRadius: 4 * s }]} />
        <View style={[styles.cheek, { right: 14 * s, top: 46 * s, width: 14 * s, height: 8 * s, borderRadius: 4 * s }]} />
        {[30, 62].map((x) => (
          <Eye key={x} kind={eyes} left={x * s} top={30 * s} s={s} />
        ))}
        <Mouth kind={mouth} s={s} />
      </View>
      {mood === "cheer" ? <Glyph s={s} glyph="✦" left={2} top={6} /> : null}
      {mood === "cheer" ? <Glyph s={s} glyph="✦" left={84} top={2} /> : null}
      {mood === "thinking" ? <Glyph s={s} glyph="…" left={78} top={0} /> : null}
      {mood === "sleepy" ? <Glyph s={s} glyph="z" left={82} top={4} /> : null}
    </Animated.View>
  );
}

function Eye({ kind, left, top, s }: { kind: (typeof EYES)[KimboMood]; left: number; top: number; s: number }) {
  if (kind === "closed" || kind === "happy") {
    return (
      <View
        style={{
          position: "absolute",
          left,
          top: top + 4 * s,
          width: 10 * s,
          height: 5 * s,
          borderColor: colors.text,
          borderTopWidth: kind === "happy" ? 2.5 * s : 0,
          borderBottomWidth: kind === "closed" ? 2.5 * s : 0,
          borderTopLeftRadius: kind === "happy" ? 6 * s : 0,
          borderTopRightRadius: kind === "happy" ? 6 * s : 0,
        }}
      />
    );
  }
  const d = kind === "wide" ? 12 * s : 10 * s;
  return (
    <View style={{ position: "absolute", left, top, width: d, height: d, borderRadius: d, backgroundColor: colors.text }}>
      <View style={{ position: "absolute", left: d * 0.55, top: d * 0.15, width: d * 0.3, height: d * 0.3, borderRadius: d, backgroundColor: colors.white }} />
    </View>
  );
}

function Mouth({ kind, s }: { kind: (typeof MOUTH)[KimboMood]; s: number }) {
  const base = { position: "absolute" as const, left: 40 * s, top: 52 * s, borderColor: colors.text };
  if (kind === "o") return <View style={{ ...base, left: 45 * s, width: 10 * s, height: 10 * s, borderRadius: 6 * s, borderWidth: 2.5 * s }} />;
  if (kind === "flat") return <View style={{ ...base, left: 43 * s, top: 56 * s, width: 14 * s, height: 0, borderTopWidth: 2.5 * s }} />;
  return (
    <View
      style={{
        ...base,
        width: 20 * s,
        height: kind === "grin" ? 11 * s : 8 * s,
        borderBottomWidth: 2.5 * s,
        borderLeftWidth: kind === "grin" ? 2.5 * s : 0,
        borderRightWidth: kind === "grin" ? 2.5 * s : 0,
        borderBottomLeftRadius: 12 * s,
        borderBottomRightRadius: 12 * s,
        backgroundColor: kind === "grin" ? "#8A3B2B" : "transparent",
      }}
    />
  );
}

function Glyph({ glyph, left, top, s }: { glyph: string; left: number; top: number; s: number }) {
  return <Text style={{ position: "absolute", left: left * s, top: top * s, fontSize: 16 * s, color: colors.muted }}>{glyph}</Text>;
}

const styles = StyleSheet.create({
  body: { position: "absolute", left: 0 },
  leaf: { position: "absolute", backgroundColor: colors.primary, transform: [{ rotate: "35deg" }] },
  cheek: { position: "absolute", backgroundColor: "#F7B5A0", opacity: 0.8 },
});
