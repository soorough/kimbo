import { computeGoal, DEFAULT_PACE, isWeightGoal, PACES, TARGET_BOUNDS_KCAL, type GoalRequest } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { PacePlanner } from "@/components/PacePlanner";
import { Button, Chip, Screen, Segmented, Stepper, Surface, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { formatPace, useUnits } from "@/lib/units";

type GoalType = GoalRequest["goal"];
type Activity = GoalRequest["activity"];
type Sex = GoalRequest["sex"];

const GOALS: { value: GoalType; label: string }[] = [
  { value: "lose", label: "Lose" },
  { value: "maintain", label: "Maintain" },
  { value: "recomp", label: "Maingain" },
  { value: "build_muscle", label: "Build" },
];
const ACTIVITIES: { value: Activity; label: string }[] = [
  { value: "sedentary", label: "Mostly sitting" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Active" },
  { value: "active", label: "Very active" },
  { value: "very_active", label: "Athlete" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const MIN_GAIN_KG = 2;

/** One screen to change any part of the goal; the daily target updates as you go. */
export default function EditGoal() {
  const profileId = useSession((s) => s.profileId)!;
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId) });
  const saved = profile.data?.profile.goal;
  const weightUnit = useUnits((u) => u.weight);

  const [goal, setGoal] = useState<GoalType>("lose");
  const [weight, setWeight] = useState(65);
  const [goalWeight, setGoalWeight] = useState(60);
  const [pace, setPace] = useState(0.5);
  const [activity, setActivity] = useState<Activity>("light");
  const [sex, setSex] = useState<Sex>("other");
  const [age, setAge] = useState(28);
  const [height, setHeight] = useState(165);
  /** null follows the formula; a number is the user's own target */
  const [override, setOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!saved) return;
    setGoal(saved.goal);
    setWeight(saved.weightKg);
    setGoalWeight(saved.targetWeightKg ?? (saved.goal === "build_muscle" ? saved.weightKg + 3 : saved.weightKg - 5));
    setPace(isWeightGoal(saved.goal) ? saved.weeklyKg : DEFAULT_PACE.lose);
    setActivity(saved.activity);
    setSex(saved.sex);
    setAge(saved.age);
    setHeight(saved.heightCm);
    setOverride(saved.targetOverride ?? null);
  }, [saved]);

  // Keep the goal weight on the right side of today's weight, and the pace one this goal offers.
  const gw =
    goal === "build_muscle"
      ? Math.max(goalWeight, round1(weight + MIN_GAIN_KG))
      : goal === "lose"
        ? Math.min(goalWeight, Math.floor(weight - 0.5))
        : null;
  const paces = isWeightGoal(goal) ? PACES[goal] : [];
  const weeklyKg = isWeightGoal(goal) ? (paces.includes(pace) ? pace : DEFAULT_PACE[goal]) : undefined;

  const request: GoalRequest = {
    goal,
    age,
    sex,
    heightCm: height,
    weightKg: weight,
    activity,
    ...(isWeightGoal(goal) ? { weeklyKg, targetWeightKg: gw! } : {}),
  };
  const computed = computeGoal(request).target;
  const target = override ?? computed;

  /** Any change to the inputs drops a custom target, so the number always reflects the answers. */
  const edit =
    <V,>(set: (v: V) => void) =>
    (v: V) => {
      set(v);
      setOverride(null);
    };

  const save = useMutation({
    mutationFn: () => api.saveGoal(profileId, override !== null && override !== computed ? { ...request, targetOverride: override } : request),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    },
  });

  return (
    <Screen
      back
      title="Edit goal"
      footer={<Button label="Save goal" loading={save.isPending} disabled={!saved} onPress={() => save.mutate()} />}
    >
      <Surface tint="leaf" style={styles.targetCard}>
        <T variant="overline" tone="soft">
          DAILY TARGET
        </T>
        <View style={styles.targetRow}>
          <Chip label="−50" onPress={() => setOverride(Math.max(TARGET_BOUNDS_KCAL.min, target - 50))} />
          <View style={{ alignItems: "center", flex: 1 }}>
            <T variant="number" style={{ fontSize: 40, lineHeight: 46 }}>
              {target}
            </T>
            <T variant="caption">{override !== null && override !== computed ? `Custom · formula says ${computed}` : "kcal a day"}</T>
          </View>
          <Chip label="+50" onPress={() => setOverride(Math.min(TARGET_BOUNDS_KCAL.max, target + 50))} />
        </View>
      </Surface>

      <Section title="Goal">
        <Segmented options={GOALS} value={goal} onChange={edit(setGoal)} />
      </Section>

      <Surface style={{ gap: space.lg }}>
        <Field label="Current weight" hint="kg">
          <Stepper value={weight} step={0.1} min={30} max={300} onChange={edit((v: number) => setWeight(round1(v)))} />
        </Field>
        {gw !== null ? (
          <Field label="Goal weight" hint={`${round1(Math.abs(gw - weight))} kg to ${goal === "lose" ? "lose" : "gain"}`}>
            <Stepper
              value={gw}
              step={0.5}
              min={goal === "lose" ? 30 : round1(weight + MIN_GAIN_KG)}
              max={goal === "lose" ? Math.floor(weight - 0.5) : 300}
              onChange={edit((v: number) => setGoalWeight(round1(v)))}
            />
          </Field>
        ) : null}
      </Surface>

      {paces.length ? (
        <Section title="Pace">
          <View style={styles.chips}>
            {paces.map((p) => (
              <Chip key={p} label={`${formatPace(p, weightUnit)} / week`} selected={weeklyKg === p} onPress={() => edit(setPace)(p)} />
            ))}
          </View>
          {isWeightGoal(goal) && gw !== null ? (
            <PacePlanner
              goal={goal}
              body={{ age, sex, heightCm: height, weightKg: weight, activity }}
              targetWeightKg={gw}
              onUsePace={edit(setPace)}
              onUseGoalWeight={edit((kg: number) => setGoalWeight(kg))}
            />
          ) : null}
        </Section>
      ) : null}

      <Section title="Normal day">
        <View style={styles.chips}>
          {ACTIVITIES.map((a) => (
            <Chip key={a.value} label={a.label} selected={activity === a.value} onPress={() => edit(setActivity)(a.value)} />
          ))}
        </View>
      </Section>

      <Section title="About you">
        <Segmented options={SEXES} value={sex} onChange={edit(setSex)} />
        <Surface style={{ gap: space.lg }}>
          <Field label="Age" hint="years">
            <Stepper value={age} step={1} min={15} max={100} onChange={edit(setAge)} />
          </Field>
          <Field label="Height" hint="cm">
            <Stepper value={height} step={1} min={100} max={250} onChange={edit(setHeight)} />
          </Field>
        </Surface>
      </Section>

      {save.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(save.error)}
        </T>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T variant="label">{title}</T>
      {children}
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{label}</T>
        <T variant="caption">{hint}</T>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  targetCard: { gap: space.sm },
  targetRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  field: { flexDirection: "row", alignItems: "center", gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});

