import type { Achievement, KimboEventType, ProgressResponse } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { CaloriesWeek, FocusRing } from "@/components/ProgressCharts";
import { RoadToGoal } from "@/components/RoadToGoal";
import { ProgressSkeleton } from "@/components/Skeleton";
import { WeightTrend } from "@/components/WeightTrend";
import { ErrorState, Icon, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";

/** Every badge is visible from day one, so people know what's worth showing up for. */
const BADGES: { type: KimboEventType; icon: IconName; title: string; how: string }[] = [
  { type: "first_3_days", icon: "star", title: "First 3 days", how: "Log meals on 3 days" },
  { type: "first_full_week", icon: "calendar", title: "Full week", how: "Log 7 days in a row" },
  { type: "consistency_improved", icon: "trending-up", title: "Steadier week", how: "Log more days than last week" },
  { type: "focus_improved", icon: "target", title: "Focus up", how: "More meals help than last week" },
  { type: "welcome_back", icon: "heart", title: "Came back", how: "Return after a break" },
  { type: "first_weigh_in", icon: "activity", title: "First weigh-in", how: "Log your weight once" },
  { type: "on_target_3", icon: "sun", title: "3 on target", how: "3 days in a row on your kcal target" },
  { type: "on_target_7", icon: "award", title: "Week on target", how: "7 days in a row on target" },
  { type: "kg_progress", icon: "trending-down", title: "Kilogram closer", how: "Move 1 kg toward your goal" },
  { type: "halfway_to_goal", icon: "flag", title: "Halfway", how: "Get halfway to your goal weight" },
  { type: "goal_reached", icon: "check-circle", title: "Goal reached", how: "Reach your goal weight" },
];

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

      <Badges achievements={p.achievements} />
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

function Badges({ achievements }: { achievements: Achievement[] }) {
  const earned = (type: KimboEventType) => achievements.filter((a) => a.type === type);
  return (
    <View style={{ gap: space.md }}>
      <T variant="heading">Milestones</T>
      <View style={styles.badges}>
        {BADGES.map((b) => {
          const got = earned(b.type);
          const on = got.length > 0;
          return (
            <View
              key={b.type}
              style={[styles.badge, !on && styles.badgeLocked]}
              accessibilityLabel={`${b.title}: ${on ? "earned" : b.how}`}
            >
              <View style={[styles.badgeIcon, on ? styles.badgeIconOn : styles.badgeIconOff]}>
                <Icon name={on ? b.icon : "lock"} size={20} color={on ? colors.white : colors.inkFaint} />
                {got.length > 1 ? (
                  <View style={styles.badgeCount}>
                    <T variant="caption" tone="white">
                      ×{got.length}
                    </T>
                  </View>
                ) : null}
              </View>
              <T variant="label" align="center" style={{ color: on ? colors.ink : colors.inkFaint }}>
                {b.title}
              </T>
              <T variant="caption" align="center">
                {on ? new Date(got[0]!.unlockedAt).toLocaleDateString([], { day: "numeric", month: "short" }) : b.how}
              </T>
            </View>
          );
        })}
      </View>
    </View>
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
