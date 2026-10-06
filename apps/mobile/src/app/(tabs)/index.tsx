import type { MealType, TodayMeal, TodayResponse } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { JourneyCard } from "@/components/JourneyCard";
import { KimboBuddy } from "@/components/KimboBuddy";
import { TodaySkeleton } from "@/components/Skeleton";
import { Kimbo } from "@/components/Kimbo";
import { useMoments } from "@/components/Moments";
import { Bar, ErrorState, Icon, Ring, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { MEAL_LABEL, MEAL_ORDER, addName, nextMealPrompt } from "@/lib/format";
import { useAfterWrite } from "@/lib/mutations";
import { useSession } from "@/lib/session";
import { colors, macroColors, radius, space } from "@/lib/theme";

const MEAL_ICON: Record<MealType, IconName> = { breakfast: "sunrise", lunch: "sun", snack: "coffee", dinner: "moon" };

export default function Today() {
  const profileId = useSession((s) => s.profileId);
  const today = useQuery({ queryKey: ["today"], queryFn: api.today });
  const profile = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: !!profileId,
  });
  useWelcomeBack();

  if (today.isLoading)
    return (
      <Screen>
        <TodaySkeleton />
      </Screen>
    );
  if (today.error || !today.data) {
    return (
      <Screen>
        <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />
      </Screen>
    );
  }
  const data = today.data;
  const supported = data.focusSummary?.supported ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="overline" tone="faint">
            {new Date(`${data.date}T12:00:00`)
              .toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })
              .toUpperCase()}
          </T>
          <T variant="display">{addName(nextMealPrompt(data.meals.map((m) => m.mealType)), profile.data?.profile.name)}</T>
        </View>
        <KimboBuddy mood={data.meals.length ? "happy" : "idle"} leaves={1 + supported} />
      </View>

      {profile.data?.profile.isDemo ? <DemoBanner /> : null}

      <EnergyCard data={data} />
      {data.targets ? <JourneyCard /> : null}
      <FocusCard data={data} />

      <View style={{ gap: space.md }}>
        <T variant="heading">Meals</T>
        {MEAL_ORDER.map((type) => (
          <MealSlot
            key={type}
            type={type}
            meals={data.meals.filter((m) => m.mealType === type)}
            repeatable={data.repeatableMealTypes.includes(type)}
          />
        ))}
      </View>
    </Screen>
  );
}

function EnergyCard({ data }: { data: TodayResponse }) {
  const t = data.targets;
  if (!t) return null;
  const eaten = data.totals.calories;
  const left = t.calories - eaten;
  return (
    <Surface
      style={styles.energy}
      onPress={() => router.push("/nutrition")}
      accessibilityLabel={`${eaten} of ${t.calories} kilocalories. Open nutrition details`}
    >
      <Ring value={eaten} max={t.calories} size={132} stroke={12}>
        {/* Over target is stated plainly, in a calm colour — never an alarm. */}
        <T variant="number">{Math.abs(left)}</T>
        <T variant="caption">{left >= 0 ? "kcal left" : "kcal over"}</T>
      </Ring>
      <View style={styles.macros}>
        <T variant="label">
          {eaten} of {t.calories} kcal
        </T>
        <Macro label="Protein" value={data.totals.protein} target={t.protein} color={macroColors.protein} />
        <Macro label="Carbs" value={data.totals.carbs} target={t.carbs} color={macroColors.carbs} />
        <Macro label="Fat" value={data.totals.fat} target={t.fat} color={macroColors.fat} />
        <Macro label="Fibre" value={data.totals.fibre} target={t.fibre} color={macroColors.fibre} />
        <T variant="caption" tone="leaf">
          All nutrients ›
        </T>
      </View>
    </Surface>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.rowBetween}>
        <T variant="caption" tone="soft">
          {label}
        </T>
        <T variant="caption" tone="soft">
          {Math.round(value)}/{target} g
        </T>
      </View>
      <Bar value={value} max={target} color={color} height={6} />
    </View>
  );
}

function FocusCard({ data }: { data: TodayResponse }) {
  if (!data.focus) {
    return (
      <Surface tint="leaf" onPress={() => router.push("/(tabs)/report")} accessibilityLabel="Add a blood report">
        <View style={styles.rowCenter}>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="overline">FOOD FOCUS</T>
            <T variant="heading">Add your blood report</T>
            <T variant="label">Kimbo reads LDL, HbA1c and triglycerides and tells you what to eat more of.</T>
          </View>
          <Icon name="chevron-right" color={colors.leaf} />
        </View>
      </Surface>
    );
  }
  const s = data.focusSummary!;
  return (
    <Surface
      tint="leaf"
      onPress={() => router.push("/(tabs)/report")}
      accessibilityLabel={`Focus: ${data.focus.title}. Open report insights`}
    >
      <View style={styles.rowCenter}>
        <Kimbo mood={s.supported ? "proud" : "focus"} size={64} leaves={1 + s.supported} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="overline">TODAY'S FOCUS</T>
          <T variant="heading">{data.focus.title}</T>
          <View style={styles.dots}>
            {data.meals.map((m) => (
              <View key={m.id} style={[styles.dot, m.supportsFocus ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
          <T variant="label">
            {s.total === 0
              ? "Log a meal to see how it fits."
              : `${s.supported} of ${s.total} meal${s.total === 1 ? "" : "s"} helped today`}
          </T>
        </View>
      </View>
      <T variant="caption" tone="leaf">
        One leaf on Kimbo for each meal that helped.
      </T>
    </Surface>
  );
}

function MealSlot({ type, meals, repeatable }: { type: MealType; meals: TodayMeal[]; repeatable: boolean }) {
  const afterWrite = useAfterWrite();
  const repeat = useMutation({
    mutationFn: () => api.repeatYesterday(type),
    onSuccess: (res) => afterWrite(res.events),
  });

  if (meals.length)
    return (
      <>
        {meals.map((m) => (
          <MealCard key={m.id} meal={m} />
        ))}
      </>
    );
  return (
    <View style={styles.emptySlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${MEAL_LABEL[type]}`}
        onPress={() => router.push({ pathname: "/log", params: { mealType: type } })}
        style={styles.emptyMain}
      >
        <View style={styles.mealIconMuted}>
          <Icon name={MEAL_ICON[type]} size={18} color={colors.inkFaint} />
        </View>
        <T variant="bodyStrong" tone="soft" style={{ flex: 1 }}>
          Add {MEAL_LABEL[type].toLowerCase()}
        </T>
        <Icon name="plus" size={18} color={colors.leaf} />
      </Pressable>
      {repeatable ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => repeat.mutate()}
          disabled={repeat.isPending}
          style={[styles.repeat, repeat.isPending && { opacity: 0.5 }]}
        >
          <Icon name="rotate-ccw" size={14} color={colors.leaf} />
          <T variant="label" tone="leaf">
            {repeat.isPending ? "Adding…" : "Same as yesterday"}
          </T>
        </Pressable>
      ) : null}
      {repeat.error ? (
        <T variant="caption" style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
          {errorMessage(repeat.error)}
        </T>
      ) : null}
    </View>
  );
}

function MealCard({ meal }: { meal: TodayMeal }) {
  const startEdit = useDraft((s) => s.startEdit);
  const open = async () => {
    const { foods } = await api.searchFoods("");
    startEdit(meal, Object.fromEntries(foods.map((f) => [f.id, f])));
    router.push("/review");
  };
  return (
    <Surface onPress={open} accessibilityLabel={`${MEAL_LABEL[meal.mealType]}, ${meal.totals.calories} kilocalories`}>
      <View style={styles.rowCenter}>
        <View style={styles.mealIcon}>
          <Icon name={MEAL_ICON[meal.mealType]} size={18} color={colors.leafDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="heading">{MEAL_LABEL[meal.mealType]}</T>
          <T variant="label" numberOfLines={1}>
            {new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </T>
        </View>
        <T variant="heading">{meal.totals.calories}</T>
        <T variant="caption">kcal</T>
      </View>
      <T variant="body" numberOfLines={2}>
        {meal.items.map((i) => i.name).join(" · ")}
      </T>
      {meal.supportsFocus ? (
        <View style={styles.helped}>
          <Icon name="check" size={14} color={colors.leafDeep} />
          <T variant="caption" tone="leaf" numberOfLines={2} style={{ flex: 1 }}>
            {meal.focusReason}
          </T>
        </View>
      ) : meal.focusReason ? (
        <T variant="caption">{meal.focusReason}</T>
      ) : null}
    </Surface>
  );
}

function DemoBanner() {
  const clear = useSession((s) => s.clear);
  return (
    <View style={styles.demo}>
      <Icon name="eye" size={16} color={colors.turmericDeep} />
      <T variant="label" style={{ flex: 1, color: colors.ink }}>
        Sample data
      </T>
      <T
        variant="label"
        tone="leaf"
        onPress={async () => {
          await clear();
          router.replace("/welcome");
        }}
      >
        Start fresh
      </T>
    </View>
  );
}

/**
 * On mount and whenever the app returns to the foreground, let Kimbo greet someone
 * coming back after a break. The API decides; each break is greeted only once.
 */
function useWelcomeBack() {
  const push = useMoments((s) => s.push);
  useEffect(() => {
    const checkin = () =>
      api
        .checkin()
        .then((r) => push(r.events))
        .catch(() => {});
    checkin();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkin();
    });
    return () => sub.remove();
  }, [push]);
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: space.md, marginTop: space.sm, zIndex: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: space.md },
  energy: { flexDirection: "row", alignItems: "center", gap: space.xl },
  macros: { flex: 1, gap: space.sm },
  dots: { flexDirection: "row", gap: 6, marginVertical: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: colors.leaf },
  dotOff: { borderWidth: 1.5, borderColor: colors.leaf, opacity: 0.5 },
  mealIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  mealIconMuted: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sunk,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySlot: { borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line },
  emptyMain: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  repeat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    marginLeft: 50,
  },
  helped: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.turmericSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
