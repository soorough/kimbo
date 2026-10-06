import type { MarkerReading, Report } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { CardSkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { DISCLAIMER } from "@/lib/copy";
import { useReportIntake } from "@/lib/report-intake";
import { colors, radius, space } from "@/lib/theme";

export default function ReportTab() {
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports });
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const intake = useReportIntake();

  if (intake.reading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Kimbo mood="thinking" size={120} />
          <T variant="title">Reading your report…</T>
          <T variant="label" align="center">
            You'll check each number next.
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
        <T variant="display">Blood report</T>
      </View>

      {reports.isLoading ? <CardSkeleton h={160} /> : null}
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
              Kimbo reads <T variant="bodyStrong">LDL, HbA1c and triglycerides</T> and turns them into one simple focus
              for your meals.
            </T>
          </View>
          <View style={styles.steps}>
            {["Add report", "Check values", "Get a focus"].map((s, i) => (
              <View key={s} style={styles.step}>
                <View style={styles.stepNum}>
                  <T variant="caption" tone="leaf">
                    {i + 1}
                  </T>
                </View>
                <T variant="label" align="center">
                  {s}
                </T>
              </View>
            ))}
          </View>
        </Surface>
      ) : null}

      {intake.error ? (
        <Surface tint="plum">
          <T variant="bodyStrong">{errorMessage(intake.error)}</T>
          <T variant="caption">Type the values instead, or try the sample.</T>
        </Surface>
      ) : null}

      <View style={{ gap: space.sm }}>
        <T variant="heading">{latest ? "Add a newer report" : "Add your report"}</T>
        <View style={styles.options}>
          <Option
            icon="upload"
            title="Upload PDF or image"
            subtitle="From your files or lab app"
            primary
            onPress={intake.pickFile}
          />
          <Option
            icon="camera"
            title="Photograph a printed report"
            subtitle="Lay it flat in good light"
            onPress={intake.snapReport}
          />
          <Option
            icon="book-open"
            title="Try a sample report"
            subtitle="LDL 142 · HbA1c 5.6 · TG 160"
            onPress={intake.trySample}
          />
          <Option
            icon="edit-3"
            title="Type the values"
            subtitle="LDL, HbA1c, triglycerides"
            onPress={intake.enterManually}
          />
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
      <T variant="label">
        Report from{" "}
        {new Date(`${report.reportDate}T12:00:00`).toLocaleDateString([], {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </T>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
    >
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
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  options: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  marker: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  pillOk: { backgroundColor: colors.leafSoft },
  pillWatch: { backgroundColor: colors.plumSoft },
  disclaimer: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
});
