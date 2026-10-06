import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

const NAME = "kimbo";
/** Same size as the native splash image (app.json imageWidth), so the hand-off is seamless. */
const MARK = 160;

/**
 * Cold-start intro. The native splash stays up until this view has drawn its first
 * frame — the same mark, at the same size and place — so there is no flash or jump.
 * Then: one soft hop, Kimbo rises and settles smaller, the name writes itself in
 * underneath, and the whole layer fades into the app (~1.4 s). Reduce-motion skips it.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const hop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const letters = useRef(NAME.split("").map(() => new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      SplashScreen.hideAsync().catch(() => {});
      onDone();
    }
  }, [reduceMotion, onDone]);

  /** Runs once the first frame is on screen, so hiding the native splash reveals an identical picture. */
  const start = () => {
    if (started.current || reduceMotion !== false) return;
    started.current = true;
    SplashScreen.hideAsync().catch(() => {});
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(rise, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
        Animated.stagger(
          60,
          letters.map((v) =>
            Animated.timing(v, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ),
        ),
      ]),
      Animated.delay(420),
      Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
  };

  if (reduceMotion !== false) return <View style={styles.root} />;

  return (
    <Animated.View
      style={[styles.root, { opacity: fade }]}
      onLayout={start}
      pointerEvents="none"
      accessibilityLabel="Kimbo"
    >
      <Animated.View
        style={{
          transform: [
            // a squash-and-stretch hop in place…
            { translateY: hop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -18, 0] }) },
            { scaleY: hop.interpolate({ inputRange: [0, 0.15, 0.5, 0.9, 1], outputRange: [1, 0.92, 1.06, 0.95, 1] }) },
            // …then rise and settle smaller to make room for the name
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) },
            { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
          ],
        }}
      >
        <Kimbo mood="happy" size={MARK} leaves={2} />
      </Animated.View>
      <View style={styles.word}>
        {NAME.split("").map((ch, i) => (
          <Animated.Text
            key={i}
            maxFontSizeMultiplier={1}
            style={[
              styles.letter,
              {
                opacity: letters[i],
                transform: [{ translateY: letters[i]!.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
      <Animated.View style={[styles.tagline, { opacity: letters[NAME.length - 1] }]}>
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
  },
  // Name and tagline sit below the centred mark without shifting it, so frame one matches the splash.
  word: { position: "absolute", top: "50%", marginTop: MARK / 2 - 20, flexDirection: "row" },
  letter: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, color: colors.ink, letterSpacing: -0.5 },
  tagline: { position: "absolute", top: "50%", marginTop: MARK / 2 + 46 + space.xs },
});
