import type { Achievement, KimboEventType, ProgressResponse } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { JourneyCard } from "@/components/JourneyCard";
import { CaloriesWeek, FocusRing } from "@/components/ProgressCharts";
import { RoadToGoal } from "@/components/RoadToGoal";
import { ProgressSkeleton } from "@/components/Skeleton";
import { WeightTrend } from "@/components/WeightTrend";
import { ErrorState, Icon, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { HABIT_BADGES, MEAL_BADGES, STREAK_BADGES } from "@/lib/badges";
import { colors, radius, space } from "@/lib/theme";

export default function Progress() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  const journey = useQuery({ queryKey: ["journey"], queryFn: api.journey, retry: false });
  if (progress.isLoading)
    return (
      <Screen>
        <ProgressSkeleton />
      </Screen>
    );
  if (progress.error || !progress.data) {
    return (
      <Screen>
        <ErrorState message={errorMessage(progress.error)} onRetry={() => progress.refetch()} />
      </Screen>
    );
  }
  const p = progress.data;

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: space.sm }}>
        <T variant="overline" tone="faint">
          {rangeLabel(p)}
        </T>
        <T variant="display">This week</T>
      </View>

      {/* The goal and "Log weight" live here now that Today follows the day, not the journey. */}
      {journey.data ? <JourneyCard /> : null}
      {journey.data ? <RoadToGoal journey={journey.data} /> : null}
      <CaloriesWeek p={p} />
      {p.focus ? <FocusRing focus={p.focus} /> : null}
      {journey.data ? <WeightTrend journey={journey.data} /> : null}

      <WeekOverWeek p={p} />

      {p.insights.length ? (
        <Surface tint="sunk">
          <T variant="overline" tone="soft">
            PATTERNS
          </T>
          {p.insights.map((i) => (
            <View key={i} style={styles.insight}>
              <Icon name="zap" size={16} color={colors.turmericDeep} />
              <T variant="body" style={{ flex: 1 }}>
                {i}
              </T>
            </View>
          ))}
        </Surface>
      ) : null}

      <MilestonesRow p={p} />
    </Screen>
  );
}

/** Only celebrates gains; a quieter week is simply not mentioned. */
function WeekOverWeek({ p }: { p: ProgressResponse }) {
  const w = p.weekOverWeek;
  const lines: string[] = [];
  if (w.daysTracked && w.daysTracked > 0)
    lines.push(`${w.daysTracked} more day${w.daysTracked === 1 ? "" : "s"} tracked than last week`);
  if (w.goalDaysMet && w.goalDaysMet > 0)
    lines.push(`${w.goalDaysMet} more goal day${w.goalDaysMet === 1 ? "" : "s"} than last week`);
  if (w.focusPct && w.focusPct > 0) lines.push(`Focus up ${w.focusPct} points from last week`);
  if (!lines.length) return null;
  return (
    <Surface tint="turmeric">
      {lines.map((l) => (
        <View key={l} style={styles.insight}>
          <Icon name="arrow-up-right" size={16} color={colors.turmericDeep} />
          <T variant="bodyStrong" style={{ flex: 1 }}>
            {l}
          </T>
        </View>
      ))}
    </Surface>
  );
}

/** All badges live on the Milestones screen; Progress just shows the count and the next one. */
function MilestonesRow({ p }: { p: ProgressResponse }) {
  const earned =
    new Set(p.achievements.map((a) => a.type)).size +
    STREAK_BADGES.filter((b) => p.longestStreak >= b.days).length +
    MEAL_BADGES.filter((b) => p.mealsLogged >= b.meals).length;
  const total = HABIT_BADGES.length + STREAK_BADGES.length + MEAL_BADGES.length;
  const next = STREAK_BADGES.find((b) => b.days > p.streak);
  return (
    <Surface onPress={() => router.push("/milestones")} accessibilityLabel={`Milestones, ${earned} of ${total} badges`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <T style={{ fontSize: 30, lineHeight: 36 }}>🏅</T>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading">Milestones</T>
          <T variant="label">
            {earned} of {total} badges
            {next
              ? ` · ${next.days - p.streak} more ${next.days - p.streak === 1 ? "day" : "days"} for ${next.title}`
              : ""}
          </T>
        </View>
        <Icon name="chevron-right" size={20} color={colors.inkFaint} />
      </View>
    </Surface>
  );
}

function rangeLabel(p: ProgressResponse): string {
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });
  return `${fmt(p.weekStart)} – ${fmt(p.weekEnd)}`.toUpperCase();
}

const styles = StyleSheet.create({
  insight: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  // Fixed thirds so a partial last row keeps the same badge size.
  badge: {
    width: "31%",
    alignItems: "center",
    gap: 4,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  badgeLocked: { backgroundColor: colors.sunk },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  badgeIconOn: { backgroundColor: colors.turmericDeep },
  badgeIconOff: { backgroundColor: colors.paper },
  badgeCount: {
    position: "absolute",
    right: -6,
    top: -4,
    backgroundColor: colors.leaf,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
  },
});
