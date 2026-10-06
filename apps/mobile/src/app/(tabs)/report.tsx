import type { ExtractReportRequest, MarkerReading, Report } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { ErrorState, Icon, Loading, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { DISCLAIMER } from "@/lib/copy";
import { readAsBase64, toUploadableJpeg } from "@/lib/image";
import { useReportDraft } from "@/lib/report-draft";
import { colors, radius, space } from "@/lib/theme";

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

  async function pickFile() {
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
    setDraft({ markers: [], reportDate: null, ignored: [], supportedMarkers: [], disclaimer: DISCLAIMER }, "manual");
    router.push("/report-review");
  }

  if (extract.isPending) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Kimbo mood="thinking" size={120} />
          <T variant="title">Reading your report…</T>
          <T variant="label" align="center">
            You'll check every value before Kimbo uses it.
          </T>
        </View>
      </Screen>
    );
  }

  const latest = reports.data?.reports[0];
  const focus = today.data?.focus;

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: space.sm }}>
        <T variant="overline" tone="faint">
          BLOOD REPORT
        </T>
        <T variant="display">{latest ? "Your report" : "From report to plate"}</T>
      </View>

      {reports.isLoading ? <Loading /> : null}
      {reports.error ? <ErrorState message={errorMessage(reports.error)} onRetry={() => reports.refetch()} /> : null}

      {latest && focus ? (
        <Surface tint="leaf">
          <View style={styles.row}>
            <Kimbo mood="focus" size={60} leaves={2} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="overline">YOUR FOOD FOCUS</T>
              <T variant="heading">{focus.title}</T>
            </View>
          </View>
          <T variant="body">{focus.description}</T>
        </Surface>
      ) : null}

      {latest ? <ReportCard report={latest} /> : null}

      {!latest && !reports.isLoading ? (
        <Surface tint="sunk">
          <View style={styles.row}>
            <Kimbo mood="idle" size={64} />
            <T variant="body" style={{ flex: 1 }}>
              Kimbo reads <T variant="bodyStrong">LDL, HbA1c and triglycerides</T> and turns them into one simple focus for your
              meals.
            </T>
          </View>
          <View style={styles.steps}>
            {["Add your report", "Check the values", "Get one food focus"].map((s, i) => (
              <View key={s} style={styles.step}>
                <View style={styles.stepNum}>
                  <T variant="caption" tone="leaf">
                    {i + 1}
                  </T>
                </View>
                <T variant="label">{s}</T>
              </View>
            ))}
          </View>
        </Surface>
      ) : null}

      {extract.error ? (
        <Surface tint="plum">
          <T variant="bodyStrong">{errorMessage(extract.error)}</T>
          <T variant="caption">Try again, enter the values yourself, or use the sample report.</T>
        </Surface>
      ) : null}

      <View style={{ gap: space.sm }}>
        <T variant="heading">{latest ? "Add a newer report" : "Add your report"}</T>
        <View style={styles.options}>
          <Option icon="upload" title="Upload PDF or image" subtitle="From your files or lab app" primary onPress={pickFile} />
          <Option icon="camera" title="Photograph a printed report" subtitle="Lay it flat in good light" onPress={snapReport} />
          <Option
            icon="book-open"
            title="Try a sample report"
            subtitle="See how it works first"
            onPress={() => extract.mutate({ load: async () => ({ sample: true }), source: "sample" })}
          />
          <Option icon="edit-3" title="Type the values" subtitle="Just three numbers" onPress={enterManually} />
        </View>
      </View>

      <View style={styles.disclaimer}>
        <Icon name="info" size={16} color={colors.inkFaint} />
        <T variant="caption" style={{ flex: 1 }}>
          {DISCLAIMER}
        </T>
      </View>
    </Screen>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <Surface>
      <T variant="label">Report from {new Date(`${report.reportDate}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}</T>
      {report.markers.map((m) => (
        <MarkerRow key={m.marker} m={m} />
      ))}
    </Surface>
  );
}

function MarkerRow({ m }: { m: MarkerReading }) {
  const watch = m.status !== "in_range";
  return (
    <View style={styles.marker}>
      <T variant="bodyStrong" style={{ flex: 1 }}>
        {m.label}
      </T>
      <T variant="bodyStrong">
        {m.value} <T variant="caption">{m.unit}</T>
      </T>
      <View style={[styles.pill, watch ? styles.pillWatch : styles.pillOk]}>
        <T variant="caption" tone={watch ? "plum" : "leaf"}>
          {m.statusLabel}
        </T>
      </View>
    </View>
  );
}

function Option({
  icon,
  title,
  subtitle,
  primary,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}>
      <View style={[styles.optionIcon, primary && { backgroundColor: colors.leaf }]}>
        <Icon name={icon} size={20} color={primary ? colors.white : colors.leafDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="caption">{subtitle}</T>
      </View>
      <Icon name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  steps: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  step: { alignItems: "center", gap: 4, flex: 1 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" },
  options: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  optionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" },
  marker: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  pillOk: { backgroundColor: colors.leafSoft },
  pillWatch: { backgroundColor: colors.plumSoft },
  disclaimer: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
});
