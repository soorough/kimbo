import type { JourneyResponse, ProgressResponse } from "@kimbo/shared";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { HABIT_BADGES, MEAL_BADGES, STREAK_BADGES } from "@/lib/badges";
import { colors, radius, space } from "@/lib/theme";
import { formatWeight, useUnits } from "@/lib/units";
import { Icon } from "./Icon";
import { Surface } from "./Surface";
import { T } from "./Text";

/** Cal AI's two tiles at the top of Progress: the day streak and badges earned. Both open Milestones. */
export function StatTiles({ p }: { p: ProgressResponse }) {
  const earned =
    new Set(p.achievements.map((a) => a.type)).size +
    STREAK_BADGES.filter((b) => Math.max(p.streak, p.longestStreak) >= b.days).length +
    MEAL_BADGES.filter((b) => p.mealsLogged >= b.meals).length;
  const total = HABIT_BADGES.length + STREAK_BADGES.length + MEAL_BADGES.length;
  const open = () => router.push("/milestones");
  return (
    <View style={styles.tiles}>
      <Surface style={styles.tile} onPress={open} accessibilityLabel={`${p.streak} day streak. Open milestones`}>
        <T style={styles.tileArt}>🔥</T>
        <T style={styles.tileNum}>{p.streak}</T>
        <T variant="label">Day streak</T>
      </Surface>
      <Surface
        style={styles.tile}
        onPress={open}
        accessibilityLabel={`${earned} of ${total} badges earned. Open milestones`}
      >
        <T style={styles.tileArt}>🏅</T>
        <T style={styles.tileNum}>{earned}</T>
        <T variant="label">Badges earned</T>
      </Surface>
    </View>
  );
}

const WINDOWS: { label: string; days: number | null }[] = [
  { label: "3 day", days: 3 },
  { label: "7 day", days: 7 },
  { label: "14 day", days: 14 },
  { label: "30 day", days: 30 },
  { label: "90 day", days: 90 },
  { label: "All time", days: null },
];

/**
 * How weight moved over 3 days to all time, against the latest weigh-in. Each window starts at
 * the last weigh-in on or before its first day, or the first weigh-in when there isn't one.
 */
export function WeightChanges({ journey }: { journey: JourneyResponse }) {
  const unit = useUnits((u) => u.weight);
  const h = journey.history;
  if (h.length === 0) return null;
  const latest = h.at(-1)!;
  const today = new Date();
  const rows = WINDOWS.map((w) => {
    let from = journey.startKg;
    if (w.days !== null) {
      const cutoff = new Date(today.getTime() - w.days * 86_400_000).toISOString().slice(0, 10);
      from = [...h].reverse().find((p) => p.date <= cutoff)?.kg ?? h[0]!.kg;
    }
    return { ...w, change: Math.round((latest.kg - from) * 10) / 10 };
  });
  const biggest = Math.max(0.1, ...rows.map((r) => Math.abs(r.change)));
  // Moving toward the goal reads leaf; away from it, plum. Maintaining: any change is just shown.
  const toward = (c: number) =>
    journey.goal === "lose" ? c < 0 : journey.goal === "build_muscle" ? c > 0 : true;

  return (
    <Surface>
      <T variant="heading">Weight changes</T>
      <View style={{ gap: space.sm, marginTop: space.xs }}>
        {rows.map((r) => {
          const none = r.change === 0;
          const tone = none ? colors.inkFaint : toward(r.change) ? colors.leaf : colors.plum;
          return (
            <View key={r.label} style={styles.changeRow}>
              <T variant="label" style={{ width: 64 }}>
                {r.label}
              </T>
              <View style={styles.changeTrack}>
                <View
                  style={[
                    styles.changeFill,
                    { width: `${Math.max(6, (Math.abs(r.change) / biggest) * 100)}%`, backgroundColor: none ? colors.sunk : tone },
                  ]}
                />
              </View>
              <T variant="bodyStrong" style={{ width: 64, textAlign: "right" }}>
                {formatWeight(Math.abs(r.change), unit)}
              </T>
              <View style={styles.changeTrend}>
                <Icon
                  name={none ? "arrow-right" : r.change > 0 ? "arrow-up-right" : "arrow-down-right"}
                  size={14}
                  color={tone}
                />
                <T variant="caption" style={{ color: tone }}>
                  {none ? "No change" : r.change > 0 ? "Up" : "Down"}
                </T>
              </View>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}

const BMI_BANDS = [
  { label: "Underweight", range: "<18.5", max: 18.5, color: "#A99BCB" },
  { label: "Healthy", range: "18.5–24.9", max: 25, color: colors.leaf },
  { label: "Overweight", range: "25–29.9", max: 30, color: colors.turmeric },
  { label: "Obese", range: "30+", max: Infinity, color: colors.plum },
];
const SCALE_MIN = 15;
const SCALE_MAX = 35;

/** BMI from height and the latest weight, on Cal AI's four-band scale. A screening number, not a diagnosis. */
export function BmiCard({ heightCm, kg }: { heightCm: number; kg: number }) {
  const bmi = Math.round((kg / (heightCm / 100) ** 2) * 10) / 10;
  const band = BMI_BANDS.find((b) => bmi < b.max)!;
  const pos = Math.min(1, Math.max(0, (bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
  const edges = [SCALE_MIN, 18.5, 25, 30, SCALE_MAX];
  return (
    <Surface accessibilityLabel={`Your BMI is ${bmi}, ${band.label.toLowerCase()}`}>
      <T variant="heading">Your BMI</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <T style={styles.bmiNum}>{bmi}</T>
        <T variant="label">Your weight is</T>
        <View style={[styles.bmiPill, { backgroundColor: `${band.color}22` }]}>
          <T variant="label" style={{ color: band.color === colors.turmeric ? colors.turmericDeep : band.color }}>
            {band.label}
          </T>
        </View>
      </View>
      <View style={styles.scale}>
        {BMI_BANDS.map((b, i) => (
          <View
            key={b.label}
            style={{ flex: edges[i + 1]! - edges[i]!, height: 8, borderRadius: radius.pill, backgroundColor: b.color }}
          />
        ))}
        <View style={[styles.scaleMark, { left: `${pos * 100}%` }]} />
      </View>
      <View style={styles.legend}>
        {BMI_BANDS.map((b) => (
          <View key={b.label} style={{ gap: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={[styles.dot, { backgroundColor: b.color }]} />
              <T variant="caption">{b.label}</T>
            </View>
            <T variant="caption" tone="faint" style={{ marginLeft: 12 }}>
              {b.range}
            </T>
          </View>
        ))}
      </View>
      <T variant="caption" tone="faint">
        BMI doesn't tell muscle from fat. Use it as a rough guide alongside your report.
      </T>
    </Surface>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: space.md },
  tile: { flex: 1, alignItems: "center", gap: 2, paddingVertical: space.lg },
  tileArt: { fontSize: 40, lineHeight: 52, includeFontPadding: false },
  tileNum: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: colors.ink },
  changeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  changeTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.sunk, overflow: "hidden" },
  changeFill: { height: 8, borderRadius: radius.pill },
  changeTrend: { flexDirection: "row", alignItems: "center", gap: 2, width: 76 },
  bmiNum: { fontSize: 34, lineHeight: 42, fontWeight: "700", color: colors.ink },
  bmiPill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  scale: { flexDirection: "row", gap: 3, marginTop: space.sm, alignItems: "center" },
  scaleMark: {
    position: "absolute",
    width: 3,
    height: 20,
    marginLeft: -1.5,
    borderRadius: 2,
    backgroundColor: colors.ink,
  },
  legend: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
