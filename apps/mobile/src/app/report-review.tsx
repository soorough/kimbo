import type { ConfirmReportResponse, MarkerKey } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Icon, Screen, Segmented, Surface, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { DISCLAIMER } from "@/lib/copy";
import { useAfterWrite } from "@/lib/mutations";
import { useReportDraft } from "@/lib/report-draft";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Kept in sync with the API's supported markers; used when entering values manually. */
const MARKERS: { marker: MarkerKey; label: string; hint: string; units: string[] }[] = [
  { marker: "ldl", label: "LDL cholesterol", hint: "Often under Lipid profile", units: ["mg/dL", "mmol/L"] },
  { marker: "hba1c", label: "HbA1c", hint: "Glycated haemoglobin", units: ["%", "mmol/mol"] },
  { marker: "triglycerides", label: "Triglycerides", hint: "Often under Lipid profile", units: ["mg/dL", "mmol/L"] },
];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Every extracted value is shown for confirmation; nothing reaches the focus rules unchecked. */
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
  const dateValid =
    /^\d{4}-\d{2}-\d{2}$/.test(reportDate) && !Number.isNaN(Date.parse(reportDate)) && reportDate <= todayIso();

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
      <Screen footer={<Button label="Go to today" onPress={() => router.dismissTo("/(tabs)")} />}>
        <View style={styles.reveal}>
          <View style={styles.revealGlow} />
          <Kimbo mood="focus" size={130} leaves={3} />
          <T variant="overline">YOUR DAILY FOOD FOCUS</T>
          <T variant="display" align="center">
            {result.focus.title}
          </T>
          <T variant="body" tone="soft" align="center">
            {result.focus.reason}
          </T>
        </View>
        <Surface tint="leaf">
          <T variant="body">{result.focus.description}</T>
          <T variant="caption" tone="leaf">
            Each meal you log will show if it helped.
          </T>
        </Surface>
        <View style={styles.disclaimer}>
          <Icon name="info" size={16} color={colors.inkFaint} />
          <T variant="caption" style={{ flex: 1 }}>
            {result.disclaimer}
          </T>
        </View>
      </Screen>
    );
  }

  const anyValue = MARKERS.some((m) => Number(values[m.marker].value) > 0);
  const nothingFound = source === "upload" && draft && draft.markers.length === 0;

  return (
    <Screen
      back
      title="Check the values"
      footer={
        <View style={{ gap: space.sm }}>
          {confirm.error ? (
            <T variant="label" tone="plum" align="center">
              {errorMessage(confirm.error)}
            </T>
          ) : null}
          <Button
            label="Use these values"
            disabled={!anyValue || !dateValid}
            loading={confirm.isPending}
            onPress={() => confirm.mutate()}
          />
        </View>
      }
    >
      <View style={styles.note}>
        <Kimbo mood={nothingFound ? "thinking" : "idle"} size={48} />
        <T variant="label" style={{ flex: 1 }}>
          {nothingFound
            ? "No LDL, HbA1c or triglycerides found in that file. Type them below."
            : source === "manual"
              ? "One value is enough."
              : "Check each number against your report."}
        </T>
      </View>

      {MARKERS.map((m) => {
        const v = values[m.marker];
        const extracted = draft?.markers.find((r) => r.marker === m.marker);
        return (
          <Surface key={m.marker}>
            <View style={styles.markerTop}>
              <View style={{ flex: 1 }}>
                <T variant="heading">{m.label}</T>
                <T variant="caption">{m.hint}</T>
              </View>
              <TextInput
                value={v.value}
                onChangeText={(t) => setValues({ ...values, [m.marker]: { ...v, value: t.replace(/[^0-9.]/g, "") } })}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
                accessibilityLabel={`${m.label} value`}
                maxLength={6}
              />
            </View>
            <Segmented
              options={m.units.map((u) => ({ value: u, label: u }))}
              value={v.unit}
              onChange={(unit) => setValues({ ...values, [m.marker]: { ...v, unit } })}
            />
            {extracted && extracted.originalUnit !== extracted.unit ? (
              <T variant="caption">
                Report says {extracted.originalValue} {extracted.originalUnit}. Converted.
              </T>
            ) : null}
            {!extracted && source === "upload" ? <T variant="caption">Not found. Leave blank or type it.</T> : null}
          </Surface>
        );
      })}

      <Surface>
        <View style={styles.markerTop}>
          <View style={{ flex: 1 }}>
            <T variant="heading">Report date</T>
            <T variant="caption">{dateValid ? "When the blood was drawn" : "Use YYYY-MM-DD, not a future date"}</T>
          </View>
          <TextInput
            value={reportDate}
            onChangeText={setReportDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.inkFaint}
            style={[styles.input, { minWidth: 130 }, !dateValid && { borderColor: colors.plum }]}
            accessibilityLabel="Report date"
            maxLength={10}
          />
        </View>
      </Surface>

      {draft?.ignored.length ? <T variant="caption">Not used yet: {draft.ignored.join(", ")}.</T> : null}
      <View style={styles.disclaimer}>
        <Icon name="info" size={16} color={colors.inkFaint} />
        <T variant="caption" style={{ flex: 1 }}>
          {DISCLAIMER}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "center", gap: space.md },
  markerTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  input: {
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: "right",
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  reveal: { alignItems: "center", gap: space.sm, paddingTop: space.xxl, paddingBottom: space.lg },
  revealGlow: {
    position: "absolute",
    top: space.xxl,
    width: 170,
    height: 150,
    borderRadius: 85,
    backgroundColor: colors.leafSoft,
  },
  disclaimer: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
});
