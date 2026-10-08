import type { JourneyResponse } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, errorMessage } from "@/lib/api";
import { useAfterWrite } from "@/lib/mutations";
import { colors, radius, space } from "@/lib/theme";
import { formatWeight, kgToLb, lbToKg, useUnits } from "@/lib/units";
import { Button } from "./Button";
import { CardSkeleton } from "./Skeleton";
import { RulerPicker } from "./RulerPicker";
import { Sheet } from "./Sheet";
import { Surface } from "./Surface";
import { T } from "./Text";

/**
 * Cal AI's current-weight card: the latest weight, the bar from start to goal and the date
 * the plan gets there. Weighing is a daily habit, so there's no countdown; one tap logs it.
 */
export function JourneyCard() {
  const journey = useQuery({ queryKey: ["journey"], queryFn: api.journey });
  const unit = useUnits((u) => u.weight);
  const [weighing, setWeighing] = useState(false);
  const j = journey.data;
  if (journey.isLoading) return <CardSkeleton h={140} />;
  if (!j) return null;

  const arrival = goalDate(j);

  return (
    <Surface>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="label">Current weight</T>
          <T style={styles.big}>{formatWeight(j.currentKg, unit)}</T>
        </View>
      </View>

      {j.targetKg !== null && j.pct !== null ? <GoalBar j={j} /> : null}

      <View style={styles.bottom}>
        <T variant="caption" style={{ flex: 1 }}>
          {j.kgToGo === 0 ? (
            "You've reached your goal."
          ) : arrival ? (
            <>
              At your goal by <T variant="caption" tone="ink" style={{ fontWeight: "700" }}>{arrival}</T>.
            </>
          ) : j.lastWeighIn ? (
            `Last weigh-in ${daysAgo(j.lastWeighIn)}`
          ) : (
            "Weigh in to start tracking your trend."
          )}
        </T>
        <Button label="Log weight" kind="secondary" compact onPress={() => setWeighing(true)} />
      </View>

      <Sheet visible={weighing} onClose={() => setWeighing(false)} title="Today's weight">
        {weighing ? <WeighIn startKg={j.currentKg} unit={unit} onDone={() => setWeighing(false)} /> : null}
      </Sheet>
    </Surface>
  );
}

/** When the planned weekly pace reaches the goal from the current weight. */
function goalDate(j: JourneyResponse): string | null {
  if (!j.kgToGo || !j.weeklyKg) return null;
  const days = Math.ceil((j.kgToGo / j.weeklyKg) * 7);
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
        <T variant="caption">
          Start: <T variant="caption" tone="ink" style={{ fontWeight: "700" }}>{formatWeight(j.startKg, unit)}</T>
        </T>
        <T variant="caption">
          Goal: <T variant="caption" tone="ink" style={{ fontWeight: "700" }}>{formatWeight(j.targetKg!, unit)}</T>
        </T>
      </View>
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

function daysSince(date: string): number {
  return Math.round((Date.now() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
}

function daysAgo(date: string): string {
  const days = daysSince(date);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  big: { fontSize: 30, lineHeight: 38, fontWeight: "700", color: colors.ink },
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
