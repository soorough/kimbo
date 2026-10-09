import type { Achievement } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BadgeArt, BadgeEmblem, StreakFlame } from "@/components/BadgeArt";
import { ShareCard, ShareStreak } from "@/components/ShareStreak";
import { ErrorState, Icon, Screen, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { HABIT_BADGES, MEAL_BADGES, STREAK_BADGES } from "@/lib/badges";
import { colors, radius, shadow, space } from "@/lib/theme";

type Badge = {
  key: string;
  title: string;
  how: string;
  earned: boolean;
  /** shown on the locked card: what's left to do */
  left?: string;
  /** when it was earned, if Kimbo knows */
  on?: string;
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
  const [openBadge, setOpenBadge] = useState<Badge | null>(null);
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
  // Same streak as the 🔥 (one missed day allowed), so a 7 on the flame means Full week is earned.
  const best = Math.max(p.streak, p.longestStreak);
  const streak: Badge[] = STREAK_BADGES.map((b) => ({
    key: `s${b.days}`,
    title: b.title,
    how: `${b.days} day streak`,
    earned: best >= b.days,
    left: `${b.days - p.streak} more ${b.days - p.streak === 1 ? "day" : "days"} to go`,
    kind: "streak",
    number: b.days,
  }));
  const meals: Badge[] = MEAL_BADGES.map((b) => ({
    key: `m${b.meals}`,
    title: b.title,
    how: `Logged ${b.meals} meals`,
    earned: p.mealsLogged >= b.meals,
    left: `${b.meals - p.mealsLogged} more ${b.meals - p.mealsLogged === 1 ? "meal" : "meals"} to log`,
    kind: "meals",
    number: b.meals,
  }));
  const habits: Badge[] = HABIT_BADGES.map((b) => ({
    key: b.type,
    title: b.title,
    how: b.how,
    earned: got.has(b.type),
    left: `To earn it: ${b.how.charAt(0).toLowerCase()}${b.how.slice(1)}`,
    on: p.achievements.find((a) => a.type === b.type)?.unlockedAt,
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
          <BadgeEmblem count={earned} size={116} />
          <T variant="heading">Badges earned</T>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <T style={styles.emoji}>🔥</T>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">
              {best} {best === 1 ? "day" : "days"}
            </T>
            <T variant="caption">longest streak</T>
          </View>
        </View>
        <View style={styles.stat}>
          <T style={styles.emoji}>🏅</T>
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

      <Section title="Streaks" badges={streak} onOpen={setOpenBadge} />
      <Section title="Meals logged" badges={meals} onOpen={setOpenBadge} />
      <Section title="Habits" badges={habits} onOpen={setOpenBadge} />

      {openBadge ? (
        <ShareCard
          id={`badge-${openBadge.key}`}
          visible
          onClose={() => setOpenBadge(null)}
          art={
            <BadgeArt
              kind={openBadge.kind}
              earned={openBadge.earned}
              number={openBadge.number}
              icon={openBadge.icon}
              size={170}
              id={`big-${openBadge.key}`}
            />
          }
          title={openBadge.title}
          lines={[
            openBadge.how,
            ...(openBadge.earned && openBadge.on
              ? [
                  `Earned on ${new Date(openBadge.on).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`,
                ]
              : []),
          ]}
          locked={openBadge.earned ? undefined : openBadge.left}
        />
      ) : null}

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

function Section({ title, badges, onOpen }: { title: string; badges: Badge[]; onOpen: (b: Badge) => void }) {
  return (
    <View style={{ gap: space.md }}>
      <T variant="heading">{title}</T>
      <View style={styles.grid}>
        {badges.map((b) => (
          <Pressable
            key={b.key}
            style={({ pressed }) => [styles.cell, pressed && { transform: [{ scale: 0.95 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`${b.title}: ${b.earned ? "earned" : b.how}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onOpen(b);
            }}
          >
            <BadgeArt kind={b.kind} earned={b.earned} number={b.number} icon={b.icon} id={b.key} />
            <T variant="bodyStrong" align="center" style={!b.earned && { color: colors.inkSoft }}>
              {b.title}
            </T>
            <T variant="caption" align="center">
              {b.how}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Emoji glyphs are taller than letters: a generous line height stops Android clipping them.
  emoji: { fontSize: 22, lineHeight: 32, includeFontPadding: false, textAlignVertical: "center" },
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
