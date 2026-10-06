import type { ConfirmReportResponse, MarkerKey } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Card, Chip, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAfterWrite } from "@/lib/mutations";
import { useReportDraft } from "@/lib/report-draft";
import { colors, font, radius, space } from "@/lib/theme";

/** Kept in sync with the API's supported markers; used when entering values manually. */
const MARKERS: { marker: MarkerKey; label: string; units: string[] }[] = [
  { marker: "ldl", label: "LDL cholesterol", units: ["mg/dL", "mmol/L"] },
  { marker: "hba1c", label: "HbA1c", units: ["%", "mmol/mol"] },
  { marker: "triglycerides", label: "Triglycerides", units: ["mg/dL", "mmol/L"] },
];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ReportReview() {
  const { draft, source } = useReportDraft();
  const afterWrite = useAfterWrite();
  const [reportDate, setReportDate] = useState(draft?.reportDate ?? todayIso());
  const [values, setValues] = useState<Record<MarkerKey, { value: string; unit: string }>>(() => {
    const init = {} as Record<MarkerKey, { value: string; unit: string }>;
    for (const m of MARKERS) {
      const found = draft?.markers.find((r) => r.marker === m.marker);
      init[m.marker] = found ? { value: String(found.value), unit: found.unit } : { value: "", unit: m.units[0]! };
    }
    return init;
  });
  const [result, setResult] = useState<ConfirmReportResponse | null>(null);

  const confirm = useMutation({
    mutationFn: () =>
      api.confirmReport({
        reportDate,
        source,
        markers: MARKERS.filter((m) => Number(values[m.marker].value) > 0).map((m) => ({
          marker: m.marker,
          value: Number(values[m.marker].value),
          unit: values[m.marker].unit,
        })),
      }),
    onSuccess: async (res) => {
      setResult(res);
      await afterWrite(res.events);
    },
  });

  if (result) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.md, marginTop: space.xl }}>
          <Kimbo mood="focus" size={120} />
          <Text style={styles.focusLabel}>YOUR DAILY FOOD FOCUS</Text>
          <Text style={[font.title, { textAlign: "center" }]}>{result.focus.title}</Text>
          <Text style={[font.body, { textAlign: "center" }]}>{result.focus.reason}</Text>
        </View>
        <Card>
          <Text style={font.body}>{result.focus.description}</Text>
          <Text style={font.small}>Kimbo will show how each meal connects to this focus on your Today screen.</Text>
        </Card>
        <Text style={styles.disclaimer}>{result.disclaimer}</Text>
        <Button label="See today" onPress={() => router.dismissTo("/(tabs)")} />
      </Screen>
    );
  }

  const anyValue = MARKERS.some((m) => Number(values[m.marker].value) > 0);
  const nothingFound = source === "upload" && draft && draft.markers.length === 0;

  return (
    <Screen>
      <View style={styles.row}>
        <Kimbo mood="thinking" size={52} />
        <Text style={[font.body, { flex: 1 }]}>
          {nothingFound
            ? "I couldn't find LDL, HbA1c or triglycerides in that file. Enter them below, or go back and try the sample."
            : "Check each value against your report. Kimbo only uses what you confirm."}
        </Text>
      </View>

      {MARKERS.map((m) => {
        const v = values[m.marker];
        const extracted = draft?.markers.find((r) => r.marker === m.marker);
        return (
          <Card key={m.marker}>
            <View style={styles.row}>
              <Text style={[font.h2, { flex: 1 }]}>{m.label}</Text>
              <TextInput
                value={v.value}
                onChangeText={(t) => setValues({ ...values, [m.marker]: { ...v, value: t.replace(/[^0-9.]/g, "") } })}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.chips}>
              {m.units.map((u) => (
                <Chip key={u} label={u} selected={v.unit === u} onPress={() => setValues({ ...values, [m.marker]: { ...v, unit: u } })} />
              ))}
            </View>
            {extracted && extracted.originalUnit !== extracted.unit ? (
              <Text style={font.small}>
                Report said {extracted.originalValue} {extracted.originalUnit}; converted to {extracted.unit}.
              </Text>
            ) : null}
            {!extracted && source !== "manual" ? <Text style={font.small}>Not found — leave blank or add it yourself.</Text> : null}
          </Card>
        );
      })}

      <Card>
        <View style={styles.row}>
          <Text style={[font.body, { flex: 1 }]}>Report date</Text>
          <TextInput value={reportDate} onChangeText={setReportDate} placeholder="YYYY-MM-DD" style={styles.input} />
        </View>
      </Card>

      {draft?.ignored.length ? (
        <Text style={font.small}>Also on your report (not used by Kimbo yet): {draft.ignored.join(", ")}.</Text>
      ) : null}

      {confirm.error ? <Text style={styles.error}>{errorMessage(confirm.error)}</Text> : null}
      <Button label="Confirm values" disabled={!anyValue} loading={confirm.isPending} onPress={() => confirm.mutate()} />
      <Text style={styles.disclaimer}>
        Kimbo is not a medical service. It doesn't diagnose conditions or give treatment advice.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  chips: { flexDirection: "row", gap: space.sm },
  input: {
    minWidth: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.sm,
    fontSize: 16,
    textAlign: "right",
    color: colors.text,
  },
  focusLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: colors.primary },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 },
  error: { color: colors.calm, textAlign: "center" },
});
