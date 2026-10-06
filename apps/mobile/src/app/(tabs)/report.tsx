import type { ExtractReportRequest, Report } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Card, ErrorState, Loading, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { readAsBase64, toUploadableJpeg } from "@/lib/image";
import { useReportDraft } from "@/lib/report-draft";
import { colors, font, radius, space } from "@/lib/theme";

export default function ReportTab() {
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports });
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const setDraft = useReportDraft((s) => s.set);

  const extract = useMutation({
    mutationFn: async ({ load }: { load: () => Promise<ExtractReportRequest>; source: "upload" | "sample" }) =>
      api.extractReport(await load()),
    onSuccess: (draft, { source }) => {
      setDraft(draft, source);
      router.push("/report-review");
    },
  });

  async function pickPdf() {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? "application/pdf";
    extract.mutate({
      source: "upload",
      load: async () => {
        if (mimeType.startsWith("image/")) {
          const image = await toUploadableJpeg(asset.uri);
          return { fileBase64: image.base64, mimeType: image.mimeType };
        }
        return { fileBase64: await readAsBase64(asset.uri), mimeType };
      },
    });
  }

  async function snapReport() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    extract.mutate({
      source: "upload",
      load: async () => {
        const image = await toUploadableJpeg(asset.uri);
        return { fileBase64: image.base64, mimeType: image.mimeType };
      },
    });
  }

  function enterManually() {
    setDraft({ markers: [], reportDate: null, ignored: [], supportedMarkers: [], disclaimer: "" }, "manual");
    router.push("/report-review");
  }

  if (extract.isPending) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Kimbo mood="thinking" size={120} />
          <Text style={font.h2}>Reading your report…</Text>
          <Text style={font.small}>You'll check every value before Kimbo uses it.</Text>
        </View>
      </Screen>
    );
  }

  const latest = reports.data?.reports[0];

  return (
    <Screen>
      <Text style={font.title}>Health report</Text>
      {reports.isLoading ? <Loading /> : null}
      {reports.error ? <ErrorState message={errorMessage(reports.error)} onRetry={() => reports.refetch()} /> : null}

      {latest && today.data?.focus ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <View style={styles.row}>
            <Kimbo mood="focus" size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.focusLabel}>YOUR FOOD FOCUS</Text>
              <Text style={font.h2}>{today.data.focus.title}</Text>
              <Text style={font.body}>{today.data.focus.description}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {latest ? <ReportCard report={latest} /> : null}

      {!latest && !reports.isLoading ? (
        <Card>
          <View style={styles.row}>
            <Kimbo mood="idle" size={64} />
            <Text style={[font.body, { flex: 1 }]}>
              Kimbo reads LDL, HbA1c and triglycerides from your blood report and turns them into one simple food focus.
            </Text>
          </View>
        </Card>
      ) : null}

      {extract.error ? (
        <Card>
          <Text style={font.body}>{errorMessage(extract.error)}</Text>
          <Text style={font.small}>You can try again, enter the values yourself, or use the sample report.</Text>
        </Card>
      ) : null}

      <Text style={font.h2}>{latest ? "Add a newer report" : "Add your report"}</Text>
      <Button label="Upload PDF or image" icon="📄" onPress={pickPdf} />
      <Button label="Photograph a printed report" icon="📷" kind="secondary" onPress={snapReport} />
      <Button label="Use a sample report" kind="secondary" onPress={() => extract.mutate({ load: async () => ({ sample: true }), source: "sample" })} />
      <Button label="Enter values myself" kind="ghost" onPress={enterManually} />

      <Text style={styles.disclaimer}>
        Kimbo is not a medical service. It doesn't diagnose conditions or give treatment advice — please discuss your
        results with a doctor.
      </Text>
    </Screen>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <Card>
      <Text style={font.small}>Report from {new Date(`${report.reportDate}T12:00:00`).toDateString()}</Text>
      {report.markers.map((m) => (
        <View key={m.marker} style={styles.markerRow}>
          <Text style={[font.body, { flex: 1 }]}>{m.label}</Text>
          <Text style={[font.body, { fontWeight: "700" }]}>
            {m.value} {m.unit}
          </Text>
          <Text style={[styles.status, m.status !== "in_range" && styles.statusWatch]}>{m.statusLabel}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  focusLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: colors.primary },
  markerRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  status: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  statusWatch: { color: colors.calm, backgroundColor: colors.calmSoft },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 },
});
