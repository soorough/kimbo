import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, shadow, space } from "@/lib/theme";
import { Kimbo, type KimboMood } from "./Kimbo";
import { T } from "./Text";

const TAPS_NEEDED = 3;
const TAP_WINDOW_MS = 900;
const LINE = "I track food, not personal boundaries. 😭";

/**
 * Kimbo in Today's header. Purely for charm: three quick taps and Kimbo
 * protests. Single taps get a small wiggle so the character feels alive.
 */
export function KimboBuddy({ mood, leaves }: { mood: KimboMood; leaves: number }) {
  const taps = useRef<number[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const wiggle = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!speaking) return;
    Animated.spring(bubble, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }).start();
    const t = setTimeout(() => {
      Animated.timing(bubble, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSpeaking(false));
    }, 2600);
    return () => clearTimeout(t);
  }, [speaking, bubble]);

  const onPress = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    wiggle.setValue(0);
    Animated.timing(wiggle, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    if (taps.current.length >= TAPS_NEEDED && !speaking) {
      taps.current = [];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setSpeaking(true);
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const rotate = wiggle.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: ["0deg", "-10deg", "10deg", "0deg"],
  });

  return (
    <View>
      <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel="Kimbo" hitSlop={8}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Kimbo mood={speaking ? "thanks" : mood} size={56} leaves={leaves} />
        </Animated.View>
      </Pressable>
      {speaking ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              opacity: bubble,
              transform: [
                { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
                { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <T variant="bodyStrong">{LINE}</T>
          <View style={styles.tail} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    top: 64,
    right: 0,
    width: 230,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    zIndex: 10,
    ...shadow.raised,
  },
  tail: {
    position: "absolute",
    top: -6,
    right: 22,
    width: 12,
    height: 12,
    backgroundColor: colors.surface,
    transform: [{ rotate: "45deg" }],
  },
});
