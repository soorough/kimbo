import type { Achievement } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { ErrorState, Icon, Screen, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { HABIT_BADGES, MEAL_BADGES, STREAK_BADGES } from "@/lib/badges";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";

type Badge = {
  key: string;
  title: string;
  how: string;
  earned: boolean;
  face: { emoji?: string; icon?: IconName; number?: number };
};

/**
 * Milestones, Cal AI-style: the day streak and badges earned up top, the longest streak and
 * progress to all badges, then every badge, greyed until earned. Opened from the 🔥 on Today.
 */
export default function Milestones() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  if (!progress.data) {
    return (
      <Screen>
        {progress.error ? (
          <ErrorState message={errorMessage(progress.error)} onRetry={() => progress.refetch()} />
        ) : null}
      </Screen>
    );
  }
  const p = progress.data;
  const got = new Set<Achievement["type"]>(p.achievements.map((a) => a.type));
  const streak: Badge[] = STREAK_BADGES.map((b) => ({
    key: `s${b.days}`,
    title: b.title,
    how: `${b.days} day streak`,
    earned: p.longestStreak >= b.days,
    face: { emoji: "🔥", number: b.days },
  }));
  const meals: Badge[] = MEAL_BADGES.map((b) => ({
    key: `m${b.meals}`,
    title: b.title,
    how: `Logged ${b.meals} meals`,
    earned: p.mealsLogged >= b.meals,
    face: { emoji: "🍛", number: b.meals },
  }));
  const habits: Badge[] = HABIT_BADGES.map((b) => ({
    key: b.type,
    title: b.title,
    how: b.how,
    earned: got.has(b.type),
    face: { icon: b.icon },
  }));
  const all = [...streak, ...meals, ...habits];
  const earned = all.filter((b) => b.earned).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.round}
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
      </View>
      <T variant="display">Milestones</T>

      <View style={styles.heroRow}>
        <View style={styles.hero}>
          <Flame count={p.streak} />
          <T variant="heading">Day streak</T>
        </View>
        <View style={styles.hero}>
          <View style={styles.medal}>
            <Kimbo mood={earned > 0 ? "proud" : "idle"} size={54} leaves={Math.min(5, 1 + earned)} />
            <View style={styles.medalCount}>
              <T style={styles.medalNum}>{earned}</T>
            </View>
          </View>
          <T variant="heading">Badges earned</T>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <T style={{ fontSize: 22 }}>🔥</T>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">
              {p.longestStreak} {p.longestStreak === 1 ? "day" : "days"}
            </T>
            <T variant="caption">longest streak</T>
          </View>
        </View>
        <View style={styles.stat}>
          <T style={{ fontSize: 22 }}>🏅</T>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="bodyStrong">
              {earned}/{all.length} badges
            </T>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${(earned / all.length) * 100}%` }]} />
            </View>
          </View>
        </View>
      </View>

      <Section title="Streaks" badges={streak} />
      <Section title="Meals logged" badges={meals} />
      <Section title="Habits" badges={habits} />
    </Screen>
  );
}

/** The streak count sits on a flame that flickers while the streak is alive. */
function Flame({ count }: { count: number }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (count === 0 || still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [count, still, v]);
  return (
    <View style={styles.flameWrap}>
      <Animated.View
        style={{
          opacity: count > 0 ? 1 : 0.45,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        }}
      >
        <T style={styles.flame}>🔥</T>
      </Animated.View>
      <T style={styles.flameNum}>{count}</T>
    </View>
  );
}

function Section({ title, badges }: { title: string; badges: Badge[] }) {
  return (
    <View style={{ gap: space.md }}>
      <T variant="heading">{title}</T>
      <View style={styles.grid}>
        {badges.map((b) => (
          <View key={b.key} style={styles.cell} accessibilityLabel={`${b.title}: ${b.earned ? "earned" : b.how}`}>
            <View style={[styles.badge, b.earned ? styles.badgeOn : styles.badgeOff]}>
              {b.face.emoji ? (
                <T style={[styles.badgeEmoji, !b.earned && styles.greyed]}>{b.face.emoji}</T>
              ) : (
                <View style={styles.unrotate}>
                  <Icon
                    name={b.face.icon ?? "star"}
                    size={26}
                    color={b.earned ? colors.turmericDeep : colors.inkFaint}
                  />
                </View>
              )}
              {b.face.number !== undefined ? (
                <T style={[styles.badgeNum, { color: b.earned ? colors.turmericDeep : colors.inkFaint }]}>
                  {b.face.number}
                </T>
              ) : null}
            </View>
            <T variant="bodyStrong" align="center" style={!b.earned && { color: colors.inkSoft }}>
              {b.title}
            </T>
            <T variant="caption" align="center">
              {b.how}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", marginTop: space.sm },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  heroRow: { flexDirection: "row", gap: space.md },
  hero: { flex: 1, alignItems: "center", gap: space.sm },
  flameWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  flame: { fontSize: 84, lineHeight: 100 },
  flameNum: {
    position: "absolute",
    bottom: -2,
    minWidth: 40,
    paddingHorizontal: space.sm,
    borderRadius: 16,
    overflow: "hidden",
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 30,
    color: colors.white,
    backgroundColor: colors.ink,
  },
  medal: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.turmericSoft,
  },
  medalCount: {
    position: "absolute",
    bottom: 0,
    minWidth: 40,
    paddingHorizontal: space.sm,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  medalNum: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  statRow: { flexDirection: "row", gap: space.md },
  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.sunk, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.turmeric },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.lg },
  cell: { width: "33.333%", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  badgeOn: { backgroundColor: colors.turmericSoft, borderWidth: 2, borderColor: colors.turmeric },
  badgeOff: { backgroundColor: colors.sunk },
  badgeEmoji: { fontSize: 26, lineHeight: 32, transform: [{ rotate: "-45deg" }] },
  badgeNum: { fontFamily: fonts.bold, fontSize: 14, transform: [{ rotate: "-45deg" }] },
  greyed: { opacity: 0.3 },
  unrotate: { transform: [{ rotate: "-45deg" }] },
});
