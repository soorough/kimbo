import type { Nutrition } from "@kimbo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button, Screen, T } from "@/components/ui";
import { useMyFoods } from "@/lib/my-foods";
import { colors, fonts, radius, space } from "@/lib/theme";

type Field = { key: string; label: string; hint?: string; required?: boolean; numeric?: boolean };

const ABOUT: Field[] = [
  { key: "brand", label: "Brand name", hint: "ex. Haldiram's" },
  { key: "name", label: "Description", hint: "ex. Poha", required: true },
  { key: "servingSize", label: "Serving size", hint: "ex. 1 cup", required: true },
  { key: "servings", label: "Servings per container", hint: "ex. 1", required: true, numeric: true },
];

const LABEL: (Field & { key: keyof Nutrition })[] = [
  { key: "calories", label: "Calories", hint: "kcal", required: true, numeric: true },
  { key: "protein", label: "Protein", hint: "(g)", numeric: true },
  { key: "carbs", label: "Carbs", hint: "(g)", numeric: true },
  { key: "fat", label: "Total fat", hint: "(g)", numeric: true },
  { key: "satFat", label: "Saturated fat", hint: "(g)", numeric: true },
  { key: "fibre", label: "Fibre", hint: "(g)", numeric: true },
];

const num = (v: string | undefined) => {
  const n = Number((v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/** Cal AI's Add Food: what it is, then what the label says per serving. */
export default function AddFood() {
  const add = useMyFoods((s) => s.add);
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = step === 1 ? ABOUT : LABEL;
  const ready = fields.every((f) => {
    const v = values[f.key]?.trim();
    if (!v) return !f.required;
    if (!f.numeric) return true;
    return f.key === "servings" ? num(v) > 0 : !Number.isNaN(num(v));
  });

  async function save() {
    const perServing = Object.fromEntries(
      LABEL.map((f) => [f.key, values[f.key]?.trim() ? num(values[f.key]) : 0]),
    ) as unknown as Nutrition;
    await add({
      brand: values.brand?.trim() || null,
      name: values.name!.trim(),
      servingSize: values.servingSize!.trim(),
      servingsPerContainer: num(values.servings),
      perServing,
    });
    router.back();
  }

  return (
    <Screen
      back
      title="Add Food"
      bottomClearance={false}
      footer={
        <Button
          kind="ink"
          label={step === 1 ? "Next" : "Save food"}
          disabled={!ready}
          onPress={() => (step === 1 ? setStep(2) : save())}
        />
      }
    >
      <View style={{ gap: space.md }}>
        {fields.map((f, i) => (
          <View key={f.key} style={styles.field}>
            <T variant="label" tone="soft">{f.label}{f.required ? "*" : ""}</T>
            <TextInput
              autoFocus={step === 2 && i === 0}
              value={values[f.key] ?? ""}
              onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              placeholder={f.hint}
              placeholderTextColor={colors.inkFaint}
              keyboardType={f.numeric ? "decimal-pad" : "default"}
              style={styles.input}
              accessibilityLabel={f.label}
            />
          </View>
        ))}
        {step === 2 ? <T variant="caption" tone="soft">Values are for one serving ({values.servingSize}).</T> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, textAlign: "right", fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: space.md },
});
