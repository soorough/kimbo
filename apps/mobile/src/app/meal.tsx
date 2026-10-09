import type { ConfirmItem, TodayMeal, TodayResponse } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { PROTEIN_ICON } from "@/components/DayNumbers";
import { Sheet } from "@/components/Sheet";
import { Icon, Screen, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { MEAL_LABEL } from "@/lib/format";
import { mealTitle as title } from "@/lib/meal-title";
import { useSession } from "@/lib/session";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";

/** The meal as Today last loaded it (whichever day is showing), so the screen opens instantly. */
function useMeal(id: string | undefined): TodayMeal | null {
  const queryClient = useQueryClient();
  for (const [, data] of queryClient.getQueriesData<TodayResponse>({ queryKey: ["today"] })) {
    const meal = data?.meals.find((m) => m.id === id);
    if (meal) return meal;
  }
  return null;
}

/**
 * Cal AI's food detail, for a whole meal: the dishes and portions, calories, macros that swipe
 * to fibre, sat fat and the focus, other nutrition facts, and save / edit / delete.
 */
export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const meal = useMeal(id);
  const profileId = useSession((s) => s.profileId);
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId!), enabled: !!profileId });
  const protein = PROTEIN_ICON[profile.data?.profile.diet ?? "vegetarian"];
  const queryClient = useQueryClient();
  const startEdit = useDraft((s) => s.startEdit);
  const [menu, setMenu] = useState(false);
  const [facts, setFacts] = useState(false);
  const [saved, setSaved] = useState(false);
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const save = useMutation({
    mutationFn: () => api.saveMeal({ name: title(meal!), items: meal!.items.map(toConfirmItem) }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["savedMeals"] });
    },
  });
  const del = useMutation({
    mutationFn: () => api.deleteMeal(meal!.id),
    onSuccess: async () => {
      setMenu(false);
      router.back();
      await queryClient.invalidateQueries();
    },
  });

  if (!meal) {
    return (
      <Screen back title="Nutrition">
        <T variant="body">This meal isn't loaded any more. Go back and open it again.</T>
      </Screen>
    );
  }
  const n = meal.totals;
  const edit = async () => {
    setMenu(false);
    const { foods } = await api.searchFoods("");
    startEdit(meal, Object.fromEntries(foods.map((f) => [f.id, f])));
    router.push("/review");
  };

  return (
    <Screen footer={<Button label="Done" onPress={() => router.back()} />}>
      {/* Cal AI's header: back, the title in the middle, and the … menu. */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.round}>
          <Icon name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <T variant="heading" align="center" style={{ flex: 1 }}>
          Nutrition
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={10} onPress={() => setMenu(true)} style={styles.round}>
          <Icon name="more-horizontal" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.chip}>
        <T variant="caption" tone="ink">
          {MEAL_LABEL[meal.mealType]} · {new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </T>
      </View>
      <View style={styles.titleRow}>
        <T variant="title" style={{ flex: 1 }}>
          {title(meal)}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? "Saved to Saved foods" : "Save to Saved foods"}
          disabled={saved || save.isPending}
          onPress={() => save.mutate()}
          hitSlop={10}
        >
          <Icon name="bookmark" size={24} color={saved ? colors.leaf : colors.ink} />
        </Pressable>
      </View>
      {saved ? (
        <T variant="caption" tone="leaf">
          Saved to Saved foods
        </T>
      ) : save.error ? (
        <T variant="caption" tone="plum">
          {errorMessage(save.error)}
        </T>
      ) : null}

      {/* Kimbo's take on "Measurement / Number of servings": every dish and its portion. */}
      <View style={{ gap: space.sm }}>
        <T variant="heading">Dishes</T>
        {meal.items.map((i) => (
          <Pressable key={i.id} accessibilityRole="button" accessibilityHint="Edit portions" onPress={edit} style={styles.dish}>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">{i.name}</T>
              <T variant="caption">
                {i.quantity} {i.unit}
              </T>
            </View>
            <T variant="label">{Math.round(i.nutrition.calories)} kcal</T>
            <Icon name="edit-2" size={14} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.card, styles.calCard]}>
        <Icon name="zap" size={24} color={colors.ink} />
        <View>
          <T variant="label">Calories</T>
          <T style={styles.calBig}>{Math.round(n.calories)}</T>
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        {/* Full-width pages that each keep the screen's margins, so cards never slice at the edge. */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ marginHorizontal: -space.xl }}
        >
          <View style={[styles.page, { width }]}>
            <Macro icon={protein} label="Protein" value={`${Math.round(n.protein)}g`} />
            <Macro icon="🌾" label="Carbs" value={`${Math.round(n.carbs)}g`} />
            <Macro icon="🥜" label="Fats" value={`${Math.round(n.fat)}g`} />
          </View>
          <View style={[styles.page, { width }]}>
            <Macro icon="🥦" label="Fibre" value={`${Math.round(n.fibre * 10) / 10}g`} />
            <Macro icon="🧈" label="Sat fat" value={`${Math.round(n.satFat * 10) / 10}g`} />
            <Macro icon="🌱" label="Focus" value={meal.supportsFocus ? "Helped" : meal.supportsFocus === false ? "Not yet" : "—"} />
          </View>
        </ScrollView>
        <View style={styles.pager}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: facts }} onPress={() => setFacts((v) => !v)} style={styles.factsHead}>
        <T variant="heading" style={{ flex: 1 }}>
          Other nutrition facts
        </T>
        <Icon name={facts ? "chevron-down" : "chevron-right"} size={20} color={colors.ink} />
      </Pressable>
      {facts ? (
        <View style={{ gap: space.sm }}>
          <Fact label="Saturated fat" value={`${Math.round(n.satFat * 10) / 10}g`} />
          <Fact label="Fibre" value={`${Math.round(n.fibre * 10) / 10}g`} />
          <Fact label="Carbs" value={`${Math.round(n.carbs)}g`} />
          <Fact label="Protein" value={`${Math.round(n.protein)}g`} />
        </View>
      ) : null}

      <Sheet visible={menu} onClose={() => setMenu(false)} title={title(meal)}>
        <View style={{ gap: space.xs }}>
          <MenuRow icon="edit-3" label="Edit meal" onPress={edit} />
          <MenuRow
            icon="bookmark"
            label={saved ? "Saved to Saved foods" : "Save to Saved foods"}
            onPress={() => {
              setMenu(false);
              if (!saved) save.mutate();
            }}
          />
          <MenuRow icon="trash-2" label={del.isPending ? "Deleting…" : "Delete meal"} danger onPress={() => del.mutate()} />
          {del.error ? (
            <T variant="caption" tone="plum">
              {errorMessage(del.error)}
            </T>
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}

function toConfirmItem(i: TodayMeal["items"][number]): ConfirmItem {
  return i.foodId && !i.isEstimate
    ? { kind: "catalogue", foodId: i.foodId, quantity: i.quantity, unit: i.unit as never }
    : { kind: "estimate", name: i.name, quantity: i.quantity, unit: i.unit, nutrition: i.nutrition };
}

function Macro({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={[styles.card, styles.macro]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <T style={{ fontSize: 14 }}>{icon}</T>
        <T variant="caption">{label}</T>
      </View>
      <T style={styles.macroValue}>{value}</T>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.card, styles.fact]}>
      <T variant="body" style={{ flex: 1 }}>
        {label}
      </T>
      <T variant="bodyStrong">{value}</T>
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
      <Icon name={icon} size={20} color={danger ? colors.terracotta : colors.ink} />
      <T variant="bodyStrong" tone={danger ? "terracotta" : undefined}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  chip: { alignSelf: "flex-start", backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dish: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  calCard: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg },
  calBig: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, color: colors.ink },
  // Both pages are one row of three, so they're the same height and nothing jumps.
  page: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.xl, paddingVertical: 4 },
  macro: { flex: 1, padding: space.md, gap: 4 },
  macroValue: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.ink },
  pager: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.inkFaint },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  factsHead: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
  fact: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md },
  menuRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
});
