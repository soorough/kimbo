import type { Nutrition, TodayResponse } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { PROTEIN_ICON } from "@/components/DayNumbers";
import { ErrorState, Icon, Ring, Screen, Surface, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { MEAL_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { colors, fonts, macroColors, space } from "@/lib/theme";

const STATUS_COLOR = { good: colors.leaf, ok: colors.turmeric, low: colors.plum } as const;
const PART_ICON = { fibre: "🥦", protein: "", satFat: "🧈", processed: "🍟" } as const;

/** Cal AI's daily breakdown: calories with macros, water, and the health score with what's behind it. */
export default function DailyBreakdown() {
  const profileId = useSession((s) => s.profileId);
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId!) });
  const protein = PROTEIN_ICON[profile.data?.profile.diet ?? "vegetarian"];

  if (today.error) {
    return (
      <Screen back title="Daily breakdown">
        <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />
      </Screen>
    );
  }
  const data = today.data;
  if (!data) return <Screen back title="Daily breakdown">{null}</Screen>;
  const t = data.targets;
  const n = data.totals;
  const h = data.healthScore;

  return (
    <Screen back title="Daily breakdown">
      <Surface style={{ gap: space.md }}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="label">Calories</T>
            <T style={styles.big}>
              {Math.round(n.calories).toLocaleString("en-IN")}
              {t ? <T style={styles.of}>{` / ${t.calories.toLocaleString("en-IN")}`}</T> : null}
            </T>
          </View>
          <Ring value={n.calories} max={t?.calories || 1} size={64} stroke={6}>
            <Icon name="zap" size={20} color={colors.leafDeep} />
          </Ring>
        </View>
        {(
          [
            ["Protein", protein, n.protein, t?.protein, macroColors.protein],
            ["Carbs", "🌾", n.carbs, t?.carbs, macroColors.carbs],
            ["Fat", "🥜", n.fat, t?.fat, macroColors.fat],
          ] as const
        ).map(([label, icon, v, target]) => (
          <View key={label} style={styles.row}>
            <T style={styles.icon}>{icon}</T>
            <T variant="body" style={{ flex: 1 }}>
              {label}
            </T>
            <T variant="bodyStrong">
              {Math.round(v)}
              <T variant="body" tone="soft">
                {target ? ` / ${target}g` : "g"}
              </T>
            </T>
          </View>
        ))}
        <Button label="Edit daily goals" kind="secondary" onPress={() => router.push("/edit-goal")} />
      </Surface>

      <Surface>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="label">Water</T>
            <T style={styles.big}>
              {data.water.ml.toLocaleString("en-IN")}
              <T style={styles.of}>{` / ${data.water.goalMl.toLocaleString("en-IN")} ml`}</T>
            </T>
          </View>
          <Ring value={data.water.ml} max={data.water.goalMl} size={64} stroke={6} color="#4A90C2" overColor="#4A90C2">
            <Icon name="droplet" size={20} color="#4A90C2" />
          </Ring>
        </View>
      </Surface>

      <Surface style={{ gap: space.md }}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="label">Health score</T>
            <T variant="heading">{h.status}</T>
          </View>
          <Ring
            value={h.score ?? 0}
            max={10}
            size={64}
            stroke={6}
            color={h.score === null ? colors.sunk : h.score >= 8 ? colors.leaf : h.score >= 5 ? colors.turmeric : colors.plum}
          >
            <T style={styles.ringText}>{h.score === null ? "–" : `${h.score}/10`}</T>
          </Ring>
        </View>
        <T variant="caption">{h.line}</T>
        {h.parts.map((p) => (
          <View key={p.key} style={styles.row} accessible accessibilityLabel={`${p.label}: ${p.value}, ${p.status}`}>
            <T style={styles.icon}>{p.key === "protein" ? protein : PART_ICON[p.key]}</T>
            <T variant="body" style={{ flex: 1 }}>
              {p.label}
            </T>
            <T variant="bodyStrong">{p.value}</T>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[p.status] }]} />
          </View>
        ))}
      </Surface>

      {data.meals.length ? <ByMeal data={data} /> : null}
    </Screen>
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
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  big: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  icon: { width: 24, fontSize: 18, lineHeight: 24, textAlign: "center" },
  of: { fontFamily: fonts.semibold, fontSize: 17, color: colors.inkSoft },
  ringText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  dot: { width: 9, height: 9, borderRadius: 5 },
  tableRow: { flexDirection: "row", alignItems: "center" },
  cellNum: { width: 44, textAlign: "right" },
});
