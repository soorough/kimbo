import type { Goal, GoalRequest } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { RulerPicker } from "@/components/RulerPicker";
import { Button, Chip, Icon, Screen, SegmentRing, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, macroColors, radius, space } from "@/lib/theme";

type Sex = GoalRequest["sex"];
type Activity = GoalRequest["activity"];
type GoalType = GoalRequest["goal"];

const GOALS: { key: GoalType; icon: IconName; label: string }[] = [
  { key: "lose", icon: "trending-down", label: "Lose weight" },
  { key: "maintain", icon: "minus", label: "Stay where I am" },
  { key: "gain", icon: "trending-up", label: "Gain weight" },
];
const SEXES: { key: Sex; label: string }[] = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "other", label: "Prefer not to say" },
];
/** Activity is shown as a 1–5 intensity meter, so the options read at a glance. */
const ACTIVITY: { key: Activity; label: string; hint: string }[] = [
  { key: "sedentary", label: "Mostly sitting", hint: "Desk job" },
  { key: "light", label: "Lightly active", hint: "1–3 workouts a week" },
  { key: "moderate", label: "Active", hint: "3–5 workouts a week" },
  { key: "active", label: "Very active", hint: "6–7 workouts a week" },
  { key: "very_active", label: "Athlete", hint: "Physical job or twice a day" },
];

const STEPS = ["goal", "sex", "age", "height", "weight", "activity"] as const;
type Step = (typeof STEPS)[number];

const QUESTIONS: Record<Step, string> = {
  goal: "What's your goal?",
  sex: "Your sex",
  age: "How old are you?",
  height: "How tall are you?",
  weight: "What do you weigh?",
  activity: "How active is your week?",
};

/**
 * One question per screen. Choices advance on tap; numbers are picked on a ruler, so
 * there's no keyboard and no invalid input. The result is shown, not explained.
 */
export default function Onboarding() {
  const profileId = useSession((s) => s.profileId)!;
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId) });
  const saved = existing.data?.profile.goal;

  const [step, setStep] = useState(0);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState(28);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(65);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [result, setResult] = useState<Goal | null>(null);
  const [target, setTarget] = useState(0);

  // Editing later: start from what's saved.
  useEffect(() => {
    if (!saved) return;
    setGoalType(saved.goal);
    setSex(saved.sex);
    setAge(saved.age);
    setHeight(saved.heightCm);
    setWeight(saved.weightKg);
    setActivity(saved.activity);
  }, [saved]);

  const request = (overrides: Partial<GoalRequest> = {}): GoalRequest => ({
    age,
    sex: sex!,
    heightCm: height,
    weightKg: weight,
    activity: activity!,
    goal: goalType!,
    ...overrides,
  });

  const calculate = useMutation({
    // Preserve an existing custom target while recalculating; "Looks good" decides the final value.
    mutationFn: (req: GoalRequest) =>
      api.saveGoal(profileId, saved?.targetOverride ? { ...req, targetOverride: saved.targetOverride } : req),
    onSuccess: ({ profile }) => {
      setResult(profile.goal);
      setTarget(profile.goal!.effectiveTarget);
    },
  });

  const confirm = useMutation({
    mutationFn: () =>
      api.saveGoal(profileId, target !== result!.computedTarget ? request({ targetOverride: target }) : request()),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
  });

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  /** Single-choice answers move on by themselves after a beat, so the choice registers visually. */
  const choose = <V,>(set: (v: V) => void, v: V, then: () => void) => {
    set(v);
    Haptics.selectionAsync().catch(() => {});
    setTimeout(then, 220);
  };

  if (result) {
    return (
      <Reveal
        goal={result}
        target={target}
        onAdjust={setTarget}
        onConfirm={() => confirm.mutate()}
        confirming={confirm.isPending}
        error={confirm.error ? errorMessage(confirm.error) : null}
        onBack={() => setResult(null)}
      />
    );
  }

  const current = STEPS[step]!;
  const isRuler = current === "age" || current === "height" || current === "weight";

  return (
    <Screen
      footer={
        isRuler ? (
          <Button label="Continue" onPress={next} />
        ) : calculate.error ? (
          <T variant="label" tone="plum" align="center">
            {errorMessage(calculate.error)}
          </T>
        ) : undefined
      }
    >
      <View style={styles.progressRow}>
        {step > 0 || router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
            style={styles.back}
          >
            <Icon name="arrow-left" size={20} />
          </Pressable>
        ) : null}
        <View style={styles.segments}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.segment, i <= step && styles.segmentOn]} />
          ))}
        </View>
      </View>

      <T variant="title" style={styles.question}>
        {QUESTIONS[current]}
      </T>

      {current === "goal" ? (
        <Options>
          {GOALS.map((g) => (
            <Card
              key={g.key}
              selected={goalType === g.key}
              onPress={() => choose(setGoalType, g.key, next)}
              leading={<Icon name={g.icon} size={22} color={goalType === g.key ? colors.white : colors.leafDeep} />}
              label={g.label}
            />
          ))}
        </Options>
      ) : null}

      {current === "sex" ? (
        <Options>
          {SEXES.map((s) => (
            <Card key={s.key} selected={sex === s.key} onPress={() => choose(setSex, s.key, next)} label={s.label} />
          ))}
          <T variant="caption" align="center">
            This changes your calorie estimate by about 160 kcal.
          </T>
        </Options>
      ) : null}

      {current === "age" ? (
        <RulerPicker label="Age" value={age} onChange={setAge} min={15} max={100} majorEvery={5} unit="years" />
      ) : null}
      {current === "height" ? (
        <RulerPicker label="Height" value={height} onChange={setHeight} min={120} max={220} unit="cm" />
      ) : null}
      {current === "weight" ? (
        <RulerPicker
          label="Weight"
          value={weight}
          onChange={setWeight}
          min={30}
          max={200}
          step={0.5}
          majorEvery={10}
          unit="kg"
        />
      ) : null}

      {current === "activity" ? (
        <Options>
          {ACTIVITY.map((a, i) => (
            <Card
              key={a.key}
              selected={activity === a.key}
              onPress={() => choose(setActivity, a.key, () => calculate.mutate(request({ activity: a.key })))}
              leading={<Meter level={i + 1} on={activity === a.key} />}
              label={a.label}
              hint={a.hint}
            />
          ))}
          {calculate.isPending ? (
            <T variant="label" align="center">
              Calculating…
            </T>
          ) : null}
        </Options>
      ) : null}
    </Screen>
  );
}

function Reveal({
  goal,
  target,
  onAdjust,
  onConfirm,
  confirming,
  error,
  onBack,
}: {
  goal: Goal;
  target: number;
  onAdjust: (v: number) => void;
  onConfirm: () => void;
  confirming: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const shown = useCountUp(target);
  const [why, setWhy] = useState(false);
  const b = goal.breakdown;
  const macros = [
    { label: "Protein", grams: goal.targets.protein, kcalPerGram: 4, color: macroColors.protein },
    { label: "Carbs", grams: goal.targets.carbs, kcalPerGram: 4, color: macroColors.carbs },
    { label: "Fat", grams: goal.targets.fat, kcalPerGram: 9, color: macroColors.fat },
  ];
  const pace = b.kgPerWeek === 0 ? "Keeps your weight where it is" : `About ${formatKg(Math.abs(b.kgPerWeek))} a week`;
  const paceIcon: IconName = b.kgPerWeek < 0 ? "trending-down" : b.kgPerWeek > 0 ? "trending-up" : "minus";

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {error ? (
            <T variant="label" tone="plum" align="center">
              {error}
            </T>
          ) : null}
          <Button label="Looks good" loading={confirming} onPress={onConfirm} />
        </View>
      }
    >
      <View style={styles.revealTop}>
        <SegmentRing
          segments={macros.map((m) => ({ value: m.grams * m.kcalPerGram, color: m.color }))}
          size={220}
          stroke={16}
        >
          <Kimbo mood="happy" size={56} leaves={2} />
          <T variant="display" style={styles.bigNumber}>
            {shown}
          </T>
          <T variant="label">kcal a day</T>
        </SegmentRing>
        <View style={styles.pace}>
          <Icon name={paceIcon} size={16} color={colors.leafDeep} />
          <T variant="label" tone="leaf">
            {pace}
          </T>
        </View>
      </View>

      <View style={styles.macroRow}>
        {macros.map((m) => (
          <View key={m.label} style={styles.macro}>
            <View style={[styles.macroDot, { backgroundColor: m.color }]} />
            <T variant="heading">{m.grams} g</T>
            <T variant="caption">{m.label}</T>
          </View>
        ))}
      </View>

      <View style={styles.adjust}>
        <Chip label="−50" disabled={target <= 1200} onPress={() => onAdjust(Math.max(1200, target - 50))} />
        <T variant="caption" style={{ flex: 1 }} align="center">
          {target === goal.computedTarget
            ? "Doctor gave you a different number? Adjust it."
            : `Kimbo suggested ${goal.computedTarget}`}
        </T>
        <Chip label="+50" disabled={target >= 4000} onPress={() => onAdjust(Math.min(4000, target + 50))} />
      </View>

      <Pressable accessibilityRole="button" onPress={() => setWhy(!why)} style={styles.whyToggle}>
        <T variant="bodyStrong" tone="leaf">
          Why this number?
        </T>
        <Icon name={why ? "chevron-up" : "chevron-down"} size={18} color={colors.leaf} />
      </Pressable>
      {why ? (
        <View style={styles.equation}>
          <Term value={b.bmr} label="at rest" />
          <T variant="heading" tone="soft">
            ×{b.activityFactor}
          </T>
          <Term value={b.maintenance} label="your day" />
          {b.adjustment !== 0 ? (
            <>
              <T variant="heading" tone="soft">
                {b.adjustment > 0 ? "+" : "−"}
                {Math.abs(b.adjustment)}
              </T>
              <Term value={goal.computedTarget} label="target" highlight />
            </>
          ) : null}
        </View>
      ) : null}

      <Button label="Edit answers" kind="ghost" onPress={onBack} />
    </Screen>
  );
}

function Options({ children }: { children: ReactNode }) {
  return <View style={{ gap: space.md }}>{children}</View>;
}

function Card({
  label,
  hint,
  leading,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  leading?: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardOn, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {leading ? <View style={[styles.cardLead, selected && { backgroundColor: colors.leaf }]}>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <T variant="heading">{label}</T>
        {hint ? <T variant="caption">{hint}</T> : null}
      </View>
      {selected ? <Icon name="check" size={20} color={colors.leaf} /> : null}
    </Pressable>
  );
}

function Meter({ level, on }: { level: number; on: boolean }) {
  return (
    <View style={styles.meter} accessibilityElementsHidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.meterBar,
            { height: 6 + i * 3 },
            {
              backgroundColor:
                i <= level ? (on ? colors.white : colors.leaf) : on ? "rgba(255,255,255,0.35)" : colors.line,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Term({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.term, highlight && { backgroundColor: colors.leafSoft }]}>
      <T variant="heading">{value}</T>
      <T variant="caption">{label}</T>
    </View>
  );
}

/** Counts up to the target the first time it appears, so the number lands with a little weight. */
function useCountUp(to: number, ms = 700) {
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) {
      setN(to);
      return;
    }
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, done]);
  return n;
}

function formatKg(kg: number): string {
  if (Math.abs(kg - 0.5) < 0.08) return "½ kg";
  if (Math.abs(kg - 0.25) < 0.05) return "¼ kg";
  return `${kg.toFixed(1)} kg`;
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm, minHeight: 36 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  segments: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.sunk },
  segmentOn: { backgroundColor: colors.leaf },
  question: { fontSize: 28, lineHeight: 34, marginTop: space.lg, marginBottom: space.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  cardOn: { borderColor: colors.leaf, backgroundColor: colors.leafSoft },
  cardLead: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  meter: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 22 },
  meterBar: { width: 4, borderRadius: 2 },
  revealTop: { alignItems: "center", gap: space.md, marginTop: space.xl },
  bigNumber: { fontSize: 48, lineHeight: 54, fontVariant: ["tabular-nums"] },
  pace: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  macroRow: { flexDirection: "row", gap: space.md },
  macro: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  adjust: { flexDirection: "row", alignItems: "center", gap: space.sm },
  whyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingVertical: space.sm,
  },
  equation: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  term: {
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
