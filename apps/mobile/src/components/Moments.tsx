import type { KimboEvent } from "@kimbo/shared";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { colors, radius, space } from "@/lib/theme";
import { Kimbo, type KimboMood } from "./Kimbo";

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

const MILESTONES = new Set<KimboEvent["type"]>(["first_3_days", "first_full_week", "consistency_improved", "focus_improved"]);

interface MomentsState {
  queue: KimboEvent[];
  push: (events: KimboEvent[]) => void;
  shift: () => void;
}

/** Queue of Kimbo moments returned by the API; shown one at a time, never blocking the flow. */
export const useMoments = create<MomentsState>((set) => ({
  queue: [],
  push: (events) => set((s) => ({ queue: [...s.queue, ...events] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

export function MomentToast() {
  const current = useMoments((s) => s.queue[0]);
  const shift = useMoments((s) => s.shift);
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(160)).current;

  useEffect(() => {
    if (!current) return;
    const feedback = MILESTONES.has(current.type)
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedback.catch(() => {});
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    const timer = setTimeout(() => {
      Animated.timing(y, { toValue: 160, duration: 220, useNativeDriver: true }).start(() => shift());
    }, MILESTONES.has(current.type) ? 3200 : 2400);
    return () => clearTimeout(timer);
  }, [current, shift, y]);

  if (!current) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 72, transform: [{ translateY: y }] }]}
    >
      <Pressable onPress={shift} style={[styles.toast, MILESTONES.has(current.type) && styles.milestone]}>
        <Kimbo mood={MOOD[current.type]} size={48} />
        <Text style={styles.text}>{current.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.lg, right: space.lg },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  milestone: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  text: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
});
