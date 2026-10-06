import type { JourneyResponse } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, errorMessage } from "@/lib/api";
import { useAfterWrite } from "@/lib/mutations";
import { colors, radius, space } from "@/lib/theme";
import { formatPace, formatWeight, kgToLb, lbToKg, useUnits } from "@/lib/units";
import { Button } from "./Button";
import { CardSkeleton } from "./Skeleton";
import { Icon } from "./Icon";
import { RulerPicker } from "./RulerPicker";
import { Sheet } from "./Sheet";
import { Surface } from "./Surface";
import { T } from "./Text";

/**
 * The goal made visible on Today: how far from start to goal weight, the on-target
 * streak, and a one-tap weigh-in. It keeps the target from feeling abstract.
 */
export function JourneyCard() {
  const journey = useQuery({ queryKey: ["journey"], queryFn: api.journey });
  const unit = useUnits((u) => u.weight);
  const [weighing, setWeighing] = useState(false);
  const j = journey.data;
  if (journey.isLoading) return <CardSkeleton h={140} />;
  if (!j) return null;

  const title =
    j.goal === "maintain"
      ? `Stay at ${formatWeight(j.startKg, unit)}`
      : `${j.goal === "lose" ? "Lose" : "Build"} ${formatPace(j.weeklyKg, unit)} a week`;

  return (
    <Surface>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="overline">YOUR GOAL</T>
          <T variant="heading">{title}</T>
        </View>
        <Streak days={j.onTargetStreak} />
      </View>

      {j.targetKg !== null && j.pct !== null ? <GoalBar j={j} /> : null}

      <View style={styles.bottom}>
        <T variant="caption" style={{ flex: 1 }}>
          {j.onTargetStreak === 0
            ? "Land within 10% of your kcal target today to start a streak."
            : j.lastWeighIn
              ? `Last weigh-in ${daysAgo(j.lastWeighIn)}`
              : "Weigh in to start tracking your trend."}
        </T>
        <Button label="Log weight" kind="secondary" compact onPress={() => setWeighing(true)} />
      </View>

      <Sheet visible={weighing} onClose={() => setWeighing(false)} title="Today's weight">
        {weighing ? <WeighIn startKg={j.currentKg} unit={unit} onDone={() => setWeighing(false)} /> : null}
      </Sheet>
    </Surface>
  );
}

function GoalBar({ j }: { j: JourneyResponse }) {
  const unit = useUnits((u) => u.weight);
  const pct = j.pct ?? 0;
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
        <View style={[styles.marker, { left: `${pct}%` }]} />
      </View>
      <View style={styles.labels}>
        <T variant="caption">{formatWeight(j.startKg, unit)}</T>
        <T variant="label" tone="leaf">
          {j.kgToGo === 0
            ? "Goal reached"
            : `${formatWeight(j.currentKg, unit)} now · ${formatWeight(j.kgToGo!, unit)} to go`}
        </T>
        <T variant="caption">{formatWeight(j.targetKg!, unit)}</T>
      </View>
    </View>
  );
}

/** Days in a row on the calorie target. Shown only when there's a run to protect. */
function Streak({ days }: { days: number }) {
  if (days === 0) return null;
  return (
    <View style={styles.streak} accessibilityLabel={`${days} days in a row on target`}>
      <Icon name="sun" size={16} color={colors.turmericDeep} />
      <T variant="label" tone="turmeric">
        {days} {days === 1 ? "day" : "days"} on target
      </T>
    </View>
  );
}

function WeighIn({ startKg, unit, onDone }: { startKg: number; unit: "kg" | "lb"; onDone: () => void }) {
  const [kg, setKg] = useState(startKg);
  const afterWrite = useAfterWrite();
  const save = useMutation({
    mutationFn: () => api.logWeight(kg),
    onSuccess: async (res) => {
      onDone();
      await afterWrite(res.events);
    },
  });
  return (
    <View style={{ gap: space.lg }}>
      {unit === "kg" ? (
        <RulerPicker
          label="Weight"
          value={kg}
          onChange={setKg}
          min={30}
          max={200}
          step={0.1}
          majorEvery={10}
          unit="kg"
        />
      ) : (
        <RulerPicker
          label="Weight"
          value={kgToLb(kg)}
          onChange={(lb) => setKg(lbToKg(lb))}
          min={70}
          max={440}
          unit="lb"
        />
      )}
      {save.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(save.error)}
        </T>
      ) : (
        <T variant="caption" align="center">
          Weigh at the same time each day, ideally in the morning.
        </T>
      )}
      <Button label="Save weight" loading={save.isPending} onPress={() => save.mutate()} />
    </View>
  );
}

function daysAgo(date: string): string {
  const days = Math.round((Date.now() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.turmericSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.sunk, marginTop: space.sm },
  fill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.leaf },
  marker: {
    position: "absolute",
    top: -4,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.leaf,
  },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xs },
});
