import type { ProgressResponse } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Card, ErrorState, Loading, ProgressBar, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { colors, font, radius, space } from "@/lib/theme";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Progress() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  if (progress.isLoading) return <Screen><Loading /></Screen>;
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
      <Text style={font.title}>This week</Text>

      <Card>
        <View style={styles.row}>
          <Kimbo mood={p.daysTracked >= 3 ? "cheer" : p.daysTracked > 0 ? "happy" : "idle"} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.big}>
              {p.daysTracked} <Text style={font.small}>/ 7 days tracked</Text>
            </Text>
            {p.streak >= 2 ? <Text style={font.body}>🔥 {p.streak}-day consistency streak</Text> : null}
          </View>
        </View>
        <WeekDots p={p} />
      </Card>

      {p.focus ? (
        <Card>
          <Text style={font.h2}>
            {p.focus.title}: {p.focus.pct}%
          </Text>
          <ProgressBar value={p.focus.supported} max={Math.max(1, p.focus.total)} />
          <Text style={font.small}>
            {p.focus.supported} of {p.focus.total} meals supported your focus
          </Text>
        </Card>
      ) : null}

      {p.goal && p.goal.daysTracked > 0 ? (
        <Card>
          <Text style={font.h2}>
            {p.goal.daysMet} of {p.goal.daysTracked} tracked days near your goal
          </Text>
          <Text style={font.small}>Within ±{p.goal.bandPct}% of your daily calorie target.</Text>
        </Card>
      ) : null}

      <WeekOverWeek p={p} />

      {p.insights.length ? (
        <Card>
          <Text style={font.h2}>Patterns</Text>
          {p.insights.map((i) => (
            <Text key={i} style={font.body}>• {i}</Text>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={font.h2}>Milestones</Text>
        {p.achievements.length === 0 ? (
          <Text style={font.small}>Your first milestone comes after 3 days of tracking.</Text>
        ) : (
          p.achievements.map((a) => (
            <View key={a.key} style={styles.row}>
              <Text style={styles.badge}>✦</Text>
              <Text style={[font.body, { flex: 1 }]}>{a.title}</Text>
              <Text style={font.small}>{new Date(a.unlockedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</Text>
            </View>
          ))
        )}
      </Card>

      <Text style={[font.small, { textAlign: "center" }]}>Progress rewards showing up — not perfection.</Text>
    </Screen>
  );
}

function WeekDots({ p }: { p: ProgressResponse }) {
  const tracked = new Set(p.trackedDates);
  const start = new Date(`${p.weekStart}T12:00:00Z`);
  return (
    <View style={styles.dots}>
      {DAY_LETTERS.map((letter, i) => {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const iso = d.toISOString().slice(0, 10);
        const done = tracked.has(iso);
        const future = i >= p.daysElapsed;
        return (
          <View key={iso} style={{ alignItems: "center", gap: 4 }}>
            <View style={[styles.dot, done && styles.dotDone, future && styles.dotFuture]} />
            <Text style={font.small}>{letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Only celebrates gains; a quieter week is shown neutrally, never as a loss. */
function WeekOverWeek({ p }: { p: ProgressResponse }) {
  const lines: string[] = [];
  const w = p.weekOverWeek;
  if (w.daysTracked && w.daysTracked > 0) lines.push(`+${w.daysTracked} day${w.daysTracked === 1 ? "" : "s"} tracked vs last week`);
  if (w.goalDaysMet && w.goalDaysMet > 0) lines.push(`+${w.goalDaysMet} goal day${w.goalDaysMet === 1 ? "" : "s"} vs last week`);
  if (w.focusPct && w.focusPct > 0) lines.push(`Focus up ${w.focusPct} points from last week`);
  if (!lines.length) return null;
  return (
    <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
      {lines.map((l) => (
        <Text key={l} style={[font.body, { fontWeight: "600" }]}>↑ {l}</Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  big: { fontSize: 32, fontWeight: "800", color: colors.text },
  dots: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotFuture: { borderStyle: "dashed" },
  badge: { fontSize: 18, color: colors.accent, width: 24, textAlign: "center", borderRadius: radius.pill },
});
