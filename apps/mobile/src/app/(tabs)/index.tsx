import type { MealType, TodayMeal, TodayResponse } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { useMoments } from "@/components/Moments";
import { Button, Card, Chip, ErrorState, Loading, ProgressBar, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useAfterWrite } from "@/lib/mutations";
import { useSession } from "@/lib/session";
import { colors, font, radius, space } from "@/lib/theme";

const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };

function currentMealType(): MealType {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner";
}

export default function Today() {
  const profileId = useSession((s) => s.profileId);
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId!) });
  useWelcomeBack();

  if (today.isLoading) return <Screen><Loading /></Screen>;
  if (today.error || !today.data) {
    return (
      <Screen>
        <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />
      </Screen>
    );
  }
  const data = today.data;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={font.title}>Today</Text>
            <Text style={font.small}>{new Date(`${data.date}T12:00:00`).toDateString()}</Text>
          </View>
          <Text style={styles.link} onPress={() => router.push("/onboarding")}>
            Edit goal
          </Text>
        </View>

        {profile.data?.profile.isDemo ? <DemoBanner /> : null}

        <CaloriesCard data={data} />
        <FocusCard data={data} />
        <MealsSection meals={data.meals} />
      </Screen>
      <Pressable accessibilityRole="button" style={styles.fab} onPress={() => router.push("/log")}>
        <Text style={styles.fabText}>+ Log a meal</Text>
      </Pressable>
    </View>
  );
}

function CaloriesCard({ data }: { data: TodayResponse }) {
  const t = data.targets;
  if (!t) return null;
  const left = t.calories - data.totals.calories;
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={font.h2}>
          {data.totals.calories} <Text style={font.small}>/ {t.calories} kcal</Text>
        </Text>
        {/* Over target is stated plainly, never as an alarm. */}
        <Text style={font.small}>{left >= 0 ? `${left} kcal left` : `${-left} kcal over today's estimate`}</Text>
      </View>
      <ProgressBar value={data.totals.calories} max={t.calories} color={left >= 0 ? colors.primary : colors.calm} />
      <View style={styles.macros}>
        <Macro label="Protein" value={data.totals.protein} target={t.protein} />
        <Macro label="Carbs" value={data.totals.carbs} target={t.carbs} />
        <Macro label="Fat" value={data.totals.fat} target={t.fat} />
        <Macro label="Fibre" value={data.totals.fibre} target={t.fibre} />
      </View>
    </Card>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={font.small}>{label}</Text>
      <ProgressBar value={value} max={target} color={colors.accent} />
      <Text style={styles.macroValue}>
        {Math.round(value)}/{target} g
      </Text>
    </View>
  );
}

function FocusCard({ data }: { data: TodayResponse }) {
  if (!data.focus) {
    return (
      <Card style={styles.focusCard}>
        <View style={styles.rowCenter}>
          <Kimbo mood="idle" size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={font.h2}>Get a daily food focus</Text>
            <Text style={font.small}>Add a blood report (or try a sample) and Kimbo will connect it to your meals.</Text>
          </View>
        </View>
        <Button label="Add a report" kind="secondary" onPress={() => router.push("/(tabs)/report")} />
      </Card>
    );
  }
  const s = data.focusSummary!;
  return (
    <Card style={styles.focusCard}>
      <View style={styles.rowCenter}>
        <Kimbo mood={s.supported > 0 ? "proud" : "focus"} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.focusLabel}>FOCUS</Text>
          <Text style={font.h2}>{data.focus.title}</Text>
          <Text style={font.body}>
            {s.total === 0
              ? "Log a meal to see how it fits."
              : `${s.supported} of your ${s.total} meal${s.total === 1 ? "" : "s"} today supported this focus.`}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function MealsSection({ meals }: { meals: TodayMeal[] }) {
  const repeatType = currentMealType();
  const afterWrite = useAfterWrite();
  const repeat = useMutation({
    mutationFn: () => api.repeatYesterday(repeatType),
    onSuccess: (res) => afterWrite(res.events),
  });
  const alreadyLogged = meals.some((m) => m.mealType === repeatType);

  return (
    <View style={{ gap: space.md }}>
      <Text style={font.h2}>What you ate</Text>
      {!alreadyLogged ? (
        <View style={styles.rowCenter}>
          <Chip label={`Same ${MEAL_LABEL[repeatType].toLowerCase()} as yesterday?`} onPress={() => repeat.mutate()} />
          {repeat.error ? <Text style={[font.small, { flex: 1 }]}>{errorMessage(repeat.error)}</Text> : null}
        </View>
      ) : null}
      {meals.length === 0 ? (
        <Card style={{ alignItems: "center" }}>
          <Kimbo mood="sleepy" size={72} />
          <Text style={font.body}>Nothing logged yet today.</Text>
          <Text style={font.small}>Tap "Log a meal" — a photo or a few words is enough.</Text>
        </Card>
      ) : (
        meals.map((m) => <MealRow key={m.id} meal={m} />)
      )}
    </View>
  );
}

function MealRow({ meal }: { meal: TodayMeal }) {
  const startEdit = useDraft((s) => s.startEdit);
  const open = async () => {
    const { foods } = await api.searchFoods("");
    startEdit(meal, Object.fromEntries(foods.map((f) => [f.id, f])));
    router.push("/review");
  };
  return (
    <Pressable onPress={open}>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={font.h2}>{MEAL_LABEL[meal.mealType]}</Text>
          <Text style={[font.body, { fontWeight: "700" }]}>{meal.totals.calories} kcal</Text>
        </View>
        <Text style={font.body}>{meal.items.map((i) => i.name).join(", ")}</Text>
        {meal.supportsFocus ? (
          <Text style={styles.supports}>✓ Supported your focus · {meal.focusReason}</Text>
        ) : meal.focusReason ? (
          <Text style={font.small}>{meal.focusReason}</Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

function DemoBanner() {
  const clear = useSession((s) => s.clear);
  return (
    <View style={styles.demo}>
      <Text style={[font.small, { flex: 1, color: colors.text }]}>You're exploring sample data.</Text>
      <Text
        style={styles.link}
        onPress={async () => {
          await clear();
          router.replace("/welcome");
        }}
      >
        Start fresh
      </Text>
    </View>
  );
}

/** Once per app launch: let Kimbo greet someone returning after a break. */
let checkedIn = false;
function useWelcomeBack() {
  const push = useMoments((s) => s.push);
  const ran = useRef(false);
  useEffect(() => {
    if (checkedIn || ran.current) return;
    ran.current = checkedIn = true;
    api.checkin().then((r) => push(r.events)).catch(() => {});
  }, [push]);
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end" },
  link: { color: colors.primary, fontWeight: "700" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: space.md },
  macros: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  macroValue: { fontSize: 12, color: colors.text },
  focusCard: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  focusLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: colors.primary },
  supports: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  fab: {
    position: "absolute",
    right: space.lg,
    bottom: space.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    elevation: 4,
  },
  fabText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
