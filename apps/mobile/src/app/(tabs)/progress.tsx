import type { Achievement, KimboEventType, ProgressResponse } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Bar, ErrorState, Icon, Loading, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Every badge is visible from day one, so people know what's worth showing up for. */
const BADGES: { type: KimboEventType; icon: IconName; title: string; how: string }[] = [
  { type: "first_3_days", icon: "star", title: "First 3 days", how: "Log meals on 3 days" },
  { type: "first_full_week", icon: "calendar", title: "Full week", how: "Log 7 days in a row" },
  { type: "consistency_improved", icon: "trending-up", title: "Steadier week", how: "Log more days than last week" },
  { type: "focus_improved", icon: "target", title: "Focus up", how: "More meals help than last week" },
  { type: "welcome_back", icon: "heart", title: "Came back", how: "Return after a break" },
];

export default function Progress() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  if (progress.isLoading)
    return (
      <Screen>
        <Loading />
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

      <WeekCard p={p} />
      {p.focus ? <FocusCard focus={p.focus} /> : null}

      <View style={styles.stats}>
        {p.goal && p.goal.daysTracked > 0 ? (
          <Stat
            icon="target"
            value={`${p.goal.daysMet}/${p.goal.daysTracked}`}
            label={`days within ${p.goal.bandPct}% of your kcal goal`}
          />
        ) : null}
        <Stat icon="check-circle" value={`${p.daysTracked}/${p.daysElapsed}`} label="days logged" />
      </View>

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

function WeekCard({ p }: { p: ProgressResponse }) {
  const tracked = new Set(p.trackedDates);
  const start = new Date(`${p.weekStart}T12:00:00Z`);
  return (
    <Surface>
      <View style={styles.week}>
        {DAY_LETTERS.map((letter, i) => {
          const d = new Date(start);
          d.setUTCDate(start.getUTCDate() + i);
          const iso = d.toISOString().slice(0, 10);
          const done = tracked.has(iso);
          const isToday = i === p.daysElapsed - 1;
          const future = i >= p.daysElapsed;
          return (
            <View
              key={iso}
              style={styles.dayCol}
              accessibilityLabel={`${iso}: ${done ? "tracked" : future ? "upcoming" : "not tracked"}`}
            >
              <T variant="caption" tone={isToday ? "leaf" : "faint"}>
                {letter}
              </T>
              <View
                style={[
                  styles.day,
                  done && styles.dayDone,
                  isToday && !done && styles.dayToday,
                  future && styles.dayFuture,
                ]}
              >
                {done ? <Icon name="check" size={16} color={colors.white} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      {p.streak >= 2 ? (
        <View style={styles.streak}>
          <Icon name="sun" size={18} color={colors.turmericDeep} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">{p.streak}-day consistency streak</T>
            <T variant="caption">Missing one day won't break it.</T>
          </View>
        </View>
      ) : (
        <T variant="label">Log a meal on two days in a row to start a streak.</T>
      )}
    </Surface>
  );
}

function FocusCard({ focus }: { focus: NonNullable<ProgressResponse["focus"]> }) {
  // Kimbo's sprout grows with the week's focus score: one leaf, up to five.
  const leaves = 1 + Math.round((focus.pct / 100) * 4);
  return (
    <Surface tint="leaf">
      <View style={styles.focusRow}>
        <Kimbo mood={focus.pct >= 50 ? "proud" : "focus"} size={72} leaves={leaves} />
        <View style={{ flex: 1, gap: 6 }}>
          <T variant="overline">THIS WEEK'S FOCUS</T>
          <T variant="heading">{focus.title}</T>
          <Bar value={focus.supported} max={Math.max(1, focus.total)} height={8} />
          <T variant="label">
            {focus.total
              ? `${focus.supported} of ${focus.total} meals helped · ${focus.pct}%`
              : "No meals yet this week"}
          </T>
        </View>
      </View>
    </Surface>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <Surface style={{ flex: 1 }}>
      <Icon name={icon} size={18} color={colors.leaf} />
      <T variant="number" style={{ fontSize: 24, lineHeight: 28 }}>
        {value}
      </T>
      <T variant="caption">{label}</T>
    </Surface>
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
  week: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 6 },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sunk,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDone: { backgroundColor: colors.leaf },
  dayToday: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.leaf },
  dayFuture: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderStyle: "dashed" },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.turmericSoft,
  },
  focusRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  stats: { flexDirection: "row", gap: space.md },
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
