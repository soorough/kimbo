import type { ProgressResponse } from "@kimbo/shared";
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { colors, radius, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { Kimbo } from "./Kimbo";
import { Ring } from "./Meter";
import { Surface } from "./Surface";
import { T } from "./Text";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const CHART_H = 132;

type DayState = "on" | "over" | "under" | "empty" | "ahead";

function dayState(calories: number | null, goal: ProgressResponse["goal"]): DayState {
  if (calories === null) return "ahead";
  if (calories === 0) return "empty";
  if (!goal) return "on";
  const band = (goal.targetCalories * goal.bandPct) / 100;
  if (calories > Math.round(goal.targetCalories + band)) return "over";
  if (calories < Math.round(goal.targetCalories - band)) return "under";
  return "on";
}

/**
 * The week in calories: one bar per day against the target band. On-target days fill
 * turmeric (a small celebration), days over the band go plum (worth watching, never red),
 * lighter days stay quiet. Today is outlined because it is still going.
 */
export function CaloriesWeek({ p, current = true }: { p: ProgressResponse; current?: boolean }) {
  const [w, setW] = useState(0);
  const goal = p.goal;
  const todayIndex = current ? p.daysElapsed - 1 : -1;
  const top =
    Math.max(goal ? goal.targetCalories * (1 + goal.bandPct / 100) * 1.12 : 0, ...p.days.map((d) => d.calories ?? 0)) ||
    1;
  const y = (kcal: number) => CHART_H - (kcal / top) * CHART_H;
  const slot = w / 7;
  const barW = Math.min(26, slot * 0.58);

  const fill: Record<DayState, string> = {
    on: colors.turmeric,
    over: colors.plum,
    under: "rgba(227,155,45,0.38)",
    empty: "transparent",
    ahead: "transparent",
  };

  const { summary, hint } = caloriesCopy(p, current);
  const logged = p.days.filter((d) => (d.calories ?? 0) > 0);
  const average = logged.length
    ? Math.round(logged.reduce((sum, d) => sum + d.calories!, 0) / logged.length)
    : null;

  return (
    <Surface tint="turmeric" accessibilityLabel={`Calories this week. ${summary}. ${hint ?? ""}`}>
      <T variant="overline" tone="soft">
        CALORIES
      </T>
      <T variant="heading">{summary}</T>
      {average !== null ? (
        <T variant="label">Daily average {average.toLocaleString("en-IN")} kcal</T>
      ) : null}
      {hint ? <T variant="caption">{hint}</T> : null}
      <View style={{ height: CHART_H, marginTop: space.sm }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <Svg width={w} height={CHART_H}>
            {goal ? (
              <>
                {/* the ±band around the target, then the target itself */}
                <Rect
                  x={0}
                  width={w}
                  y={y(goal.targetCalories * (1 + goal.bandPct / 100))}
                  height={y(goal.targetCalories * (1 - goal.bandPct / 100)) - y(goal.targetCalories * (1 + goal.bandPct / 100))}
                  fill="rgba(143,90,11,0.08)"
                  rx={6}
                />
                <Line
                  x1={0}
                  x2={w}
                  y1={y(goal.targetCalories)}
                  y2={y(goal.targetCalories)}
                  stroke={colors.turmericDeep}
                  strokeWidth={1.5}
                  strokeDasharray="4 5"
                />
              </>
            ) : null}
            {p.days.map((d, i) => {
              const state = dayState(d.calories, goal);
              const x = slot * i + (slot - barW) / 2;
              if (state === "empty" || state === "ahead") {
                // a stub so the day still has a place on the chart
                return (
                  <Rect
                    key={d.date}
                    x={x}
                    y={CHART_H - 6}
                    width={barW}
                    height={6}
                    rx={3}
                    fill={state === "empty" ? "rgba(35,32,27,0.12)" : "none"}
                    stroke={state === "ahead" ? "rgba(35,32,27,0.18)" : "none"}
                    strokeDasharray="3 3"
                  />
                );
              }
              const h = Math.max(8, CHART_H - y(d.calories!));
              return (
                <Rect
                  key={d.date}
                  x={x}
                  y={CHART_H - h}
                  width={barW}
                  height={h}
                  rx={Math.min(8, barW / 2)}
                  fill={fill[state]}
                  stroke={i === todayIndex ? colors.ink : "none"}
                  strokeWidth={i === todayIndex ? 2 : 0}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.letters}>
        {DAY_LETTERS.map((l, i) => (
          <T key={i} variant="caption" align="center" tone={i === todayIndex ? "ink" : "faint"} style={{ flex: 1 }}>
            {l}
          </T>
        ))}
      </View>
      {goal ? (
        <View style={styles.legend}>
          <Legend color={colors.turmeric} label="On target" />
          <Legend color={colors.plum} label="Over" />
          <View style={styles.legendItem}>
            <View style={styles.dash} />
            <T variant="caption">{goal.targetCalories.toLocaleString("en-IN")} kcal</T>
          </View>
        </View>
      ) : null}
    </Surface>
  );
}

const plural = (n: number) => (n === 1 ? "day" : "days");

/** Today only counts toward the goal once it lands in the band, so early in the week there may be nothing to score yet. */
function caloriesCopy(p: ProgressResponse, current: boolean): { summary: string; hint?: string } {
  const goal = p.goal;
  if (p.daysTracked === 0)
    return current
      ? { summary: "Your week starts with one meal", hint: "Each day you log gets a bar here." }
      : { summary: "Nothing logged this week" };
  if (!current && (!goal || goal.daysTracked === 0))
    return { summary: `${p.daysTracked} of 7 ${plural(7)} logged` };
  if (!goal) return { summary: `${p.daysTracked} of ${p.daysElapsed} ${plural(p.daysElapsed)} logged` };
  if (goal.daysTracked > 0)
    return { summary: `${goal.daysMet} of ${goal.daysTracked} ${plural(goal.daysTracked)} on target` };
  const today = p.days[p.daysElapsed - 1]?.calories ?? 0;
  const target = goal.targetCalories.toLocaleString("en-IN");
  return {
    summary: `${today.toLocaleString("en-IN")} of ${target} kcal today`,
    hint: `Land within ${goal.bandPct}% of your target and today counts.`,
  };
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <T variant="caption">{label}</T>
    </View>
  );
}

/** This week's focus as a ring Kimbo sits in; the sprout grows with the score. */
export function FocusRing({ focus }: { focus: NonNullable<ProgressResponse["focus"]> }) {
  const leaves = 1 + Math.round((focus.pct / 100) * 4);
  return (
    <Surface
      tint="leaf"
      accessibilityLabel={`Focus: ${focus.title}. ${focus.supported} of ${focus.total} meals helped.`}
    >
      <View style={styles.cardHead}>
        <Icon name="target" size={16} color={colors.leaf} />
        <T variant="overline" tone="soft">
          FOCUS
        </T>
      </View>
      <View style={{ alignItems: "center", marginVertical: 2 }}>
        <Ring value={focus.supported} max={Math.max(1, focus.total)} size={92} stroke={10} track="rgba(46,107,79,0.16)">
          <Kimbo mood={focus.pct >= 50 ? "proud" : "focus"} size={50} leaves={leaves} />
        </Ring>
      </View>
      <T variant="label" numberOfLines={2}>
        {focus.title}
      </T>
      <T variant="caption">{focus.total ? `${focus.supported} of ${focus.total} meals helped` : "Log a meal to see if it helps"}</T>
    </Surface>
  );
}

const styles = StyleSheet.create({
  letters: { flexDirection: "row" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  dash: { width: 14, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.turmericDeep },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
});
