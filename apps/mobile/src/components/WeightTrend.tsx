import type { JourneyResponse } from "@kimbo/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, ClipPath, Defs, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors, radius, space } from "@/lib/theme";
import { formatWeight, kgToLb, useUnits } from "@/lib/units";
import { useDrawProgress } from "./GoalPath";
import { Surface } from "./Surface";
import { T } from "./Text";

const H = 210;
const LEFT = 38;
const RIGHT = 8;
const TOP = 20;
const BOTTOM = 32;

const RANGES = [
  { label: "90D", days: 90 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
] as const;
type RangeLabel = (typeof RANGES)[number]["label"];

/** Cal AI-style weight history: labelled axes, dotted grid and a thin unfilled line. */
export function WeightTrend({ journey }: { journey: JourneyResponse }) {
  const unit = useUnits((u) => u.weight);
  const [w, setW] = useState(0);
  const [range, setRange] = useState<RangeLabel>("90D");
  const drawn = useDrawProgress(1100);
  const all = journey.history;


  const days = RANGES.find((r) => r.label === range)!.days;
  const cutoff = days === null ? "" : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const points = all.filter((p) => p.date >= cutoff);

  // Time on the x axis (not weigh-in index), so gaps between weigh-ins look like gaps.
  // The plan is measured from the very first weigh-in, whatever range is showing.
  const day0 = all.length ? Date.parse(`${all[0]!.date}T12:00:00`) : Date.now();
  const dayOf = (date: string) => (Date.parse(`${date}T12:00:00`) - day0) / 86_400_000;
  const from = points.length ? dayOf(points[0]!.date) : 0;
  const span = Math.max(1, points.length ? dayOf(points.at(-1)!.date) - from : 1);
  const values = points.map((p) => unit === "kg" ? p.kg : kgToLb(p.kg));
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const step = Math.max(0.5, Math.ceil((high - low) / 2 * 2) / 2);
  const min = Math.floor(low / step) * step;
  const max = Math.max(min + step * 2, Math.ceil(high / step) * step);
  const xd = (d: number) => LEFT + ((d - from) / span) * Math.max(0, w - LEFT - RIGHT);
  const x = (i: number) => points.length === 1 ? (LEFT + w - RIGHT) / 2 : xd(dayOf(points[i]!.date));
  const y = (weight: number) => TOP + ((max - weight) / (max - min)) * (H - TOP - BOTTOM);
  const line = points.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(values[i]!)}`).join(" ");
  const clip = drawn < 1 ? "url(#weightReveal)" : undefined;
  const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-IN",
    span <= 6 ? { weekday: "short" } : { day: "numeric", month: "short" });

  return (
    <Surface>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T variant="heading">Weight progress</T>
        {journey.pct !== null ? (
          <View style={styles.goalChip}>
            <T variant="caption" tone="ink" style={{ fontWeight: "700" }}>
              ⚑ {journey.pct}%
            </T>
            <T variant="caption"> of goal</T>
          </View>
        ) : null}
      </View>
      <View
        style={{ height: H, marginTop: space.sm }}
        accessibilityLabel={`Weight history in ${unit}. ${points.map((p) => `${p.date}: ${formatWeight(p.kg, unit)}`).join(", ")}`}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      >
        {w > LEFT + RIGHT && points.length > 0 ? (
          <Svg width={w} height={H}>
            <Defs>
              <ClipPath id="weightReveal">
                <Rect x={0} y={0} width={LEFT + (w - LEFT) * drawn + 8} height={H} />
              </ClipPath>
            </Defs>
            {[max, (min + max) / 2, min].map((value) => (
              <ViewGrid key={value} value={value} y={y(value)} width={w} />
            ))}
            {[0, points.length - 1].filter((i, index, list) => list.indexOf(i) === index).map((i) => (
              <Line key={`vertical-${i}`} x1={x(i)} x2={x(i)} y1={TOP - 12} y2={H - BOTTOM + 6} stroke="#EEEEF2" strokeDasharray="2 3" />
            ))}
            <Path d={line} clipPath={clip} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => x(i) > LEFT + (w - LEFT) * drawn ? null : (
              <Circle key={p.date} cx={x(i)} cy={y(values[i]!)} r={2.5} fill={colors.ink} />
            ))}
            <SvgText x={x(0)} y={H - 5} fontSize={11} fill={colors.inkFaint} textAnchor="start">{dateLabel(points[0]!.date)}</SvgText>
            {points.length > 1 ? <SvgText x={x(points.length - 1)} y={H - 5} fontSize={11} fill={colors.inkFaint} textAnchor="end">{dateLabel(points.at(-1)!.date)}</SvgText> : null}
          </Svg>
        ) : <T variant="label" align="center" style={{ marginTop: 70 }}>Log your weight to start your graph.</T>}
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
    </Surface>
  );
}

function ViewGrid({ value, y, width }: { value: number; y: number; width: number }) {
  return (
    <>
      <Line x1={LEFT} x2={width - RIGHT} y1={y} y2={y} stroke="#D8D8DC" strokeDasharray="3 4" strokeWidth={1} />
      <SvgText x={LEFT - 8} y={y + 4} textAnchor="end" fontSize={11} fill={colors.inkFaint}>{value.toFixed(1)}</SvgText>
    </>
  );
}

const styles = StyleSheet.create({
  goalChip: {
    flexDirection: "row",
    backgroundColor: "#F7F7F9",
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  ranges: {
    flexDirection: "row",
    backgroundColor: "#F7F7F9",
    borderRadius: radius.pill,
    padding: 3,
    marginTop: space.xs,
  },
  range: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: radius.pill },
  rangeOn: { backgroundColor: colors.surface },
});
