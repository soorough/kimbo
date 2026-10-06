import type { ReportInsights } from "@kimbo/shared";
import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { Surface } from "./Surface";
import { T } from "./Text";

/** About six weeks: long enough for eating changes to show up in a lipid or HbA1c test. */
const RETEST_AFTER_DAYS = 42;
const BAR_H = 56;

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });

/**
 * Progress since the latest report. Meal counts describe what the user did; marker values
 * are only compared between two real reports, never inferred from meals.
 */
export function ReportInsightsCard({ insights: i }: { insights: ReportInsights }) {
  const first = i.weeks.find((w) => w.total > 0);
  const last = i.weeks.at(-1);
  const pctOf = (w: { supported: number; total: number }) => (w.total ? Math.round((w.supported / w.total) * 100) : 0);
  const markerName = i.marker?.label ?? i.compare?.label;

  return (
    <Surface accessibilityLabel={`Since your ${shortDate(i.reportDate)} report, ${i.supported} of ${i.total} meals helped.`}>
      <T variant="overline" tone="soft">
        SINCE YOUR {shortDate(i.reportDate).toUpperCase()} REPORT
      </T>
      {i.marker ? (
        <T variant="label">
          {i.marker.label} {i.marker.value} {i.marker.unit} ({i.marker.statusLabel.toLowerCase()}) → {i.focus.title.toLowerCase()}
        </T>
      ) : (
        <T variant="label">Focus: {i.focus.title.toLowerCase()}</T>
      )}

      {i.total ? (
        <>
          <View style={styles.headline}>
            <T variant="number" style={styles.big}>
              {i.supported}
              <T variant="label"> of {i.total} meals helped</T>
            </T>
            <T variant="bodyStrong" tone="leaf">
              {i.pct}%
            </T>
          </View>

          {i.weeks.length > 1 ? (
            <View style={{ gap: 4 }}>
              <View style={styles.bars}>
                {i.weeks.map((w, n) => (
                  <View key={w.weekStart} style={styles.barSlot}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, (pctOf(w) / 100) * BAR_H),
                          backgroundColor: n === i.weeks.length - 1 ? colors.leaf : "rgba(46,107,79,0.35)",
                        },
                        w.total === 0 && styles.barEmpty,
                      ]}
                    />
                  </View>
                ))}
              </View>
              {first && last ? (
                <T variant="caption">
                  Week of {shortDate(first.weekStart)}: {pctOf(first)}% → this week: {pctOf(last)}%
                </T>
              ) : null}
            </View>
          ) : null}

          {i.helpers.length ? (
            <View style={styles.helpers}>
              <Icon name="award" size={16} color={colors.turmericDeep} />
              <T variant="label" style={{ flex: 1 }}>
                Best helpers: {i.helpers.join(", ")}
              </T>
            </View>
          ) : null}

          {i.cutBackOn.length ? (
            <View style={styles.cut}>
              <T variant="caption" tone="soft">
                WORTH HAVING LESS OFTEN
                {i.cutBackFor.length ? ` FOR YOUR ${joinAnd(i.cutBackFor).toUpperCase()}` : ""}
              </T>
              {i.cutBackOn.map((c) => (
                <View key={c.name} style={styles.cutRow}>
                  <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </T>
                  <T variant="caption">
                    {c.times} {c.times === 1 ? "time" : "times"} · {c.reason}
                  </T>
                </View>
              ))}
              {i.helpers.length ? (
                <T variant="caption">Swap in {i.helpers[0]!.toLowerCase()} on some of those days.</T>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <T variant="body">Log your meals and Kimbo will show how many help your focus.</T>
      )}

      {i.compare ? (
        <Compare c={i.compare} />
      ) : markerName ? (
        <View style={styles.retest}>
          <Icon name="calendar" size={16} color={colors.inkSoft} />
          <T variant="caption" style={{ flex: 1 }}>
            {i.daysSinceReport >= RETEST_AFTER_DAYS
              ? `It's been ${Math.floor(i.daysSinceReport / 7)} weeks. A new test would show whether your ${markerName} has moved.`
              : `Retest in about ${Math.ceil((RETEST_AFTER_DAYS - i.daysSinceReport) / 7)} weeks to see whether your ${markerName} has moved.`}
          </T>
        </View>
      ) : null}
    </Surface>
  );
}

const joinAnd = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Two measured values side by side. Lower is better for every marker Kimbo reads. */
function Compare({ c }: { c: NonNullable<ReportInsights["compare"]> }) {
  const diff = Math.round((c.after.value - c.before.value) * 10) / 10;
  const better = diff < 0;
  return (
    <View style={[styles.compare, { backgroundColor: better ? colors.leafSoft : colors.plumSoft }]}>
      <T variant="caption" tone="soft">
        {c.label.toUpperCase()} BETWEEN REPORTS
      </T>
      <View style={styles.compareRow}>
        <View>
          <T variant="number" style={styles.compareNum}>
            {c.before.value}
          </T>
          <T variant="caption">{shortDate(c.before.reportDate)}</T>
        </View>
        <Icon name="arrow-right" size={20} color={colors.inkSoft} />
        <View>
          <T variant="number" style={styles.compareNum}>
            {c.after.value}
          </T>
          <T variant="caption">{shortDate(c.after.reportDate)}</T>
        </View>
        <T variant="bodyStrong" tone={better ? "leaf" : "plum"} style={{ marginLeft: "auto" }}>
          {diff === 0 ? "No change" : `${better ? "↓" : "↑"} ${Math.abs(diff)} ${c.unit}`}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.sm },
  big: { fontSize: 30, lineHeight: 36 },
  bars: { flexDirection: "row", alignItems: "flex-end", height: BAR_H, gap: 6 },
  barSlot: { flex: 1, justifyContent: "flex-end" },
  bar: { borderRadius: 4 },
  barEmpty: { backgroundColor: colors.sunk },
  helpers: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cut: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.plumSoft },
  cutRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  retest: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.sunk,
  },
  compare: { gap: space.sm, padding: space.md, borderRadius: radius.md },
  compareRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  compareNum: { fontSize: 26, lineHeight: 30 },
});
