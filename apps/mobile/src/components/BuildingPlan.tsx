import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { colors, radius, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { Kimbo } from "./Kimbo";
import { Screen } from "./Screen";
import { T } from "./Text";

const STEPS = [
  "Energy your body uses at rest",
  "What your normal day adds",
  "The pace that fits your goal",
  "Protein, carbs, fat and fibre",
  "The date you'll get there",
];

/** Long enough to feel worked-on, short enough never to annoy. */
const MIN_MS = 2400;

/**
 * The pause between the last answer and the plan. Each line names a calculation that really
 * happens (BMR, activity, pace, macros, date), ticking off in order while the API saves the goal.
 * Calls onDone once the steps have played *and* the plan is ready, whichever is later.
 */
export function BuildingPlan({ name, ready, onDone }: { name: string | null; ready: boolean; onDone: () => void }) {
  const still = useReduceMotion();
  const [doneCount, setDoneCount] = useState(0);
  const bar = useRef(new Animated.Value(0)).current;
  const played = doneCount >= STEPS.length;

  useEffect(() => {
    if (still) {
      setDoneCount(STEPS.length);
      bar.setValue(1);
      return;
    }
    Animated.timing(bar, {
      toValue: 1,
      duration: MIN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const per = MIN_MS / STEPS.length;
    const timers = STEPS.map((_, i) =>
      setTimeout(
        () => {
          setDoneCount(i + 1);
          Haptics.selectionAsync().catch(() => {});
        },
        per * (i + 1),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [still, bar]);

  const finished = useRef(false);
  useEffect(() => {
    if (played && ready && !finished.current) {
      finished.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone();
    }
  }, [played, ready, onDone]);

  return (
    <Screen>
      <View style={styles.top} accessibilityLiveRegion="polite">
        <Kimbo mood="thinking" size={110} leaves={1} />
        <T variant="title" align="center">
          {name ? `Thanks, ${name}.` : "Thanks."}
          {"\n"}Putting your plan together…
        </T>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ["4%", "100%"] }) }]}
        />
      </View>
      <View style={styles.list}>
        {STEPS.map((s, i) => {
          const done = i < doneCount;
          const active = i === doneCount;
          return (
            <View key={s} style={[styles.row, !done && !active && styles.rowLater]}>
              <View style={[styles.dot, done && styles.dotDone]}>
                {done ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
              <T variant={done ? "bodyStrong" : "body"} tone={done ? undefined : "soft"}>
                {s}
              </T>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: "center", gap: space.lg, marginTop: space.xxxl },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.sunk,
    overflow: "hidden",
    marginTop: space.lg,
  },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.leaf },
  list: { gap: space.md, marginTop: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowLater: { opacity: 0.45 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.leaf, borderColor: colors.leaf },
});
