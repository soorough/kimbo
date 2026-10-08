import type { Achievement } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BadgeArt, StreakFlame } from "@/components/BadgeArt";
import { Kimbo } from "@/components/Kimbo";
import { ShareStreak } from "@/components/ShareStreak";
import { ErrorState, Icon, Screen, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { HABIT_BADGES, MEAL_BADGES, STREAK_BADGES } from "@/lib/badges";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";

type Badge = {
  key: string;
  title: string;
  how: string;
  earned: boolean;
  kind: "streak" | "meals" | "habit";
  number?: number;
  icon?: IconName;
};

/** The day the current streak began: walk back from today, allowing one missed day at a time. */
function streakStart(logged: Set<string>, streak: number): string | null {
  if (streak === 0) return null;
  const d = new Date();
  let start: string | null = null;
  let gap = 0;
  for (let i = 0; i < 1000; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (logged.has(iso)) {
      start = iso;
      gap = 0;
    } else if (i > 0 && ++gap >= 2) break;
    d.setDate(d.getDate() - 1);
  }
  return start;
}

/**
 * Milestones, Cal AI-style: the day streak and badges earned up top, the longest streak and
 * progress to all badges, then every badge, greyed until earned. Opened from the 🔥 on Today.
 */
export default function Milestones() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  const journey = useQuery({ queryKey: ["journey"], queryFn: api.journey, retry: false });
  const [sharing, setSharing] = useState(false);
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
    kind: "streak",
    number: b.days,
  }));
  const meals: Badge[] = MEAL_BADGES.map((b) => ({
    key: `m${b.meals}`,
    title: b.title,
    how: `Logged ${b.meals} meals`,
    earned: p.mealsLogged >= b.meals,
    kind: "meals",
    number: b.meals,
  }));
  const habits: Badge[] = HABIT_BADGES.map((b) => ({
    key: b.type,
    title: b.title,
    how: b.how,
    earned: got.has(b.type),
    kind: "habit",
    icon: b.icon,
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
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share your streak"
          hitSlop={12}
          onPress={() => setSharing(true)}
          style={styles.round}
        >
          <Icon name="share" size={20} />
        </Pressable>
      </View>
      <T variant="display">Milestones</T>

      <View style={styles.heroRow}>
        <View style={styles.hero}>
          <StreakFlame count={p.streak} size={116} id="hero" />
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

      <ShareStreak
        visible={sharing}
        onClose={() => setSharing(false)}
        streak={p.streak}
        startedOn={streakStart(
          new Set([
            ...(journey.data?.calendar.filter((d) => d.status !== "empty").map((d) => d.date) ?? []),
            ...p.trackedDates,
          ]),
          p.streak,
        )}
      />
    </Screen>
  );
}

function Section({ title, badges }: { title: string; badges: Badge[] }) {
  return (
    <View style={{ gap: space.md }}>
      <T variant="heading">{title}</T>
      <View style={styles.grid}>
        {badges.map((b) => (
          <View key={b.key} style={styles.cell} accessibilityLabel={`${b.title}: ${b.earned ? "earned" : b.how}`}>
            <BadgeArt kind={b.kind} earned={b.earned} number={b.number} icon={b.icon} id={b.key} />
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
});
