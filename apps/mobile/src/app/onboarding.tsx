import type { Goal, GoalRequest } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Bar, Button, Chip, Icon, Screen, Segmented, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, fonts, radius, space } from "@/lib/theme";

const ACTIVITY: { key: GoalRequest["activity"]; icon: IconName; label: string; hint: string }[] = [
  { key: "sedentary", icon: "monitor", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { key: "light", icon: "navigation", label: "Lightly active", hint: "Walks or exercise 1–3 days a week" },
  { key: "moderate", icon: "activity", label: "Moderately active", hint: "Exercise 3–5 days a week" },
  { key: "active", icon: "zap", label: "Very active", hint: "Hard exercise 6–7 days a week" },
  { key: "very_active", icon: "award", label: "Extremely active", hint: "Physical job or twice-daily training" },
];
const GOALS: { key: GoalRequest["goal"]; icon: IconName; label: string; hint: string }[] = [
  { key: "lose", icon: "trending-down", label: "Lose weight", hint: "A gentle, steady deficit" },
  { key: "maintain", icon: "minus", label: "Maintain", hint: "Eat for the weight you're at" },
  { key: "gain", icon: "trending-up", label: "Gain weight", hint: "A modest surplus" },
];

/** Client-side ranges mirror the API's validation so mistakes are caught as you type. */
const RANGES = { age: [15, 100, "years"], heightCm: [100, 250, "cm"], weightKg: [30, 300, "kg"] } as const;

const STEPS = ["About you", "How active are you?", "What's your goal?"] as const;

/** One question per step: short, forgiving, and easy to finish on a phone. */
export default function Onboarding() {
  const profileId = useSession((s) => s.profileId)!;
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId) });
  const saved = existing.data?.profile.goal;

  const [step, setStep] = useState(0);
  const [fields, setFields] = useState({ age: "", heightCm: "", weightKg: "" });
  const [sex, setSex] = useState<GoalRequest["sex"] | null>(null);
  const [activity, setActivity] = useState<GoalRequest["activity"] | null>(null);
  const [goalType, setGoalType] = useState<GoalRequest["goal"] | null>(null);
  const [result, setResult] = useState<Goal | null>(null);
  const [target, setTarget] = useState(0);

  // Editing later: start from what's saved.
  useEffect(() => {
    if (!saved) return;
    setFields({ age: String(saved.age), heightCm: String(saved.heightCm), weightKg: String(saved.weightKg) });
    setSex(saved.sex);
    setActivity(saved.activity);
    setGoalType(saved.goal);
  }, [saved]);

  const fieldError = (key: keyof typeof RANGES): string | null => {
    const raw = fields[key];
    if (!raw) return null;
    const [min, max, unit] = RANGES[key];
    const n = Number(raw);
    return n >= min && n <= max ? null : `Between ${min} and ${max} ${unit}`;
  };
  const aboutValid =
    !!sex && (Object.keys(RANGES) as (keyof typeof RANGES)[]).every((k) => fields[k] && !fieldError(k));

  const request = (): GoalRequest => ({
    age: Number(fields.age),
    sex: sex!,
    heightCm: Number(fields.heightCm),
    weightKg: Number(fields.weightKg),
    activity: activity!,
    goal: goalType!,
  });

  const calculate = useMutation({
    // Preserve an existing custom target while recalculating; "Looks good" decides the final value.
    mutationFn: () =>
      api.saveGoal(
        profileId,
        saved?.targetOverride ? { ...request(), targetOverride: saved.targetOverride } : request(),
      ),
    onSuccess: ({ profile }) => {
      setResult(profile.goal);
      setTarget(profile.goal!.effectiveTarget);
    },
  });

  const confirm = useMutation({
    mutationFn: () =>
      api.saveGoal(profileId, target !== result!.computedTarget ? { ...request(), targetOverride: target } : request()),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
  });

  if (result) {
    return (
      <Screen
        footer={<Button label="Looks good" icon="check" loading={confirm.isPending} onPress={() => confirm.mutate()} />}
      >
        <View style={styles.reveal}>
          <Kimbo mood="happy" size={100} leaves={2} />
          <T variant="overline">YOUR DAILY TARGET</T>
          <T variant="display" style={{ fontSize: 48, lineHeight: 54 }}>
            {target}
            <T variant="title" tone="soft">
              {" "}
              kcal
            </T>
          </T>
          <View style={styles.adjust}>
            <Chip
              label="−50 kcal"
              icon="minus"
              disabled={target <= 1200}
              onPress={() => setTarget(Math.max(1200, target - 50))}
            />
            <Chip
              label="+50 kcal"
              icon="plus"
              disabled={target >= 4000}
              onPress={() => setTarget(Math.min(4000, target + 50))}
            />
          </View>
          <T variant="caption" align="center">
            {target === result.computedTarget
              ? "Adjust it if you or your doctor prefer a different number."
              : `Kimbo suggested ${result.computedTarget} kcal`}
          </T>
        </View>
        <Surface>
          <T variant="heading">How Kimbo got here</T>
          {result.explanation.map((line, i) => (
            <View key={line} style={styles.explain}>
              <View style={styles.explainNum}>
                <T variant="caption" tone="leaf">
                  {i + 1}
                </T>
              </View>
              <T variant="body" style={{ flex: 1 }}>
                {line}
              </T>
            </View>
          ))}
        </Surface>
        {confirm.error ? (
          <T variant="label" tone="plum" align="center">
            {errorMessage(confirm.error)}
          </T>
        ) : null}
        <Button label="Change my details" kind="ghost" onPress={() => setResult(null)} />
      </Screen>
    );
  }

  const canContinue = step === 0 ? aboutValid : step === 1 ? !!activity : !!goalType;

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {calculate.error ? (
            <T variant="label" tone="plum" align="center">
              {errorMessage(calculate.error)}
            </T>
          ) : null}
          <Button
            label={step < 2 ? "Continue" : "See my daily target"}
            icon={step < 2 ? "arrow-right" : "target"}
            disabled={!canContinue}
            loading={calculate.isPending}
            onPress={() => (step < 2 ? setStep(step + 1) : calculate.mutate())}
          />
        </View>
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
        <View style={{ flex: 1 }}>
          <Bar value={step + 1} max={STEPS.length} height={6} />
        </View>
        <T variant="caption">
          {step + 1} of {STEPS.length}
        </T>
      </View>

      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="title">{STEPS[step]}</T>
          {step === 0 ? <T variant="label">So Kimbo can estimate how much energy your body uses.</T> : null}
        </View>
        <Kimbo mood={step === 2 ? "happy" : "idle"} size={56} />
      </View>

      {step === 0 ? (
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <T variant="label">Sex</T>
            <Segmented
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "other", label: "Prefer not to say" },
              ]}
              value={sex}
              onChange={setSex}
            />
          </View>
          <Field
            label="Age"
            unit="years"
            value={fields.age}
            error={fieldError("age")}
            onChange={(age) => setFields({ ...fields, age })}
          />
          <Field
            label="Height"
            unit="cm"
            value={fields.heightCm}
            error={fieldError("heightCm")}
            onChange={(heightCm) => setFields({ ...fields, heightCm })}
          />
          <Field
            label="Weight"
            unit="kg"
            value={fields.weightKg}
            error={fieldError("weightKg")}
            onChange={(weightKg) => setFields({ ...fields, weightKg })}
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: space.sm }}>
          {ACTIVITY.map((a) => (
            <Choice
              key={a.key}
              icon={a.icon}
              label={a.label}
              hint={a.hint}
              selected={activity === a.key}
              onPress={() => setActivity(a.key)}
            />
          ))}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.sm }}>
          {GOALS.map((g) => (
            <Choice
              key={g.key}
              icon={g.icon}
              label={g.label}
              hint={g.hint}
              selected={goalType === g.key}
              onPress={() => setGoalType(g.key)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function Field({
  label,
  unit,
  value,
  error,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.field, error && { borderColor: colors.plum }]}>
        <T variant="bodyStrong" style={{ flex: 1 }}>
          {label}
        </T>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ""))}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={colors.inkFaint}
          style={styles.fieldInput}
          accessibilityLabel={`${label} in ${unit}`}
          maxLength={5}
        />
        <T variant="label" style={{ width: 44 }}>
          {unit}
        </T>
      </View>
      {error ? (
        <T variant="caption" tone="plum">
          {error}
        </T>
      ) : null}
    </View>
  );
}

function Choice({
  icon,
  label,
  hint,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <View style={[styles.choiceIcon, selected && { backgroundColor: colors.leaf }]}>
        <Icon name={icon} size={18} color={selected ? colors.white : colors.leafDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{label}</T>
        <T variant="caption">{hint}</T>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Icon name="check" size={14} color={colors.white} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.lg,
  },
  fieldInput: {
    minWidth: 80,
    textAlign: "right",
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    paddingVertical: space.md,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choiceOn: { borderColor: colors.leaf, backgroundColor: colors.leafSoft },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  reveal: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  adjust: { flexDirection: "row", gap: space.sm },
  explain: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  explainNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
