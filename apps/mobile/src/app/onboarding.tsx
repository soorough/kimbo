import type { Goal, GoalRequest } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Card, Chip, Screen, Stepper } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, font, radius, space } from "@/lib/theme";

const ACTIVITY: { key: GoalRequest["activity"]; label: string; hint: string }[] = [
  { key: "sedentary", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { key: "light", label: "Lightly active", hint: "Walks or exercise 1–3 days a week" },
  { key: "moderate", label: "Moderately active", hint: "Exercise 3–5 days a week" },
  { key: "active", label: "Very active", hint: "Hard exercise 6–7 days a week" },
  { key: "very_active", label: "Extremely active", hint: "Physical job or twice-daily training" },
];
const GOALS: { key: GoalRequest["goal"]; label: string }[] = [
  { key: "lose", label: "Lose weight" },
  { key: "maintain", label: "Maintain" },
  { key: "gain", label: "Gain weight" },
];

export default function Onboarding() {
  const profileId = useSession((s) => s.profileId)!;
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId) });

  const [age, setAge] = useState("");
  const [sex, setSex] = useState<GoalRequest["sex"] | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<GoalRequest["activity"] | null>(null);
  const [goalType, setGoalType] = useState<GoalRequest["goal"] | null>(null);
  const [result, setResult] = useState<Goal | null>(null);
  const [target, setTarget] = useState(0);

  // Editing later: start from what's saved.
  const saved = existing.data?.profile.goal;
  useEffect(() => {
    if (!saved) return;
    setAge(String(saved.age));
    setSex(saved.sex);
    setHeight(String(saved.heightCm));
    setWeight(String(saved.weightKg));
    setActivity(saved.activity);
    setGoalType(saved.goal);
  }, [saved]);

  const body = (): GoalRequest | null =>
    sex && activity && goalType && age && height && weight
      ? { age: Number(age), sex, heightCm: Number(height), weightKg: Number(weight), activity, goal: goalType }
      : null;

  const calculate = useMutation({
    mutationFn: (req: GoalRequest) => api.saveGoal(profileId, req),
    onSuccess: ({ profile }) => {
      setResult(profile.goal);
      setTarget(profile.goal!.effectiveTarget);
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const req = body()!;
      if (target !== result!.computedTarget) await api.saveGoal(profileId, { ...req, targetOverride: target });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
  });

  const req = body();

  return (
    <Screen>
      {!result ? (
        <>
          <View style={styles.intro}>
            <Kimbo mood="idle" size={64} />
            <Text style={[font.body, { flex: 1 }]}>A few quick details so I can estimate how much energy your body needs.</Text>
          </View>

          <Card>
            <Row label="Age">
              <NumberInput value={age} onChange={setAge} suffix="years" />
            </Row>
            <Text style={styles.label}>Sex</Text>
            <View style={styles.chips}>
              {(["female", "male", "other"] as const).map((s) => (
                <Chip key={s} label={s === "other" ? "Prefer not to say" : s[0]!.toUpperCase() + s.slice(1)} selected={sex === s} onPress={() => setSex(s)} />
              ))}
            </View>
            <Row label="Height">
              <NumberInput value={height} onChange={setHeight} suffix="cm" />
            </Row>
            <Row label="Weight">
              <NumberInput value={weight} onChange={setWeight} suffix="kg" />
            </Row>
          </Card>

          <Card>
            <Text style={font.h2}>How active are you?</Text>
            {ACTIVITY.map((a) => (
              <Option key={a.key} label={a.label} hint={a.hint} selected={activity === a.key} onPress={() => setActivity(a.key)} />
            ))}
          </Card>

          <Card>
            <Text style={font.h2}>What's your goal?</Text>
            <View style={styles.chips}>
              {GOALS.map((g) => (
                <Chip key={g.key} label={g.label} selected={goalType === g.key} onPress={() => setGoalType(g.key)} />
              ))}
            </View>
          </Card>

          {calculate.error ? <Text style={styles.error}>{errorMessage(calculate.error)}</Text> : null}
          <Button label="See my daily target" disabled={!req} loading={calculate.isPending} onPress={() => req && calculate.mutate(req)} />
        </>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: space.sm }}>
            <Kimbo mood="happy" size={90} />
            <Text style={font.small}>Your estimated daily target</Text>
            <Text style={styles.target}>{target} kcal</Text>
            <Stepper value={target} step={50} min={1200} onChange={(v) => setTarget(Math.min(4000, v))} />
            <Text style={font.small}>Adjust if you or your doctor prefer a different number.</Text>
          </View>
          <Card>
            <Text style={font.h2}>How Kimbo got here</Text>
            {result.explanation.map((line) => (
              <Text key={line} style={[font.body, { lineHeight: 21 }]}>• {line}</Text>
            ))}
          </Card>
          {confirm.error ? <Text style={styles.error}>{errorMessage(confirm.error)}</Text> : null}
          <Button label="Looks good" loading={confirm.isPending} onPress={() => confirm.mutate()} />
          <Button label="Change my details" kind="ghost" onPress={() => setResult(null)} />
        </>
      )}
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function NumberInput({ value, onChange, suffix }: { value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ""))}
        keyboardType="numeric"
        style={styles.input}
        placeholder="—"
        placeholderTextColor={colors.muted}
      />
      <Text style={font.small}>{suffix}</Text>
    </View>
  );
}

function Option({ label, hint, selected, onPress }: { label: string; hint: string; selected: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
    >
      <Text style={{ fontWeight: "700", color: colors.text }}>{label}</Text>
      {"\n"}
      <Text style={font.small}>{hint}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: "row", alignItems: "center", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.xs },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    textAlign: "right",
    color: colors.text,
  },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, lineHeight: 20 },
  target: { fontSize: 40, fontWeight: "800", color: colors.primary },
  error: { color: colors.calm, textAlign: "center" },
});
