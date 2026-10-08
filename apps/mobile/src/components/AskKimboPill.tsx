import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

/**
 * Kimbo is always one tap away: a pill floating above the tab bar (SuperKalam-style),
 * that gives a small hop now and then so it feels alive without nagging.
 */
export function AskKimboPill() {
  const still = useReduceMotion();
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(6000),
        Animated.spring(hop, { toValue: 1, damping: 6, stiffness: 260, useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hop, still]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Kimbo"
        onPress={() => router.push("/assistant")}
        style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Kimbo mood="wave" size={26} />
        <T style={styles.label}>Ask Kimbo</T>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: space.lg, bottom: "100%", marginBottom: space.md },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: 8,
    paddingRight: space.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    ...shadow.raised,
  },
  label: { color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
});
