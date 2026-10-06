import type { KimboEvent } from "@kimbo/shared";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { colors, radius, shadow, space } from "@/lib/theme";
import { Button } from "./Button";
import { Kimbo, type KimboMood } from "./Kimbo";
import { T } from "./Text";

const MOOD: Record<KimboEvent["type"], KimboMood> = {
  first_3_days: "cheer",
  first_full_week: "cheer",
  consistency_improved: "cheer",
  focus_improved: "proud",
  welcome_back: "wave",
  meal_supported_focus: "proud",
  report_became_focus: "focus",
  correction_accepted: "thanks",
};

/** Milestones earn a moment of their own; everything else is a light, passing toast. */
const MILESTONES = new Set<KimboEvent["type"]>([
  "first_3_days",
  "first_full_week",
  "consistency_improved",
  "focus_improved",
]);

const MILESTONE_TITLES: Partial<Record<KimboEvent["type"], string>> = {
  first_3_days: "3 days logged",
  first_full_week: "A full week",
  consistency_improved: "Better than last week",
  focus_improved: "Focus up",
};

interface MomentsState {
  toasts: KimboEvent[];
  milestones: KimboEvent[];
  push: (events: KimboEvent[]) => void;
  shiftToast: () => void;
  shiftMilestone: () => void;
}

/** Kimbo's reactions returned by the API, played one at a time and never blocking the flow. */
export const useMoments = create<MomentsState>((set) => ({
  toasts: [],
  milestones: [],
  push: (events) =>
    set((s) => ({
      toasts: [...s.toasts, ...events.filter((e) => !MILESTONES.has(e.type))],
      milestones: [...s.milestones, ...events.filter((e) => MILESTONES.has(e.type))],
    })),
  shiftToast: () => set((s) => ({ toasts: s.toasts.slice(1) })),
  shiftMilestone: () => set((s) => ({ milestones: s.milestones.slice(1) })),
}));

export function MomentToast() {
  // Wait while a milestone celebration is open, so each moment gets its turn.
  const celebrating = useMoments((s) => s.milestones.length > 0);
  const current = useMoments((s) => (celebrating ? undefined : s.toasts[0]));
  const shift = useMoments((s) => s.shiftToast);
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (!current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    y.setValue(-140);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
    const timer = setTimeout(() => {
      Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => shift());
    }, 2600);
    return () => clearTimeout(timer);
  }, [current, shift, y]);

  if (!current) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.toastWrap, { top: insets.top + space.sm, transform: [{ translateY: y }] }]}
    >
      <Pressable onPress={shift} style={styles.toast} accessibilityRole="alert" accessibilityLabel={current.message}>
        <Kimbo mood={MOOD[current.type]} size={44} leaves={current.type === "meal_supported_focus" ? 3 : 1} />
        <T variant="bodyStrong" style={{ flex: 1 }}>
          {current.message}
        </T>
      </Pressable>
    </Animated.View>
  );
}

export function Celebration() {
  const current = useMoments((s) => s.milestones[0]);
  const shift = useMoments((s) => s.shiftMilestone);
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    scale.setValue(0.85);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 160 }).start();
  }, [current, scale]);

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="fade"
      onRequestClose={shift}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {current ? (
        <View style={styles.celebrationRoot}>
          <Confetti key={current.message} />
          <Animated.View style={[styles.celebrationCard, { transform: [{ scale }] }]}>
            <Kimbo mood={MOOD[current.type]} size={120} leaves={5} />
            <T variant="overline" tone="turmeric">
              MILESTONE
            </T>
            <T variant="title" align="center">
              {MILESTONE_TITLES[current.type] ?? "Milestone"}
            </T>
            <T variant="body" tone="soft" align="center">
              {current.message}
            </T>
            <View style={{ alignSelf: "stretch", marginTop: space.sm }}>
              <Button label="Done" onPress={shift} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

// Confetti is decoration, so it may use the full warm range.
const CONFETTI_COLORS = [colors.turmeric, colors.leaf, colors.plum, "#F2C14E", "#E8A07E"];
const { width: W, height: H } = Dimensions.get("window");

/** A short burst of falling paper — cheap Animated views, no extra library. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        x: Math.random() * W,
        delay: Math.random() * 400,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        w: 6 + Math.random() * 6,
        progress: new Animated.Value(0),
      })),
    [],
  );

  useEffect(() => {
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: 2200,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: -20,
            width: p.w,
            height: p.w * 1.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.75] }) },
              { translateX: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: space.lg, right: space.lg },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.raised,
  },
  celebrationRoot: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
  },
  celebrationCard: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.paper,
    borderRadius: radius.xl,
    padding: space.xxl,
    ...shadow.raised,
  },
});
