import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { api } from "@/lib/api";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

const LINE = "I track food, not personal boundaries. 😭";

/**
 * Kimbo, fixed at the bottom centre of every tab (SuperKalam-style): always one tap from the
 * PA. It breathes, hops now and then, wears today's mood, and grows a leaf for each meal that
 * helped. Long-press for Kimbo's protest (the old triple-tap easter egg).
 */
export function AskKimboPill() {
  const still = useReduceMotion();
  const today = useQuery({ queryKey: ["today", null], queryFn: () => api.today(), staleTime: 30_000 });
  const helped = today.data?.focusSummary?.supported ?? 0;
  const mood = today.data?.meals.length ? (helped ? "proud" : "happy") : "wave";
  const hop = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (still) return;
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    const h = Animated.loop(
      Animated.sequence([
        Animated.delay(7000),
        Animated.spring(hop, { toValue: 1, damping: 6, stiffness: 260, useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    );
    b.start();
    h.start();
    return () => {
      b.stop();
      h.stop();
    };
  }, [breathe, hop, still]);

  useEffect(() => {
    if (!speaking) return;
    Animated.spring(bubble, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }).start();
    const t = setTimeout(() => {
      Animated.timing(bubble, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSpeaking(false));
    }, 2600);
    return () => clearTimeout(t);
  }, [speaking, bubble]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {speaking ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.bubble, { opacity: bubble, transform: [{ scale: bubble }] }]}
        >
          <T variant="label" style={{ color: colors.ink }}>
            {LINE}
          </T>
        </Animated.View>
      ) : null}
      <Animated.View
        style={{
          transform: [
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
            { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
          ],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Kimbo"
          accessibilityHint="Opens your assistant"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push("/assistant");
          }}
          onLongPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            setSpeaking(true);
          }}
          style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <View style={styles.face}>
            <Kimbo mood={speaking ? "thanks" : mood} size={34} leaves={1 + helped} />
          </View>
          <T style={styles.label}>Ask Kimbo</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: "100%", marginBottom: space.md, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: 6,
    paddingRight: space.lg,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    ...shadow.raised,
  },
  face: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.turmericSoft,
  },
  label: { color: colors.white, fontFamily: fonts.semibold, fontSize: 16 },
  bubble: {
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
});
