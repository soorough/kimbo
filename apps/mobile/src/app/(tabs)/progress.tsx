import type { ProgressResponse } from "@kimbo/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { StatTiles, WeightChanges } from "@/components/BodyCards";
import { JourneyCard } from "@/components/JourneyCard";
import { CaloriesWeek } from "@/components/ProgressCharts";
import { RoadToGoal } from "@/components/RoadToGoal";
import { CardSkeleton, ProgressSkeleton } from "@/components/Skeleton";
import { WeightTrend } from "@/components/WeightTrend";
import { ErrorState, Icon, Screen, Surface, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
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

  // Body and habits live here; health (BMI, the report's food focus) lives on Report.
  return (
    <Screen>
      <View style={{ gap: 2, marginTop: space.sm }}>
        <T variant="overline" tone="faint">
          {rangeLabel(p)}
        </T>
        <T variant="display">Progress</T>
      </View>

      <StatTiles p={p} />
      {journey.data ? <JourneyCard /> : null}
      {journey.data ? <WeightTrend journey={journey.data} /> : null}
      {journey.data ? <WeightChanges journey={journey.data} /> : null}
      {journey.data ? <RoadToGoal journey={journey.data} /> : null}
      <CaloriesWeeks p={p} />

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
    </Screen>
  );
}

const WEEKS = ["This wk", "Last wk", "2 wk ago", "3 wk ago"];

/** The calories chart with Cal AI's week tabs: this week comes with Progress, earlier weeks load on tap. */
function CaloriesWeeks({ p }: { p: ProgressResponse }) {
  const [back, setBack] = useState(0);
  const weekOf = addDays(p.weekStart, -7 * back);
  const past = useQuery({
    queryKey: ["progress", weekOf],
    queryFn: () => api.progressFor(weekOf),
    enabled: back > 0,
    placeholderData: keepPreviousData,
  });
  const shown = back === 0 ? p : past.data;
  return (
    <View style={{ gap: space.sm }}>
      {shown ? <CaloriesWeek p={shown} current={back === 0} /> : <CardSkeleton h={260} />}
      <View style={styles.weeks}>
        {WEEKS.map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: i === back }}
            onPress={() => setBack(i)}
            style={[styles.week, i === back && styles.weekOn]}
          >
            <T variant="label" tone={i === back ? "ink" : "faint"}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

function rangeLabel(p: ProgressResponse): string {
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });
  return `${fmt(p.weekStart)} – ${fmt(p.weekEnd)}`.toUpperCase();
}

const styles = StyleSheet.create({
  insight: { flexDirection: "row", alignItems: "center", gap: space.sm },
  weeks: { flexDirection: "row", backgroundColor: colors.sunk, borderRadius: radius.pill, padding: 3 },
  week: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: radius.pill },
  weekOn: { backgroundColor: colors.surface },
});
