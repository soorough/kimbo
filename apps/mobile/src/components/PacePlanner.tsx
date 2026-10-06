import { assessTimeline, LOSS_REALISTIC_PCT, type GoalRequest } from "@kimbo/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";
import { formatPace, formatWeight, useUnits } from "@/lib/units";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Icon } from "./Icon";
import { RulerPicker } from "./RulerPicker";
import { T } from "./Text";

type Body = Pick<GoalRequest, "age" | "sex" | "heightCm" | "weightKg" | "activity">;

/** "16 Dec", or "24 Feb 2027" once it's in another year. */
const dateIn = (weeks: number) => {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
};

/**
 * What speed costs, and an honest check of a goal date: realistic, doable with effort, hard,
 * or not realistic, with the change that would make it work.
 */
export function PacePlanner({
  goal,
  body,
  targetWeightKg,
  onUsePace,
  onUseGoalWeight,
}: {
  goal: "lose" | "build_muscle";
  body: Body;
  targetWeightKg: number;
  onUsePace: (pace: number) => void;
  onUseGoalWeight: (kg: number) => void;
}) {
  const unit = useUnits((u) => u.weight);
  const [open, setOpen] = useState(false);
  const kgToGo = Math.abs(targetWeightKg - body.weightKg);
  const [weeks, setWeeks] = useState(Math.max(4, Math.ceil(kgToGo / 0.5)));
  const onePct = Math.round(body.weightKg * (LOSS_REALISTIC_PCT / 100) * 10) / 10;

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.advice}>
        <Icon name="info" size={18} color={colors.leaf} />
        <T variant="caption" style={{ flex: 1 }}>
          {goal === "build_muscle"
            ? "Your body can build only about ¼ to ½ kg of muscle a week, even training hard. Eat beyond that and the extra is stored as fat you'd later have to cut. A slow, lean gain keeps most of it muscle."
            : `Losing more than about 1% of your weight a week (${formatWeight(onePct, unit)} for you) takes muscle along with fat, and the hunger makes it hard to keep up. Slower keeps the muscle and the habit.`}
        </T>
      </View>

      {!open ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.toggle}>
          <Icon name="calendar" size={18} color={colors.leaf} />
          <T variant="bodyStrong" tone="leaf">
            Have a date in mind?
          </T>
        </Pressable>
      ) : (
        <DateCheck
          goal={goal}
          body={body}
          targetWeightKg={targetWeightKg}
          weeks={weeks}
          setWeeks={setWeeks}
          onUsePace={onUsePace}
          onUseGoalWeight={onUseGoalWeight}
        />
      )}
    </View>
  );
}

function DateCheck({
  goal,
  body,
  targetWeightKg,
  weeks,
  setWeeks,
  onUsePace,
  onUseGoalWeight,
}: {
  goal: "lose" | "build_muscle";
  body: Body;
  targetWeightKg: number;
  weeks: number;
  setWeeks: (w: number) => void;
  onUsePace: (pace: number) => void;
  onUseGoalWeight: (kg: number) => void;
}) {
  const unit = useUnits((u) => u.weight);
  const a = assessTimeline({ ...body, goal, targetWeightKg }, weeks);
  const target = formatWeight(targetWeightKg, unit);
  const by = dateIn(weeks);
  const pct = (p: number) => Math.round((p / body.weightKg) * 1000) / 10;

  const copy = {
    comfortable: {
      title: "Realistic",
      body: `${formatPace(a.pace ?? 0, unit)} a week gets you to ${target} by ${by}.`,
    },
    effort: {
      title: "Doable, with effort",
      body:
        goal === "build_muscle"
          ? `It needs ½ kg a week. More of that gain is fat than at ¼ kg; it suits you best if you're new to lifting.`
          : `It needs ${formatPace(a.pace ?? 0, unit)} a week, about ${pct(a.pace ?? 0)}% of your weight. Expect to feel hungry on some days.`,
    },
    hard: {
      title: "Possible, but hard on your body",
      body: `It needs ${formatPace(a.pace ?? 0, unit)} a week, over 1% of your weight. Some of the loss will be muscle, and it's hard to keep up.`,
    },
    unrealistic: {
      title: `Not realistic by ${by}`,
      body:
        goal === "build_muscle"
          ? `It needs ${a.requiredKgPerWeek} kg a week. Muscle can't be built that fast; most of it would be fat.`
          : a.realisticWeeks === null
            ? `Any weight-loss pace would put you under 1,200 kcal a day, the safe minimum. Try a later date or keep your weight steady first.`
            : `It needs ${a.requiredKgPerWeek} kg a week. That's more than your body can lose safely.`,
    },
  }[a.verdict];

  const tone = {
    comfortable: { bg: colors.leafSoft, icon: "check-circle" as const, color: colors.leaf },
    effort: { bg: colors.turmericSoft, icon: "alert-circle" as const, color: colors.turmericDeep },
    hard: { bg: colors.plumSoft, icon: "alert-triangle" as const, color: colors.plum },
    unrealistic: { bg: colors.plumSoft, icon: "x-circle" as const, color: colors.plum },
  }[a.verdict];

  const suggest = a.verdict === "hard" || a.verdict === "unrealistic";

  return (
    <View style={{ gap: space.md }}>
      <RulerPicker
        label="Goal date"
        value={weeks}
        onChange={setWeeks}
        min={2}
        max={104}
        majorEvery={4}
        unit={`in ${weeks} weeks`}
        format={() => by}
        tickFormat={(w) => `${w}w`}
        compact
      />
      <View style={[styles.verdict, { backgroundColor: tone.bg }]} accessibilityLiveRegion="polite">
        <View style={styles.verdictHead}>
          <Icon name={tone.icon} size={20} color={tone.color} />
          <T variant="bodyStrong" style={{ flex: 1 }}>
            {copy.title}
          </T>
        </View>
        <T variant="caption">{copy.body}</T>
        {suggest && (a.realisticWeeks !== null || a.realisticGoalWeightKg !== null) ? (
          <View style={{ gap: space.sm }}>
            <T variant="caption" tone="soft">
              What would make it realistic:
            </T>
            <View style={styles.chips}>
              {a.realisticWeeks !== null ? (
                <Chip label={`Aim for ${dateIn(a.realisticWeeks)}`} onPress={() => setWeeks(a.realisticWeeks!)} />
              ) : null}
              {a.realisticGoalWeightKg !== null && a.realisticGoalWeightKg !== body.weightKg ? (
                <Chip
                  label={`Aim for ${formatWeight(a.realisticGoalWeightKg, unit)} by then`}
                  onPress={() => onUseGoalWeight(a.realisticGoalWeightKg!)}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
      {a.pace !== null ? <Button label={`Use ${formatPace(a.pace, unit)} a week`} onPress={() => onUsePace(a.pace!)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  advice: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.leafSoft,
  },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  // Fixed minimum so switching between one- and two-line verdicts doesn't bump the button while dragging.
  verdict: { gap: space.sm, padding: space.md, borderRadius: radius.md, minHeight: 104 },
  verdictHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
