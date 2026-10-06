import type { MacroTargets, Nutrition, TodayResponse } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { ErrorState, Icon, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { MEAL_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { colors, macroColors, radius, space } from "@/lib/theme";

type Key = keyof MacroTargets;

/** "limit" rows warn when crossed; "aim" rows are goals to reach, so going past is fine. */
const ROWS: { key: Key; label: string; unit: string; kind: "limit" | "aim"; color: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal", kind: "limit", color: colors.leaf },
  { key: "protein", label: "Protein", unit: "g", kind: "aim", color: macroColors.protein },
  { key: "carbs", label: "Carbs", unit: "g", kind: "limit", color: macroColors.carbs },
  { key: "fat", label: "Fat", unit: "g", kind: "limit", color: macroColors.fat },
  { key: "satFat", label: "Saturated fat", unit: "g", kind: "limit", color: "#8E4A6B" },
  { key: "fibre", label: "Fibre", unit: "g", kind: "aim", color: macroColors.fibre },
];

/** Today's nutrients against targets, with plain warnings when a limit is crossed. */
export default function NutritionDetail() {
  const profileId = useSession((s) => s.profileId);
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId!) });
  const cutting = profile.data?.profile.goal?.goal === "lose";

  if (today.error) {
    return (
      <Screen back title="Today's nutrition">
        <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />
      </Screen>
    );
  }
  const data = today.data;
  const t = data?.targets;

  return (
    <Screen back title="Today's nutrition">
      {data && t ? (
        <>
          <Warnings data={data} targets={t} cutting={cutting} />
          <Surface style={{ gap: space.lg }}>
            {ROWS.map((r) => (
              <Row key={r.key} row={r} value={data.totals[r.key]} target={t[r.key]} />
            ))}
          </Surface>
          {data.meals.length ? <ByMeal data={data} /> : null}
        </>
      ) : data ? (
        <T variant="body">Set a goal to see targets here.</T>
      ) : null}
    </Screen>
  );
}

function Row({ row, value, target }: { row: (typeof ROWS)[number]; value: number; target: number }) {
  const v = Math.round(value);
  const over = row.kind === "limit" && v > target;
  const reached = row.kind === "aim" && v >= target;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const status = over
    ? `${v - target} ${row.unit} over`
    : reached
      ? "Reached"
      : `${target - v} ${row.unit} ${row.kind === "limit" ? "left" : "to go"}`;

  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${row.label}: ${v} of ${target} ${row.unit}. ${status}.`}>
      <View style={styles.between}>
        <T variant="bodyStrong">{row.label}</T>
        <T variant="label">
          {v} / {target} {row.unit}
          {row.kind === "limit" ? " max" : ""}
        </T>
      </View>
      {over ? (
        // Rescaled to the whole amount: solid up to the limit, a tick, then the excess outlined.
        <View style={[styles.track, styles.overTrack]}>
          <View style={[styles.fill, { flex: target, backgroundColor: row.color, borderRadius: 0 }]} />
          <View style={styles.limitTick} />
          <View style={[styles.excess, { flex: v - target }]} />
        </View>
      ) : (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: row.color }]} />
        </View>
      )}
      <T variant="caption" tone={over ? "plum" : reached ? "leaf" : "soft"}>
        {over ? "▲ " : reached ? "✓ " : ""}
        {status}
      </T>
    </View>
  );
}

/** Heads-ups when a limit is crossed, naming the dish that did most of it. */
function Warnings({ data, targets, cutting }: { data: TodayResponse; targets: MacroTargets; cutting: boolean }) {
  const items = data.meals.flatMap((m) => m.items);
  const top = (k: keyof Nutrition) =>
    items.length ? items.reduce((a, b) => (b.nutrition[k] > a.nutrition[k] ? b : a)).name : null;
  const notes: { icon: IconName; title: string; body: string; good?: boolean }[] = [];
  const v = (k: Key) => Math.round(data.totals[k]);

  if (v("satFat") > targets.satFat) {
    notes.push({
      icon: "alert-triangle",
      title: "Saturated fat is over your limit",
      body:
        `${v("satFat")} g of ${targets.satFat} g. ` +
        (cutting ? "On a cut it's also an easy place to save calories. " : "") +
        `Too much raises LDL cholesterol. Most came from ${top("satFat")}.`,
    });
  }
  if (v("calories") > targets.calories) {
    notes.push({
      icon: "alert-circle",
      title: `${v("calories") - targets.calories} kcal over today's target`,
      body: `${cutting ? "One day won't undo a cut; " : ""}${top("calories")} was the biggest share.`,
    });
  }
  if (v("fat") > targets.fat) {
    notes.push({ icon: "alert-circle", title: `Fat is ${v("fat") - targets.fat} g over`, body: `Mostly from ${top("fat")}.` });
  }
  if (v("carbs") > targets.carbs) {
    notes.push({
      icon: "alert-circle",
      title: `Carbs are ${v("carbs") - targets.carbs} g over`,
      body: `Mostly from ${top("carbs")}.`,
    });
  }
  if (v("protein") >= targets.protein) {
    notes.push({ icon: "check-circle", title: "Protein goal reached", body: "Nice — that helps keep you full.", good: true });
  }
  if (!notes.length) return null;

  return (
    <View style={{ gap: space.sm }}>
      {notes.map((n) => (
        <View key={n.title} style={[styles.note, n.good ? styles.noteGood : styles.noteWarn]}>
          <Icon name={n.icon} size={18} color={n.good ? colors.leaf : colors.plum} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyStrong">{n.title}</T>
            <T variant="caption">{n.body}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

function ByMeal({ data }: { data: TodayResponse }) {
  const cols: { key: keyof Nutrition; label: string }[] = [
    { key: "calories", label: "kcal" },
    { key: "protein", label: "P" },
    { key: "carbs", label: "C" },
    { key: "fat", label: "F" },
    { key: "satFat", label: "Sat" },
  ];
  return (
    <Surface style={{ gap: space.sm }}>
      <T variant="overline" tone="soft">
        BY MEAL
      </T>
      <View style={styles.tableRow}>
        <View style={{ flex: 1 }} />
        {cols.map((c) => (
          <T key={c.key} variant="caption" tone="soft" style={styles.cellNum}>
            {c.label}
          </T>
        ))}
      </View>
      {data.meals.map((m) => (
        <View key={m.id} style={styles.tableRow}>
          <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {MEAL_LABEL[m.mealType]}
          </T>
          {cols.map((c) => (
            <T key={c.key} variant="label" style={styles.cellNum}>
              {Math.round(m.totals[c.key])}
            </T>
          ))}
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.sunk, overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill },
  overTrack: { flexDirection: "row", alignItems: "center" },
  limitTick: { width: 3, height: 10, backgroundColor: colors.ink },
  excess: {
    height: 10,
    backgroundColor: colors.plumSoft,
    borderWidth: 1.5,
    borderColor: colors.plum,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  note: { flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.md, alignItems: "flex-start" },
  noteWarn: { backgroundColor: colors.plumSoft },
  noteGood: { backgroundColor: colors.leafSoft },
  tableRow: { flexDirection: "row", alignItems: "center" },
  cellNum: { width: 44, textAlign: "right" },
});
