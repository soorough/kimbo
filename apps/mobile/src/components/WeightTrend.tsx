import type { JourneyResponse } from "@kimbo/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, ClipPath, Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors, radius, space } from "@/lib/theme";
import { formatWeight, useUnits } from "@/lib/units";
import { useDrawProgress } from "./GoalPath";
import { Surface } from "./Surface";
import { T } from "./Text";

const H = 140;
const PAD = 12;

const RANGES = [
  { label: "90D", days: 90 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
] as const;
type RangeLabel = (typeof RANGES)[number]["label"];

/** Weigh-ins over time as a filled line, with the goal weight dashed. Needs at least two points. */
export function WeightTrend({ journey }: { journey: JourneyResponse }) {
  const unit = useUnits((u) => u.weight);
  const [w, setW] = useState(0);
  const [range, setRange] = useState<RangeLabel>("90D");
  const drawn = useDrawProgress(1100);
  const all = journey.history;
  if (all.length < 2) return null;

  const days = RANGES.find((r) => r.label === range)!.days;
  const cutoff = days === null ? "" : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const points = all.filter((p) => p.date >= cutoff);

  // Time on the x axis (not weigh-in index), so gaps between weigh-ins look like gaps.
  // The plan is measured from the very first weigh-in, whatever range is showing.
  const day0 = Date.parse(`${all[0]!.date}T12:00:00`);
  const dayOf = (date: string) => (Date.parse(`${date}T12:00:00`) - day0) / 86_400_000;
  const from = points.length ? dayOf(points[0]!.date) : 0;
  const span = Math.max(1, points.length ? dayOf(points.at(-1)!.date) - from : 1);
  const plan = planLine(journey);
  const planKg = (d: number) => (plan ? plan(d) : null);
  const values = points
    .map((p) => p.kg)
    .concat(journey.targetKg ?? [])
    .concat(planKg(from) ?? [])
    .concat(planKg(from + span) ?? []);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const xd = (d: number) => PAD + ((d - from) / span) * (w - PAD * 2);
  const x = (i: number) => xd(dayOf(points[i]!.date));
  const y = (kg: number) => PAD + ((max - kg) / (max - min)) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p.kg)}`).join(" ");
  const area = points.length >= 2 ? `${line} L ${x(points.length - 1)} ${H} L ${x(0)} ${H} Z` : "";
  // Android's SVG can keep a stale clip after the reveal finishes, so drop it once drawn.
  const clip = drawn < 1 ? "url(#weightReveal)" : undefined;
  const change = points.length ? Math.round((points.at(-1)!.kg - points[0]!.kg) * 10) / 10 : 0;
  const planPath = plan
    ? Array.from({ length: 25 }, (_, i) => from + (i / 24) * span)
        .map((d, i) => `${i ? "L" : "M"} ${xd(d)} ${y(plan(d))}`)
        .join(" ")
    : null;

  return (
    <Surface tint="leaf">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T variant="heading">Weight progress</T>
        {journey.pct !== null ? (
          <View style={styles.goalChip}>
            <T variant="caption" tone="ink" style={{ fontWeight: "700" }}>
              {journey.pct}%
            </T>
            <T variant="caption"> of goal</T>
          </View>
        ) : null}
      </View>
      {points.length >= 2 ? (
        <T variant="label">
          {change === 0 ? "No change" : `${change > 0 ? "+" : "−"}${formatWeight(Math.abs(change), unit)}`} since{" "}
          {new Date(`${points[0]!.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </T>
      ) : (
        <T variant="label">Not enough weigh-ins in this range yet.</T>
      )}
      <View
        style={{ height: H, marginTop: space.sm }}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      >
        {w > 0 && points.length >= 2 ? (
          <Svg width={w} height={H}>
            <Defs>
              {/* Both lines draw in left to right, like the plan on the target reveal. */}
              <ClipPath id="weightReveal">
                <Rect x={0} y={0} width={PAD + (w - PAD) * drawn + 8} height={H} />
              </ClipPath>
            </Defs>
            {planPath ? (
              <Path
                d={planPath}
                clipPath={clip}
                fill="none"
                stroke={colors.inkFaint}
                strokeWidth={2}
                strokeDasharray="2 5"
                strokeLinecap="round"
              />
            ) : null}
            {journey.targetKg !== null ? (
              <Line
                x1={PAD}
                x2={w - PAD}
                y1={y(journey.targetKg)}
                y2={y(journey.targetKg)}
                stroke={colors.leaf}
                strokeDasharray="4 6"
                strokeWidth={1.5}
                opacity={0.6}
              />
            ) : null}
            <Defs>
              <LinearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.leaf} stopOpacity="0.28" />
                <Stop offset="1" stopColor={colors.leaf} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#weightArea)" clipPath={clip} />
            <Path
              d={line}
              clipPath={clip}
              fill="none"
              stroke={colors.leaf}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) =>
              x(i) > PAD + (w - PAD) * drawn ? null : i === points.length - 1 ? (
                <Circle
                  key={p.date}
                  cx={x(i)}
                  cy={y(p.kg)}
                  r={6}
                  fill={colors.leaf}
                  stroke={colors.leafSoft}
                  strokeWidth={3}
                />
              ) : (
                <Circle key={p.date} cx={x(i)} cy={y(p.kg)} r={3} fill={colors.leaf} />
              ),
            )}
          </Svg>
        ) : null}
      </View>
      <View style={styles.ranges}>
        {RANGES.map((r) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityState={{ selected: r.label === range }}
            onPress={() => setRange(r.label)}
            style={[styles.range, r.label === range && styles.rangeOn]}
          >
            <T variant="label" tone={r.label === range ? "ink" : "faint"}>
              {r.label}
            </T>
          </Pressable>
        ))}
      </View>
      <T variant="caption">
        {[
          plan ? "Dotted: your plan" : null,
          journey.targetKg !== null ? `Dashed: goal ${formatWeight(journey.targetKg, unit)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </T>
    </Surface>
  );
}

/** Where the plan says you'd be, d days after the first weigh-in: a steady weekly pace that stops at the goal. */
function planLine(j: JourneyResponse): ((d: number) => number) | null {
  if (j.targetKg === null || j.weeklyKg === 0 || (j.goal !== "lose" && j.goal !== "build_muscle")) return null;
  const dir = j.goal === "lose" ? -1 : 1;
  const target = j.targetKg;
  return (d) => {
    const kg = j.startKg + (dir * j.weeklyKg * d) / 7;
    return dir < 0 ? Math.max(target, kg) : Math.min(target, kg);
  };
}

const styles = StyleSheet.create({
  goalChip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  ranges: {
    flexDirection: "row",
    backgroundColor: "rgba(46,107,79,0.08)",
    borderRadius: radius.pill,
    padding: 3,
    marginTop: space.xs,
  },
  range: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: radius.pill },
  rangeOn: { backgroundColor: colors.surface },
});
