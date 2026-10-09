import { MARKER_THRESHOLDS, type MarkerReading } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { Kimbo } from "@/components/Kimbo";
import { CardSkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useReportIntake } from "@/lib/report-intake";
import { colors, radius, space } from "@/lib/theme";

export default function ReportTab() {
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports });
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const intake = useReportIntake();
  const [showAddOptions, setShowAddOptions] = useState(false);

  if (intake.reading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Kimbo mood="thinking" size={100} />
          <T variant="title">Finding the main takeaway…</T>
          <T variant="label" align="center">We’ll explain what stands out and what to focus on.</T>
        </View>
      </Screen>
    );
  }

  const latest = reports.data?.reports[0];
  const flagged = (latest?.markers ?? [])
    .filter((marker) => marker.status !== "in_range")
    .sort((a, b) => severity(b) - severity(a));
  const allMarkers = [...(latest?.markers ?? [])].sort((a, b) => severity(b) - severity(a));
  const focus = today.data?.focus;

  return (
    <Screen back>
      <View style={styles.pageTitle}>
        <T variant="display">Blood report</T>
        {latest ? (
          <T variant="caption">
            Latest · {new Date(`${latest.reportDate}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
          </T>
        ) : null}
      </View>

      {reports.isLoading ? <CardSkeleton h={120} /> : null}
      {reports.error ? <ErrorState message={errorMessage(reports.error)} onRetry={() => reports.refetch()} /> : null}

      {latest ? (
        <>
          <Surface tint="leaf">
            <View style={styles.takeawayHead}>
              <Kimbo mood={flagged.length ? "focus" : "happy"} size={48} leaves={2} />
              <View style={{ flex: 1, gap: 3 }}>
                <T variant="overline">THE MAIN TAKEAWAY</T>
                <T variant="heading">
                  {flagged.length ? focus?.title ?? "One result to review" : "Your tracked results are in range"}
                </T>
              </View>
            </View>
            {flagged[0] ? (
              <>
                <T variant="body">
                  {flagged[0].label} is {flagged[0].statusLabel.toLowerCase()} at {flagged[0].value} {flagged[0].unit}.
                </T>
                <View style={styles.nextStep}>
                  <T variant="label" tone="leaf">FOOD FOCUS</T>
                  <T variant="bodyStrong">{focus?.description ?? "Keep this result for your next conversation with your clinician."}</T>
                </View>
              </>
            ) : (
              <T variant="body">There’s nothing here asking for a food change. Keep this report to compare with your next one.</T>
            )}
          </Surface>

          {allMarkers.length ? (
            <View style={{ gap: space.sm }}>
              <T variant="heading">Your results at a glance</T>
              <T variant="caption">The dot shows your result against Kimbo’s general guide.</T>
              <Surface>
                <View style={styles.legend}>
                  <Legend color={colors.leaf} label="Guide" />
                  <Legend color={colors.turmeric} label="Worth watching" />
                  <Legend color={colors.plum} label="High" />
                </View>
                {allMarkers.map((marker, index) => (
                  <MarkerGraph key={marker.marker} marker={marker} last={index === allMarkers.length - 1} />
                ))}
                <T variant="caption" style={styles.rangeNote}>
                  These are general bands, not personal targets. Your clinician can set the right goal for you.
                </T>
              </Surface>
            </View>
          ) : null}
        </>
      ) : null}

      {!latest && !reports.isLoading ? (
        <Surface tint="sunk">
          <View style={styles.takeawayHead}>
            <Kimbo mood="happy" size={48} />
            <T variant="body" style={{ flex: 1 }}>
              I’ll find the one result to focus on and turn it into clear food guidance.
            </T>
          </View>
        </Surface>
      ) : null}

      {intake.error ? (
        <Surface tint="plum">
          <T variant="bodyStrong">{errorMessage(intake.error)}</T>
          <T variant="caption">Try another file or enter the values yourself.</T>
        </Surface>
      ) : null}

      <Button
        label={showAddOptions ? "Hide report options" : latest ? "Add or update report" : "Add a report"}
        kind={latest ? "secondary" : "primary"}
        onPress={() => setShowAddOptions((shown) => !shown)}
      />
      {showAddOptions ? (
        <View style={styles.options}>
          <Option icon="upload" title="Upload a PDF or image" subtitle="Choose a report from your files" onPress={intake.pickFile} />
          <Option icon="camera" title="Take a photo" subtitle="Photograph the printed report" onPress={intake.snapReport} />
          <Option icon="edit-3" title="Enter values" subtitle="Type LDL, HbA1c or triglycerides" onPress={intake.enterManually} last />
        </View>
      ) : null}

    </Screen>
  );
}

function severity(marker: MarkerReading) {
  return marker.status === "high" ? 2 : marker.status === "worth_watching" ? 1 : 0;
}

const GRAPH_MAX: Record<MarkerReading["marker"], number> = { ldl: 240, hba1c: 8.5, triglycerides: 300 };

function MarkerGraph({ marker, last }: { marker: MarkerReading; last: boolean }) {
  const bands = MARKER_THRESHOLDS[marker.marker];
  const max = GRAPH_MAX[marker.marker];
  const guideWidth = (bands.worthWatching / max) * 100;
  const watchWidth = ((bands.high - bands.worthWatching) / max) * 100;
  const valuePosition = Math.max(1, Math.min(99, (marker.value / max) * 100));
  const tone = marker.status === "in_range" ? "leaf" : marker.status === "high" ? "plum" : "turmeric";
  const unit = marker.unit;
  const guideText = marker.marker === "hba1c" ? `<${bands.worthWatching}%` : `<${bands.worthWatching} ${unit}`;
  return (
    <View style={[styles.graph, !last && styles.graphDivider]}>
      <View style={styles.graphHeader}>
        <T variant="bodyStrong" style={{ flex: 1 }}>{marker.label}</T>
        <View style={[styles.pill, tone === "leaf" ? styles.pillOk : tone === "turmeric" ? styles.pillWatch : styles.pillHigh]}>
          <T variant="caption" tone={tone}>{marker.statusLabel}</T>
        </View>
      </View>
      <View style={styles.valueRow}>
        <T variant="number" style={styles.value}>{marker.value}</T>
        <T variant="label">{unit}</T>
      </View>
      <View accessible accessibilityLabel={`${marker.label} ${marker.value} ${unit}; ${marker.statusLabel}`} style={styles.chart}>
        <View style={styles.track}>
          <View style={[styles.band, { width: `${guideWidth}%`, backgroundColor: colors.leaf }]} />
          <View style={[styles.band, { width: `${watchWidth}%`, backgroundColor: colors.turmeric }]} />
          <View style={[styles.band, { flex: 1, backgroundColor: colors.plum }]} />
        </View>
        <View style={[styles.valuePin, { left: `${valuePosition}%` }]} />
      </View>
      <View style={styles.axis}>
        <T variant="caption">0</T>
        <T variant="caption">≥{max} {unit}</T>
      </View>
      <T variant="caption" tone="leaf">General guide: {guideText}</T>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <T variant="caption">{label}</T>
    </View>
  );
}

function Option({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.option, !last && styles.optionBorder, pressed && { opacity: 0.85 }]}
    >
      <Icon name={icon} size={20} color={colors.leafDeep} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="caption">{subtitle}</T>
      </View>
      <Icon name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
  pageTitle: { gap: 2, marginTop: space.sm },
  takeawayHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  nextStep: { gap: 4, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md, paddingBottom: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  graph: { gap: space.xs, paddingVertical: space.md },
  graphDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  graphHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  value: { fontSize: 26, lineHeight: 30 },
  chart: { height: 18, justifyContent: "center", overflow: "visible", marginTop: space.xs },
  track: { height: 10, flexDirection: "row", borderRadius: 5, overflow: "hidden" },
  band: { height: 10 },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  valuePin: {
    position: "absolute",
    top: 2,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
  },
  rangeNote: { marginTop: space.md },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4 },
  pillOk: { backgroundColor: colors.leafSoft },
  pillWatch: { backgroundColor: colors.turmericSoft },
  pillHigh: { backgroundColor: colors.plumSoft },
  options: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  optionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
