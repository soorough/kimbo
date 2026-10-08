import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { api } from "@/lib/api";
import { useScrolling } from "@/lib/scrolling";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

/** Pill height; everything else is sized from it. */
const PILL_H = 44;
const FACE = 36;

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
  const scrolling = useScrolling((st) => st.scrolling);
  const [labelW, setLabelW] = useState(84);
  const open = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const H = PILL_H;
  const W = H + labelW;
  // How far each cap travels to meet in the middle when collapsed.
  const shift = open.interpolate({ inputRange: [0, 1], outputRange: [(W - H) / 2, 0] });

  // Tuck into Kimbo's face while scrolling; glide open (with a little spin) once it settles.
  // Transforms and opacity only, on the native driver, so nothing re-lays-out mid-scroll.
  useEffect(() => {
    if (still) {
      open.setValue(scrolling ? 0 : 1);
      return;
    }
    Animated.spring(open, {
      toValue: scrolling ? 0 : 1,
      damping: 26,
      stiffness: scrolling ? 320 : 220,
      mass: 0.9,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
    if (!scrolling) {
      spin.setValue(0);
      Animated.timing(spin, { toValue: 1, duration: 420, delay: 120, useNativeDriver: true }).start();
    }
  }, [scrolling, still, open, spin]);

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
          style={({ pressed }) => [{ width: W, height: H }, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          {/* Left cap, right cap and the middle: the caps slide together and the middle shrinks. */}
          <Animated.View style={[styles.cap, { left: 0, transform: [{ translateX: shift }] }]} />
          <Animated.View
            style={[styles.cap, { left: W - H, transform: [{ translateX: Animated.multiply(shift, -1) }] }]}
          />
          <Animated.View style={[styles.middle, { left: H / 2, width: W - H, transform: [{ scaleX: open }] }]} />
          <Animated.View
            style={[
              styles.label,
              {
                left: H - 2,
                opacity: open.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
                transform: [{ translateX: open.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
              },
            ]}
          >
            <T style={styles.labelText} numberOfLines={1}>
              Ask Kimbo
            </T>
          </Animated.View>
          <Animated.View
            style={[
              styles.face,
              {
                transform: [
                  { translateX: shift },
                  { rotate: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "-14deg", "0deg"] }) },
                  { scale: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) },
                ],
              },
            ]}
          >
            <Kimbo mood={speaking ? "thanks" : mood} size={28} leaves={1 + helped} />
          </Animated.View>
          {/* Measured once off-screen, so the open width fits the text exactly. */}
          <View style={styles.measure} onLayout={(e) => setLabelW(e.nativeEvent.layout.width)}>
            <T style={styles.labelText}>Ask Kimbo</T>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clear of the tab bar, and above the page's cards (on Android, elevation also sets draw order).
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    marginBottom: space.xxxl,
    alignItems: "center",
    // Drawn above the page's cards without looking lifted off it: order by zIndex,
    // and only a soft shadow (elevation also casts a heavy shadow on Android).
    zIndex: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cap: {
    position: "absolute",
    top: 0,
    width: PILL_H,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    backgroundColor: colors.leaf,
  },
  middle: { position: "absolute", top: 0, height: PILL_H, backgroundColor: colors.leaf },
  // Kimbo's face, inset 4 from the pill's edge.
  face: {
    position: "absolute",
    left: 4,
    top: 4,
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.turmericSoft,
  },
  label: { position: "absolute", top: 0, height: PILL_H, justifyContent: "center" },
  labelText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    paddingLeft: 4,
    paddingRight: 14,
  },
  measure: { position: "absolute", opacity: 0, left: -1000 },
  bubble: {
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
});
