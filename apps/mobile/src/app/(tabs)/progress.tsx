import type { Diet, ProgressResponse, Report } from "@kimbo/shared";
import { useQueries, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { StatTiles, WeightChanges } from "@/components/BodyCards";
import { JourneyCard } from "@/components/JourneyCard";
import { CaloriesWeek } from "@/components/ProgressCharts";
import { RoadToGoal } from "@/components/RoadToGoal";
import { CardSkeleton, ProgressSkeleton } from "@/components/Skeleton";
import { WeightTrend } from "@/components/WeightTrend";
import { ErrorState, Icon, Screen, Surface, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

export default function Progress() {
  const profileId = useSession((state) => state.profileId);
  const progress = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  const journey = useQuery({ queryKey: ["journey"], queryFn: api.journey, retry: false });
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports });
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId!), enabled: !!profileId });
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
        <T variant="display">Progress</T>
      </View>

      <StatTiles p={p} />
      <BloodReportEntry report={reports.data?.reports[0]} focusTitle={p.focus?.title} loading={reports.isLoading} />
      {journey.data ? <JourneyCard /> : null}
      {journey.data ? <WeightTrend journey={journey.data} /> : null}
      {journey.data ? <WeightChanges journey={journey.data} /> : null}
      {journey.data ? <RoadToGoal journey={journey.data} /> : null}
      <CaloriesWeeks p={p} diet={profile.data?.profile.diet ?? null} />
    </Screen>
  );
}

function BloodReportEntry({ report, focusTitle, loading }: { report?: Report; focusTitle?: string; loading: boolean }) {
  if (loading) return <CardSkeleton h={104} />;
  const watching = report?.markers.filter((marker) => marker.status !== "in_range").length ?? 0;
  const result = report
    ? watching > 0
      ? `${watching} ${watching === 1 ? "number" : "numbers"} worth watching`
      : "Checked numbers in range"
    : "Turn your results into a food focus";
  return (
    <Surface onPress={() => router.push("/blood-report")} accessibilityLabel={report ? "Open blood report" : "Add a blood report"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" }}>
          <Icon name="file-text" size={22} color={colors.leafDeep} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading">Blood report</T>
          <T variant="label" tone="soft">{result}</T>
        </View>
        <Icon name="chevron-right" size={20} color={colors.inkFaint} />
      </View>
      {report && focusTitle ? <T variant="caption">Food focus: {focusTitle}</T> : null}
    </Surface>
  );
}

const WEEKS = ["This wk", "Last wk", "2 wk ago", "3 wk ago"];

/** The calories chart with Cal AI's week tabs: this week comes with Progress, earlier weeks load on tap. */
function CaloriesWeeks({ p, diet }: { p: ProgressResponse; diet: Diet | null }) {
  const [back, setBack] = useState(0);
  // Fetch the three visible choices together so switching weeks never displays stale bars.
  const history = useQueries({
    queries: [1, 2, 3].map((weeksBack) => {
      const weekOf = addDays(p.weekStart, -7 * weeksBack);
      return { queryKey: ["progress", weekOf], queryFn: () => api.progressFor(weekOf) };
    }),
  });
  const shown = back === 0 ? p : history[back - 1]?.data;
  return (
    <View style={{ gap: space.sm }}>
      {shown ? <CaloriesWeek p={shown} diet={diet} weekTabs={{ labels: WEEKS, selected: back, onSelect: setBack }} /> : <CardSkeleton h={300} />}
    </View>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
