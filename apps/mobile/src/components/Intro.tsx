import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

const NAME = "kimbo";

/**
 * Cold-start intro, played once over the first screen after the native splash
 * (which shows the same mark, so the hand-off is seamless):
 * Kimbo drops in and settles, the name writes itself in, then everything fades.
 * About 1.5 s; skipped entirely when the system asks to reduce motion.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [skip, setSkip] = useState<boolean | null>(null);
  const drop = useRef(new Animated.Value(0)).current;
  const letters = useRef(NAME.split("").map(() => new Animated.Value(0))).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSkip)
      .catch(() => setSkip(false));
  }, []);

  useEffect(() => {
    if (skip === null) return;
    if (skip) return onDone();
    const run = Animated.sequence([
      Animated.parallel([
        // Kimbo falls a little and lands with a soft bounce…
        Animated.spring(drop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 140, mass: 0.8 }),
        // …and the name starts writing itself in while the bounce settles.
        Animated.sequence([
          Animated.delay(420),
          Animated.stagger(
            70,
            letters.map((v) =>
              Animated.timing(v, {
                toValue: 1,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ),
          ),
          Animated.timing(tagline, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(300),
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [skip, drop, letters, tagline, fade, onDone]);

  if (skip !== false) return <View style={styles.root} />;

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} accessibilityLabel="Kimbo" pointerEvents="none">
      <Animated.View
        style={{
          opacity: drop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
            { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          ],
        }}
      >
        <Kimbo mood="happy" size={128} leaves={3} />
      </Animated.View>
      <View style={styles.word}>
        {NAME.split("").map((ch, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.letter,
              {
                opacity: letters[i],
                transform: [{ translateY: letters[i]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
      <Animated.View style={{ opacity: tagline }}>
        <T variant="label">Eat like home. Feel the progress.</T>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  word: { flexDirection: "row", marginTop: space.sm },
  letter: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, color: colors.ink, letterSpacing: -0.5 },
});
