import {
  computeGoal,
  DEFAULT_PACE,
  maintenanceFor,
  PACES,
  TARGET_BOUNDS_KCAL,
  type Goal,
  type GoalRequest,
} from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { KimboScene } from "@/components/KimboScene";
import { RulerPicker } from "@/components/RulerPicker";
import { Button, Chip, Icon, Screen, Segmented, SegmentRing, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, macroColors, radius, space } from "@/lib/theme";
import {
  cmToIn,
  formatFeetInches,
  formatPace,
  formatWeight,
  inToCm,
  kgToLb,
  lbToKg,
  useUnits,
  type HeightUnit,
  type WeightUnit,
} from "@/lib/units";

type Sex = GoalRequest["sex"];
type Activity = GoalRequest["activity"];
type GoalType = GoalRequest["goal"];

const GOALS: { key: GoalType; icon: IconName; label: string; hint: string }[] = [
  { key: "lose", icon: "trending-down", label: "Lose weight", hint: "At a pace you pick, from ¼ to 1 kg a week" },
  { key: "maintain", icon: "minus", label: "Stay where I am", hint: "Eat for the weight you're at" },
  {
    key: "build_muscle",
    icon: "zap",
    label: "Build muscle",
    hint: "A small surplus and more protein, not just weight",
  },
];
const SEXES: { key: Sex; label: string }[] = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "other", label: "Prefer not to say" },
];
/** Concrete days, not adjectives: people recognise their routine, not "moderately active". */
const ACTIVITY: { key: Activity; label: string; hint: string }[] = [
  { key: "sedentary", label: "Mostly sitting", hint: "Desk job, under 5,000 steps a day" },
  { key: "light", label: "Lightly active", hint: "Some walking, or a workout 1–3 days a week" },
  { key: "moderate", label: "Active", hint: "On your feet a lot, or a workout 3–5 days a week" },
  { key: "active", label: "Very active", hint: "Hard workouts 6–7 days a week" },
  { key: "very_active", label: "Physical job or athlete", hint: "Labour work, or training twice a day" },
];

type Step = "goal" | "sex" | "age" | "height" | "weight" | "activity" | "goalWeight" | "pace";

const QUESTIONS: Record<Step, string> = {
  goal: "What's your goal?",
  sex: "Your sex",
  age: "How old are you?",
  height: "How tall are you?",
  weight: "What do you weigh now?",
  activity: "What's a normal day like?",
  goalWeight: "What's your goal weight?",
  pace: "How fast?",
};

/** Maintaining has no goal weight or pace to choose. */
function stepsFor(goal: GoalType | null): Step[] {
  const base: Step[] = ["goal", "sex", "age", "height", "weight", "activity"];
  return goal === "maintain" ? base : [...base, "goalWeight", "pace"];
}

/**
 * One question per screen. Choices advance on tap; numbers are picked on a ruler, so
 * there's no keyboard and no invalid input. Activity and pace show their calorie effect
 * live (shared formula), so each answer visibly matters.
 */
export default function Onboarding() {
  const profileId = useSession((s) => s.profileId)!;
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId) });
  const saved = existing.data?.profile.goal;
  // Decided once, on first load: the flow saves a goal part-way through.
  const firstSetup = useRef<boolean | null>(null);
  if (existing.data && firstSetup.current === null) firstSetup.current = !existing.data.profile.goal;

  const [step, setStep] = useState(0);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState(28);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(65);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [weeklyKg, setWeeklyKg] = useState<number | null>(null);
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
    setGoalWeight(saved.targetWeightKg);
    setWeeklyKg(saved.goal === "maintain" ? null : saved.weeklyKg);
  }, [saved]);

  const steps = stepsFor(goalType);
  const weightUnit = useUnits((u) => u.weight);

  const request = (overrides: Partial<GoalRequest> = {}): GoalRequest => {
    const goal = overrides.goal ?? goalType!;
    const base: GoalRequest = { age, sex: sex!, heightCm: height, weightKg: weight, activity: activity!, goal };
    if (goal !== "maintain") {
      base.weeklyKg = weeklyKg ?? DEFAULT_PACE[goal];
      if (goalWeight !== null) base.targetWeightKg = goalWeight;
    }
    return { ...base, ...overrides };
  };

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
      // First-time setup ends with the optional report step, unless a report already exists.
      if (firstSetup.current) {
        const { reports } = await api.reports().catch(() => ({ reports: [] as unknown[] }));
        if (reports.length === 0) return router.replace("/report-offer");
      }
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
  });

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
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

  const current = steps[Math.min(step, steps.length - 1)]!;
  const body = { age, sex: sex ?? "other", heightCm: height, weightKg: weight };
  const goalWeightValue =
    goalWeight ?? (goalType === "build_muscle" ? Math.round((weight + 3) * 10) / 10 : Math.max(35, Math.round(weight - 5)));

  const footer =
    current === "age" || current === "height" || current === "weight" ? (
      <Button label="Continue" onPress={next} />
    ) : current === "goalWeight" ? (
      <Button
        label="Continue"
        onPress={() => {
          setGoalWeight(goalWeightValue);
          next();
        }}
      />
    ) : calculate.error ? (
      <T variant="label" tone="plum" align="center">
        {errorMessage(calculate.error)}
      </T>
    ) : calculate.isPending ? (
      <T variant="label" align="center">
        Calculating…
      </T>
    ) : undefined;

  return (
    <Screen footer={footer}>
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
          {steps.map((s, i) => (
            <View key={s} style={[styles.segment, i <= step && styles.segmentOn]} />
          ))}
        </View>
      </View>

      <KimboScene
        step={current}
        heightCm={height}
        weightLabel={formatWeight(weight, weightUnit)}
        goalWeightLabel={formatWeight(goalWeightValue, weightUnit)}
        activity={activity}
        pace={
          goalType && goalType !== "maintain" && weeklyKg !== null && PACES[goalType].length > 1
            ? PACES[goalType].indexOf(weeklyKg) / (PACES[goalType].length - 1)
            : null
        }
      />
      <View style={{ gap: space.xs }}>
        <T variant="title" style={styles.question}>
          {QUESTIONS[current]}
        </T>
        {current === "activity" ? <T variant="label">This sets how many calories you burn on a normal day.</T> : null}
      </View>

      {current === "goal" ? (
        <Options>
          {GOALS.map((g) => (
            <Card
              key={g.key}
              selected={goalType === g.key}
              onPress={() =>
                choose(
                  (v: GoalType) => {
                    if (v !== goalType) {
                      setGoalWeight(null);
                      setWeeklyKg(null);
                    }
                    setGoalType(v);
                  },
                  g.key,
                  next,
                )
              }
              leading={<Icon name={g.icon} size={22} color={goalType === g.key ? colors.white : colors.leafDeep} />}
              label={g.label}
              hint={g.hint}
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
      {current === "height" ? <HeightStep cm={height} onChange={setHeight} /> : null}
      {current === "weight" ? <WeightStep kg={weight} onChange={setWeight} /> : null}

      {current === "activity" ? (
        <Options>
          {ACTIVITY.map((a) => (
            <Card
              key={a.key}
              selected={activity === a.key}
              onPress={() =>
                choose(setActivity, a.key, () =>
                  goalType === "maintain" ? calculate.mutate(request({ activity: a.key })) : next(),
                )
              }
              label={a.label}
              hint={a.hint}
              trailing={<Kcal value={Math.round(maintenanceFor({ ...body, activity: a.key }) / 10) * 10} />}
            />
          ))}
        </Options>
      ) : null}

      {current === "goalWeight" && goalType && goalType !== "maintain" ? (
        <GoalWeightStep goal={goalType} currentKg={weight} kg={goalWeightValue} onChange={setGoalWeight} />
      ) : null}

      {current === "pace" && goalType && goalType !== "maintain" && activity ? (
        <Options>
          {PACES[goalType].map((pace) => {
            const n = computeGoal({
              ...body,
              activity,
              goal: goalType,
              weeklyKg: pace,
              targetWeightKg: goalWeightValue,
            });
            const floored = n.raw < TARGET_BOUNDS_KCAL.min;
            const recommended = pace === recommendedPace(goalType, { ...body, activity });
            return (
              <Card
                key={pace}
                selected={weeklyKg === pace}
                onPress={() =>
                  choose(setWeeklyKg, pace, () =>
                    calculate.mutate(request({ weeklyKg: pace, targetWeightKg: goalWeightValue })),
                  )
                }
                label={`${formatPace(pace, weightUnit)} a week`}
                hint={[
                  recommended ? "Recommended" : null,
                  floored
                    ? `Needs under ${TARGET_BOUNDS_KCAL.min.toLocaleString("en-IN")} kcal, the safe minimum`
                    : n.weeksToGoal
                      ? `Reach ${formatWeight(goalWeightValue, weightUnit)} by ${dateInWeeks(n.weeksToGoal)}`
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={<Kcal value={n.target} />}
              />
            );
          })}
        </Options>
      ) : null}
    </Screen>
  );
}

/**
 * The default pace, unless it would push the target under the safe minimum — then the
 * fastest pace that stays above it (or the gentlest, if none do).
 */
function recommendedPace(goal: "lose" | "build_muscle", body: Omit<Parameters<typeof computeGoal>[0], "goal">) {
  const fits = (pace: number) => computeGoal({ ...body, goal, weeklyKg: pace }).raw >= TARGET_BOUNDS_KCAL.min;
  if (fits(DEFAULT_PACE[goal])) return DEFAULT_PACE[goal];
  const safe = PACES[goal].filter(fits);
  return safe.length ? safe[safe.length - 1]! : PACES[goal][0]!;
}

function Kcal({ value }: { value: number }) {
  return (
    <View style={{ alignItems: "flex-end" }}>
      <T variant="heading">{value.toLocaleString("en-IN")}</T>
      <T variant="caption">kcal a day</T>
    </View>
  );
}

/** Goal weight on the same ruler and units as current weight, limited to the right direction. */
function GoalWeightStep({
  goal,
  currentKg,
  kg,
  onChange,
}: {
  goal: "lose" | "build_muscle";
  currentKg: number;
  kg: number;
  onChange: (kg: number) => void;
}) {
  const unit = useUnits((u) => u.weight);
  const diff = Math.abs(kg - currentKg);
  const min = goal === "lose" ? 30 : Math.ceil(currentKg + 0.5);
  const max = goal === "lose" ? Math.floor(currentKg - 0.5) : Math.ceil(currentKg + 30);
  return (
    <View style={{ gap: space.lg }}>
      {unit === "kg" ? (
        <RulerPicker
          key="kg"
          label="Goal weight"
          value={kg}
          onChange={onChange}
          min={min}
          max={max}
          step={0.1}
          majorEvery={10}
          unit="kg"
        />
      ) : (
        <RulerPicker
          key="lb"
          label="Goal weight"
          value={kgToLb(kg)}
          onChange={(lb) => onChange(lbToKg(lb))}
          min={kgToLb(min)}
          max={kgToLb(max)}
          unit="lb"
        />
      )}
      <T variant="label" align="center">
        That's {formatWeight(Math.round(diff * 10) / 10, unit)} {goal === "lose" ? "to lose" : "to gain"} from{" "}
        {formatWeight(currentKg, unit)}.
      </T>
    </View>
  );
}

function dateInWeeks(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
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
  const weightUnit = useUnits((u) => u.weight);
  const verb = b.kgPerWeek < 0 ? "Lose" : "Build";
  const pace =
    b.kgPerWeek === 0
      ? "Keeps your weight where it is"
      : goal.targetWeightKg && b.weeksToGoal
        ? `${verb} ${formatPace(Math.abs(b.kgPerWeek), weightUnit)} a week · ${formatWeight(goal.targetWeightKg, weightUnit)} by ${dateInWeeks(b.weeksToGoal)}`
        : `${verb} ${formatPace(Math.abs(b.kgPerWeek), weightUnit)} a week`;
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

/**
 * Height in cm or feet/inches. State stays in cm (what the API stores); the ruler
 * remounts per unit so it scrolls to the converted value.
 */
function HeightStep({ cm, onChange }: { cm: number; onChange: (cm: number) => void }) {
  const unit = useUnits((u) => u.height);
  const setUnits = useUnits((u) => u.set);
  return (
    <View style={{ gap: space.lg }}>
      <Segmented<HeightUnit>
        options={[
          { value: "ftin", label: "ft / in" },
          { value: "cm", label: "cm" },
        ]}
        value={unit}
        onChange={(height) => setUnits({ height })}
      />
      {unit === "cm" ? (
        <RulerPicker key="cm" label="Height" value={Math.round(cm)} onChange={onChange} min={120} max={220} unit="cm" />
      ) : (
        <RulerPicker
          key="in"
          label="Height"
          value={cmToIn(cm)}
          onChange={(inches) => onChange(inToCm(inches))}
          min={48}
          max={86}
          majorEvery={12}
          unit=""
          format={formatFeetInches}
          tickFormat={(inches) => `${inches / 12} ft`}
        />
      )}
    </View>
  );
}

function WeightStep({ kg, onChange }: { kg: number; onChange: (kg: number) => void }) {
  const unit = useUnits((u) => u.weight);
  const setUnits = useUnits((u) => u.set);
  return (
    <View style={{ gap: space.lg }}>
      <Segmented<WeightUnit>
        options={[
          { value: "kg", label: "kg" },
          { value: "lb", label: "lb" },
        ]}
        value={unit}
        onChange={(weight) => setUnits({ weight })}
      />
      {unit === "kg" ? (
        <RulerPicker
          key="kg"
          label="Weight"
          value={kg}
          onChange={onChange}
          min={30}
          max={200}
          step={0.1}
          majorEvery={10}
          unit="kg"
        />
      ) : (
        <RulerPicker
          key="lb"
          label="Weight"
          value={kgToLb(kg)}
          onChange={(lb) => onChange(lbToKg(lb))}
          min={70}
          max={440}
          unit="lb"
        />
      )}
    </View>
  );
}

function Options({ children }: { children: ReactNode }) {
  return <View style={{ gap: space.md }}>{children}</View>;
}

function Card({
  label,
  hint,
  leading,
  trailing,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  leading?: ReactNode;
  /** e.g. the calorie effect of this choice */
  trailing?: ReactNode;
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
      {trailing}
      {selected && !trailing ? <Icon name="check" size={20} color={colors.leaf} /> : null}
    </Pressable>
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
  question: { fontSize: 28, lineHeight: 34, marginTop: space.xs, marginBottom: space.md },
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
