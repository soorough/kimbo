import type { JourneyResponse } from "@kimbo/shared";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { colors, space } from "@/lib/theme";
import { formatWeight, useUnits } from "@/lib/units";
import { Kimbo } from "./Kimbo";
import { Ring } from "./Meter";
import { Surface } from "./Surface";
import { T } from "./Text";

const CELL = 14;
const GAP = 4;
const DAY_ROWS = ["M", "", "W", "", "F", "", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Day = JourneyResponse["calendar"][number];

/**
 * The whole run toward the goal weight: a contribution-style grid with one square per day
 * (columns are weeks, Monday on top), the goal ring beside it, and current/best streaks.
 */
export function RoadToGoal({ journey }: { journey: JourneyResponse }) {
  const unit = useUnits((u) => u.weight);
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  // Fill the card: a short history is followed by the weeks still ahead, drawn as dashed squares.
  const weeks = toWeeks(journey.calendar, Math.floor(width / (CELL + GAP)));
  const logged = journey.calendar.filter((d) => d.status !== "empty").length;
  const title =
    journey.targetKg !== null ? `Road to ${formatWeight(journey.targetKg, unit)}` : "Your streak";

  return (
    <Surface accessibilityLabel={`${title}. ${journey.pct ?? 0}% there. ${logged} days logged.`}>
      <T variant="overline" tone="soft">{title.toUpperCase()}</T>

      <View style={styles.top}>
        {journey.pct !== null ? (
          <Ring value={journey.pct} max={100} size={96} stroke={10} track="rgba(46,107,79,0.14)">
            <Kimbo mood={journey.pct >= 50 ? "proud" : "idle"} size={46} leaves={1 + Math.round(journey.pct / 25)} />
          </Ring>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          {journey.pct !== null ? (
            <>
              <T variant="number" style={styles.big}>
                {journey.pct}%<T variant="label"> there</T>
              </T>
              <T variant="label">
                {journey.kgToGo ? `${formatWeight(journey.kgToGo, unit)} to go` : "Goal reached"}
                {journey.pct >= 50 && journey.pct < 100 ? " · Halfway there" : ""}
              </T>
            </>
          ) : (
            <T variant="number" style={styles.big}>
              {logged}
              <T variant="label"> {logged === 1 ? "day" : "days"} logged</T>
            </T>
          )}
          <T variant="caption">
            Streak {journey.onTargetStreak} · Best {journey.bestOnTargetStreak} on target
          </T>
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.dayLabels}>
          {DAY_ROWS.map((l, i) => (
            <T key={i} variant="caption" style={styles.dayLabel}>
              {l}
            </T>
          ))}
        </View>
        <ScrollView
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <View style={styles.months}>
              {weeks.map((w, i) => (
                <View key={i} style={{ width: CELL + GAP }}>
                  {w.month ? (
                    <T variant="caption" style={styles.month} numberOfLines={1}>
                      {w.month}
                    </T>
                  ) : null}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: GAP }}>
              {weeks.map((w, i) => (
                <View key={i} style={{ gap: GAP }}>
                  {w.days.map((d, j) => (
                    <View
                      key={j}
                      style={[
                        styles.cell,
                        d === null ? styles.blank : d === "ahead" ? styles.ahead : CELL_STYLE[d.status],
                        d !== null && d !== "ahead" && d.date === journey.calendar.at(-1)?.date && styles.today,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.legend}>
        <Legend style={styles.empty} label="Nothing" />
        <Legend style={styles.logged} label="Logged" />
        <Legend style={styles.onTarget} label="On target" />
      </View>
    </Surface>
  );
}

function Legend({ style, label }: { style: object; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.cell, style]} />
      <T variant="caption">{label}</T>
    </View>
  );
}

type Cell = Day | "ahead" | null;

/**
 * Lays the run out in Monday–Sunday columns, then pads with days still ahead until there
 * are at least `minWeeks` columns. Month labels sit on a month's first column, spaced so
 * neighbouring labels never collide.
 */
function toWeeks(calendar: Day[], minWeeks: number): { month: string | null; days: Cell[] }[] {
  if (!calendar.length) return [];
  const dateOf = (i: number) => {
    const d = new Date(`${calendar[0]!.date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  };
  const lead = (new Date(`${calendar[0]!.date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: Cell[] = [...Array<Cell>(lead).fill(null), ...calendar];
  while (cells.length % 7 || cells.length / 7 < minWeeks) cells.push("ahead");

  const weeks: { month: string | null; days: Cell[] }[] = [];
  let lastMonth = -1;
  let sinceLabel = 99;
  for (let i = 0; i < cells.length; i += 7) {
    const firstIndex = Math.max(0, i - lead);
    const m = Number(dateOf(firstIndex).slice(5, 7)) - 1;
    const label = m !== lastMonth && sinceLabel >= 3;
    weeks.push({ month: label ? MONTHS[m]! : null, days: cells.slice(i, i + 7) });
    if (label) {
      lastMonth = m;
      sinceLabel = 0;
    }
    sinceLabel++;
  }
  return weeks;
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.lg, marginVertical: space.sm },
  big: { fontSize: 30, lineHeight: 36 },
  gridRow: { flexDirection: "row", gap: 6 },
  dayLabels: { gap: GAP, paddingTop: 18 },
  dayLabel: { height: CELL, fontSize: 10, lineHeight: CELL, color: colors.inkSoft },
  months: { flexDirection: "row", height: 18 },
  month: { fontSize: 11, lineHeight: 14, width: 40, color: colors.inkSoft, fontWeight: "600" },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  blank: { backgroundColor: "transparent" },
  // Steps that stay visible on a white card (empty 1.6:1, dashes 2.4:1 against white).
  ahead: { borderWidth: 1, borderColor: "#B8A68A", borderStyle: "dashed" },
  empty: { backgroundColor: "#DDCDB4" },
  logged: { backgroundColor: "#F0C47E" },
  onTarget: { backgroundColor: colors.turmeric },
  today: { borderWidth: 1.5, borderColor: colors.ink },
  legend: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
});

const CELL_STYLE = { empty: styles.empty, logged: styles.logged, on_target: styles.onTarget };

