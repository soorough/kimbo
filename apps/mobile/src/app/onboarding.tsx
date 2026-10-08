import {
  computeGoal,
  DEFAULT_PACE,
  isWeightGoal,
  maintenanceFor,
  PACES,
  TARGET_BOUNDS_KCAL,
  type Barrier,
  type Diet,
  type Goal,
  type GoalRequest,
} from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { KimboScene } from "@/components/KimboScene";
import { NameField } from "@/components/NameField";
import { BuildingPlan } from "@/components/BuildingPlan";
import { GoalPath } from "@/components/GoalPath";
import { ReportOptions } from "@/components/ReportOptions";
import { PacePlanner } from "@/components/PacePlanner";
import { RulerPicker } from "@/components/RulerPicker";
import { Button, Icon, Screen, Segmented, SegmentRing, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, fonts, macroColors, radius, space } from "@/lib/theme";
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
  { key: "maintain", icon: "minus", label: "Stay where I am", hint: "Keep your weight, focus on your report" },
  {
    key: "build_muscle",
    icon: "zap",
    label: "Build muscle",
    hint: "A small surplus and more protein, not just weight",
  },
  {
    key: "recomp",
    icon: "refresh-cw",
    label: "Build muscle, keep my weight",
    hint: "Maingain: maintenance calories, more protein, for people who lift",
  },
];
/** Indian diets, so Kimbo never suggests chicken to a vegetarian or onion to someone who eats Jain. */
const DIETS: { key: Diet; label: string; hint: string }[] = [
  { key: "vegetarian", label: "Vegetarian", hint: "No meat, fish or eggs" },
  { key: "eggetarian", label: "Eggetarian", hint: "Vegetarian, plus eggs" },
  { key: "non_vegetarian", label: "Non-vegetarian", hint: "Chicken, fish, mutton, eggs" },
  { key: "vegan", label: "Vegan", hint: "No dairy, meat or eggs" },
  { key: "jain", label: "Jain", hint: "No onion, garlic or root vegetables" },
];
/** Kimbo shapes its suggestions around these; pick up to two. */
const BARRIERS: { key: Barrier; icon: IconName; label: string; hint: string }[] = [
  { key: "busy", icon: "clock", label: "Busy schedule", hint: "Kimbo keeps logging to one tap" },
  { key: "ideas", icon: "help-circle", label: "Not sure what to eat", hint: "Kimbo suggests dishes that fit" },
  { key: "consistency", icon: "repeat", label: "Hard to stay consistent", hint: "Gentle nudges, no broken streaks" },
  { key: "eating_out", icon: "map-pin", label: "Eating out or family meals", hint: "Swaps and portions, not recipes" },
  { key: "cravings", icon: "coffee", label: "Cravings, sweets and chai", hint: "Small swaps, no guilt" },
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

type Step =
  | "name"
  | "goal"
  | "diet"
  | "barriers"
  | "sex"
  | "age"
  | "height"
  | "weight"
  | "activity"
  | "goalWeight"
  | "pace"
  | "report";

const QUESTIONS: Record<Step, string> = {
  name: "Hi, I'm Kimbo. What should I call you?",
  goal: "What's your goal?",
  diet: "What do you eat?",
  barriers: "What usually gets in the way?",
  sex: "Your sex",
  age: "How old are you?",
  height: "How tall are you?",
  weight: "What do you weigh now?",
  activity: "What's a normal day like?",
  goalWeight: "What's your goal weight?",
  pace: "How fast?",
  report: "Got a recent blood report?",
};

/** Maintaining has no goal weight or pace to choose. */
/**
 * Three parts that read like a conversation: about you, then your goal (asked once Kimbo
 * knows your weight), then how Kimbo can help. The report comes last, right before the
 * plan is built, so its focus is part of the plan from day one.
 */
const SECTIONS = [
  { label: "About you", steps: ["name", "sex", "age", "height", "weight", "activity"] },
  { label: "Your goal", steps: ["goal", "goalWeight", "pace"] },
  { label: "Your plan", steps: ["diet", "barriers", "report"] },
] as const satisfies readonly { label: string; steps: readonly Step[] }[];

function stepsFor(goal: GoalType | null): Step[] {
  const all = SECTIONS.flatMap((s) => s.steps) as Step[];
  // Maintaining has no goal weight or pace to choose.
  return goal && isWeightGoal(goal) ? all : all.filter((s) => s !== "goalWeight" && s !== "pace");
}

/**
 * One question per screen. Kimbo introduces itself first and asks for a name (optional, the
 * only typed answer). Choices advance on tap; numbers are picked on a ruler, so there's no
 * keyboard and no invalid input. Activity and pace show their calorie effect
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
  const [name, setName] = useState("");
  const [diet, setDiet] = useState<Diet | null>(null);
  const [barriers, setBarriers] = useState<Barrier[]>([]);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState(28);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(65);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [weeklyKg, setWeeklyKg] = useState<number | null>(null);
  const [result, setResult] = useState<Goal | null>(null);
  const [building, setBuilding] = useState(false);
  const finishBuilding = useCallback(() => setBuilding(false), []);
  const [target, setTarget] = useState(0);

  const savedName = existing.data?.profile.name;
  const savedPrefs = existing.data?.profile;
  useEffect(() => {
    if (!savedPrefs) return;
    setDiet(savedPrefs.diet);
    setBarriers(savedPrefs.barriers);
  }, [savedPrefs]);
  useEffect(() => {
    if (savedName) setName(savedName);
  }, [savedName]);

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
    setWeeklyKg(isWeightGoal(saved.goal) ? saved.weeklyKg : null);
  }, [saved]);

  const steps = stepsFor(goalType);
  const weightUnit = useUnits((u) => u.weight);

  const request = (overrides: Partial<GoalRequest> = {}): GoalRequest => {
    const goal = overrides.goal ?? goalType!;
    const base: GoalRequest = { age, sex: sex!, heightCm: height, weightKg: weight, activity: activity!, goal };
    if (isWeightGoal(goal)) {
      base.weeklyKg = weeklyKg ?? DEFAULT_PACE[goal];
      if (goalWeight !== null) base.targetWeightKg = goalWeight;
    }
    return { ...base, ...overrides };
  };

  const calculate = useMutation({
    // Preserve an existing custom target while recalculating; "Start my plan" decides the final value.
    mutationFn: (req: GoalRequest) =>
      api.saveGoal(profileId, saved?.targetOverride ? { ...req, targetOverride: saved.targetOverride } : req),
    // First setup gets the "putting your plan together" moment; editing later goes straight to the plan.
    onMutate: () => setBuilding(firstSetup.current === true),
    onSuccess: ({ profile }) => {
      setResult(profile.goal);
      setTarget(profile.goal!.effectiveTarget);
    },
    onError: () => setBuilding(false),
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

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));

  // Refetched after a report is confirmed (every write invalidates queries), so the step shows it was added.
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports, enabled: steps[step] === "report" });
  const latestReport = reports.data?.reports[0] ?? null;
  const buildPlan = () => calculate.mutate(request());
  // A report confirmed from this step already ended on "Build my plan", so don't ask twice: build straight
  // away, but only once we're back on screen, so the plan-building moment is actually seen.
  const focused = useIsFocused();
  const awaitingReport = useRef(false);
  useEffect(() => {
    if (steps[step] !== "report" || !reports.data) return;
    if (!latestReport) awaitingReport.current = true;
    else if (focused && awaitingReport.current && !calculate.isPending && !result) {
      awaitingReport.current = false;
      buildPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.data, step, focused]);

  const saveName = useMutation({
    mutationFn: () => api.saveName(profileId, { name: name.trim() || null }),
    onSuccess: ({ profile }) => {
      queryClient.setQueryData(["profile", profileId], { profile });
      next();
    },
  });
  const savePrefs = useMutation({
    mutationFn: (body: { diet: Diet | null; barriers: Barrier[] }) => api.savePreferences(profileId, body),
    onSuccess: ({ profile }) => queryClient.setQueryData(["profile", profileId], { profile }),
  });
  /** Saved as each step is answered; a failed save never blocks onboarding (both are editable later). */
  const chooseDiet = (d: Diet | null) =>
    choose(setDiet, d, () => {
      savePrefs.mutate({ diet: d, barriers });
      next();
    });
  const toggleBarrier = (b: Barrier) => {
    Haptics.selectionAsync().catch(() => {});
    setBarriers((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b].slice(-2)));
  };
  const submitBarriers = () => {
    savePrefs.mutate({ diet, barriers });
    next();
  };

  /** Skipping is fine; only a changed name costs a request. */
  const submitName = () => ((name.trim() || null) === (savedName ?? null) ? next() : saveName.mutate());
  /** Single-choice answers move on by themselves after a beat, so the choice registers visually. */
  const choose = <V,>(set: (v: V) => void, v: V, then: () => void) => {
    set(v);
    Haptics.selectionAsync().catch(() => {});
    setTimeout(then, 220);
  };

  if (building) {
    return (
      <BuildingPlan
        name={name.trim() || null}
        ready={result !== null}
        hasReport={latestReport !== null}
        onDone={finishBuilding}
      />
    );
  }

  if (result) {
    return (
      <Reveal
        goal={result}
        target={target}
        onConfirm={() => confirm.mutate()}
        confirming={confirm.isPending}
        error={confirm.error ? errorMessage(confirm.error) : null}
        onBack={() => setResult(null)}
        name={name.trim() || null}
      />
    );
  }

  const current = steps[Math.min(step, steps.length - 1)]!;
  const body = { age, sex: sex ?? "other", heightCm: height, weightKg: weight };
  // A remembered goal is kept only while it still points the right way from today's weight.
  const goalWeightValue =
    goalType === "build_muscle"
      ? Math.max(goalWeight ?? round1(weight + 3), gainFloor(weight))
      : Math.min(goalWeight ?? Math.max(35, Math.round(weight - 5)), loseCeiling(weight));

  const footer =
    current === "name" ? (
      <View style={{ gap: space.sm }}>
        {saveName.error ? (
          <T variant="label" tone="plum" align="center">
            {errorMessage(saveName.error)}
          </T>
        ) : null}
        <Button label={name.trim() ? "Continue" : "Skip"} loading={saveName.isPending} onPress={submitName} />
      </View>
    ) : current === "report" ? (
      calculate.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(calculate.error)}
        </T>
      ) : latestReport ? (
        <Button label="Build my plan" loading={calculate.isPending} onPress={buildPlan} />
      ) : undefined
    ) : current === "diet" ? (
      <Button label="Skip" kind="ghost" onPress={() => chooseDiet(null)} />
    ) : current === "barriers" ? (
      <Button label={barriers.length ? "Continue" : "Skip"} onPress={submitBarriers} />
    ) : current === "age" || current === "height" || current === "weight" ? (
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
        <SectionProgress steps={goalType ? steps : stepsFor("lose")} current={step} />
      </View>

      <KimboScene
        step={current}
        heightCm={height}
        weightLabel={formatWeight(weight, weightUnit)}
        goalWeightLabel={formatWeight(goalWeightValue, weightUnit)}
        activity={activity}
        pace={
          goalType && isWeightGoal(goalType) && weeklyKg !== null && PACES[goalType].length > 1
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

      {current === "name" ? <NameField value={name} onChange={setName} onSubmit={submitName} autoFocus /> : null}

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

      {current === "report" ? (
        latestReport ? (
          <View style={styles.reportDone}>
            <Icon name="check-circle" size={22} color={colors.leaf} />
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">Report added</T>
              <T variant="caption">Kimbo will build your plan around it.</T>
            </View>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <T variant="body" tone="soft">
              Kimbo reads your LDL, HbA1c and triglycerides and picks one thing to eat more of.
            </T>
            <ReportOptions from="onboarding" />
            {/* Adding a report is the main path; skipping stays available but quiet. */}
            <Pressable accessibilityRole="button" onPress={buildPlan} hitSlop={8} style={styles.skipLink}>
              <T variant="label" tone="soft" align="center">
                I don't have one right now
              </T>
            </Pressable>
          </View>
        )
      ) : null}

      {current === "diet" ? (
        <Options>
          {DIETS.map((d) => (
            <Card
              key={d.key}
              selected={diet === d.key}
              onPress={() => chooseDiet(d.key)}
              label={d.label}
              hint={d.hint}
            />
          ))}
          <T variant="caption" align="center">
            Kimbo only suggests dishes you eat.
          </T>
        </Options>
      ) : null}

      {current === "barriers" ? (
        <Options>
          <T variant="label">Pick up to two. Kimbo will plan around them.</T>
          {BARRIERS.map((b) => (
            <Card
              key={b.key}
              selected={barriers.includes(b.key)}
              onPress={() => toggleBarrier(b.key)}
              leading={
                <Icon name={b.icon} size={22} color={barriers.includes(b.key) ? colors.white : colors.leafDeep} />
              }
              label={b.label}
              hint={b.hint}
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
              onPress={() => choose(setActivity, a.key, next)}
              label={a.label}
              hint={a.hint}
              trailing={<Kcal value={Math.round(maintenanceFor({ ...body, activity: a.key }) / 10) * 10} />}
            />
          ))}
        </Options>
      ) : null}

      {current === "goalWeight" && goalType && isWeightGoal(goalType) ? (
        <GoalWeightStep goal={goalType} currentKg={weight} kg={goalWeightValue} onChange={setGoalWeight} />
      ) : null}

      {current === "pace" && goalType && isWeightGoal(goalType) && activity ? (
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
                  choose(setWeeklyKg, pace, () => {
                    setGoalWeight(goalWeightValue);
                    next();
                  })
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
          <PacePlanner
            goal={goalType}
            body={{ ...body, activity }}
            targetWeightKg={goalWeightValue}
            onUsePace={(pace) => {
              setWeeklyKg(pace);
              setGoalWeight(goalWeightValue);
              next();
            }}
            onUseGoalWeight={(kg) => setGoalWeight(kg)}
          />
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

const round1 = (kg: number) => Math.round(kg * 10) / 10;
/** Gaining means at least 2 kg up; smaller changes are within normal day-to-day swings. */
const MIN_GAIN_KG = 2;
const gainFloor = (currentKg: number) => round1(currentKg + MIN_GAIN_KG);
const loseCeiling = (currentKg: number) => Math.floor(currentKg - 0.5);

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
  const min = goal === "lose" ? 30 : gainFloor(currentKg);
  const max = goal === "lose" ? loseCeiling(currentKg) : Math.ceil(currentKg + 30);
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
  // Always with the year: "24 Dec" alone could be any December.
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Reveal({
  goal,
  target,
  onConfirm,
  confirming,
  error,
  onBack,
  name,
}: {
  goal: Goal;
  target: number;
  onConfirm: () => void;
  confirming: boolean;
  error: string | null;
  onBack: () => void;
  name: string | null;
}) {
  const shown = useCountUp(target);
  const b = goal.breakdown;
  const macros = [
    { label: "Protein", grams: goal.targets.protein, kcalPerGram: 4, color: macroColors.protein },
    { label: "Carbs", grams: goal.targets.carbs, kcalPerGram: 4, color: macroColors.carbs },
    { label: "Fat", grams: goal.targets.fat, kcalPerGram: 9, color: macroColors.fat },
  ];
  const weightUnit = useUnits((u) => u.weight);
  const verb = b.kgPerWeek < 0 ? "Lose" : "Build";
  const pace =
    goal.goal === "recomp"
      ? "Same weight, more protein, so muscle replaces fat"
      : b.kgPerWeek === 0
        ? "Keeps your weight where it is"
        : goal.targetWeightKg && b.weeksToGoal
          ? `${verb} ${formatPace(Math.abs(b.kgPerWeek), weightUnit)} a week · ${formatWeight(goal.targetWeightKg, weightUnit)} by ${dateInWeeks(b.weeksToGoal)}`
          : `${verb} ${formatPace(Math.abs(b.kgPerWeek), weightUnit)} a week`;
  const paceIcon: IconName =
    goal.goal === "recomp"
      ? "refresh-cw"
      : b.kgPerWeek < 0
        ? "trending-down"
        : b.kgPerWeek > 0
          ? "trending-up"
          : "minus";

  const showPath = isWeightGoal(goal.goal) && goal.targetWeightKg !== null && b.weeksToGoal !== null;

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {error ? (
            <T variant="label" tone="plum" align="center">
              {error}
            </T>
          ) : null}
          <Button label="Start my plan" loading={confirming} onPress={onConfirm} />
        </View>
      }
    >
      <View style={styles.progressRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit answers"
          hitSlop={12}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
      </View>
      <T variant="title" style={styles.question}>
        {name ? `Here's your plan, ${name}.` : "Here's your plan."}
      </T>

      {showPath ? (
        // One hero: the user's own line, Kimbo riding it to the date. The target is a single line under it.
        <>
          <GoalPath
            startLabel={formatWeight(goal.weightKg, weightUnit)}
            goalLabel={formatWeight(goal.targetWeightKg!, weightUnit)}
            dateLabel={dateInWeeks(b.weeksToGoal!)}
            losing={goal.goal === "lose"}
          />
          <View style={styles.targetLine}>
            <T variant="title" align="center">
              Eat about{" "}
              <T variant="title" style={styles.targetNumber}>
                {shown.toLocaleString("en-IN")} kcal
              </T>{" "}
              a day
            </T>
            <T variant="label" tone="soft" align="center">
              {`${formatPace(Math.abs(b.kgPerWeek), weightUnit)} a week · ${paceWord(goal.goal, Math.abs(b.kgPerWeek))}`}
            </T>
          </View>
        </>
      ) : (
        // No goal weight or date to draw: the target itself is the hero.
        <View style={styles.revealTop}>
          <SegmentRing
            segments={macros.map((m) => ({ value: m.grams * m.kcalPerGram, color: m.color }))}
            size={200}
            stroke={14}
          >
            <Kimbo mood="happy" size={48} leaves={2} />
            <T variant="display" style={styles.bigNumber}>
              {shown.toLocaleString("en-IN")}
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
      )}

      <T variant="caption" align="center">
        Set from your age, height, weight and activity. Change it any time in Edit goal.
      </T>

      <View style={styles.disclosures}>
        <Disclosure title="See the breakdown">
          {[
            { value: `${goal.targets.protein} g protein`, why: PROTEIN_WHY[goal.goal], color: macroColors.protein },
            { value: `${goal.targets.carbs} g carbs`, why: "Energy for your day", color: macroColors.carbs },
            { value: `${goal.targets.fat} g fat`, why: "Keeps meals satisfying", color: macroColors.fat },
            {
              value: `${goal.targets.fibre} g fibre or more`,
              why: "Keeps you full, helps cholesterol",
              color: macroColors.fibre,
            },
            { value: `Under ${goal.targets.satFat} g saturated fat`, why: "A limit, not a goal", color: colors.plum },
          ].map((r) => (
            // Value on one line, what it's for on the next: no maths needed.
            <View key={r.value} style={styles.breakdownRow}>
              <View style={[styles.macroDot, { backgroundColor: r.color, marginBottom: 0, marginTop: 7 }]} />
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{r.value}</T>
                <T variant="caption">{r.why}</T>
              </View>
            </View>
          ))}
        </Disclosure>
      </View>
    </Screen>
  );
}

/** Three labelled bars, each filling with its own section, so a long setup feels like three short ones. */
function SectionProgress({ steps, current }: { steps: Step[]; current: number }) {
  const at = steps[current];
  return (
    <View style={styles.sections}>
      {SECTIONS.map((sec) => {
        const mine = steps.filter((s) => (sec.steps as readonly Step[]).includes(s));
        const done = mine.filter((s) => steps.indexOf(s) <= current).length;
        const active = at !== undefined && (sec.steps as readonly Step[]).includes(at);
        return (
          <View key={sec.label} style={styles.section}>
            <View style={styles.sectionTrack}>
              <View style={[styles.sectionFill, { width: `${(done / Math.max(1, mine.length)) * 100}%` }]} />
            </View>
            <T variant="caption" tone={active ? undefined : "faint"} style={active ? styles.sectionOn : undefined}>
              {sec.label}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** How a weekly pace feels, in a few plain words (the numbers are in "How fast?"). */
function paceWord(goal: GoalType, kgPerWeek: number): string {
  if (goal === "build_muscle") return kgPerWeek <= 0.25 ? "lean, mostly muscle" : "faster, some fat too";
  if (kgPerWeek <= 0.25) return "gentle, keeps muscle";
  if (kgPerWeek <= 0.5) return "steady and sustainable";
  if (kgPerWeek <= 0.75) return "faster, takes effort";
  return "fast, hardest to keep up";
}

/** What the protein number is for, in the user's terms. */
const PROTEIN_WHY: Record<GoalType, string> = {
  lose: "Keeps muscle while you lose",
  maintain: "Keeps you full between meals",
  build_muscle: "Builds muscle with your training",
  recomp: "Builds muscle while weight stays put",
};

/** A closed-by-default row: detail for anyone who wants it, nothing to read for anyone who doesn't. */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.disclosureRow}
      >
        <T variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </T>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.inkSoft} />
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
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
  sections: { flex: 1, flexDirection: "row", gap: space.sm },
  section: { flex: 1, gap: 4 },
  sectionTrack: { height: 5, borderRadius: 3, backgroundColor: colors.sunk, overflow: "hidden" },
  sectionFill: { height: 5, borderRadius: 3, backgroundColor: colors.leaf },
  sectionOn: { color: colors.leafDeep, fontFamily: fonts.semibold },
  skipLink: { paddingVertical: space.sm },
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
  targetLine: { gap: 4, marginTop: space.sm },
  targetNumber: { color: colors.leafDeep },
  reportDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.leafSoft,
  },
  disclosures: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
  disclosureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  disclosureBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  breakdownRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
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
  macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
});
