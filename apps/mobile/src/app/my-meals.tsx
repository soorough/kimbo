import type { SavedMeal } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ListSkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Notice, Screen, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { colors, radius, space } from "@/lib/theme";

/** Saved meals are presented as quick-add cards, matching the food picker flow. */
export default function MyMeals({ savedSection = false }: { savedSection?: boolean }) {
  const saved = useQuery({ queryKey: ["savedMeals"], queryFn: api.savedMeals });
  const [search, setSearch] = useState("");
  const meals = saved.data?.meals ?? [];
  const filteredMeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter((meal) => meal.name.toLowerCase().includes(q));
  }, [meals, search]);

  return (
    <Screen back title="Log food" scroll={false} padded={false} bottomClearance={false}>
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/food-search")} style={styles.tab}>
          <T variant="label" tone="soft">All</T>
        </Pressable>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/my-foods")} style={styles.tab}>
          <T variant="label" tone="soft">My foods</T>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: !savedSection }} onPress={() => savedSection ? router.replace("/my-meals") : undefined} style={[styles.tab, !savedSection && styles.tabActive]}>
          <T variant="label" style={!savedSection ? styles.tabTextActive : undefined}>My meals</T>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: savedSection }} onPress={() => savedSection ? undefined : router.replace("/saved-foods")} style={[styles.tab, savedSection && styles.tabActive]}>
          <T variant="label" style={savedSection ? styles.tabTextActive : undefined}>Saved foods</T>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!savedSection ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a meal"
          onPress={() => {
            useDraft.getState().startManual("lunch");
            router.push("/review");
          }}
          style={({ pressed }) => [styles.createCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.createIcon}><Icon name="plus" size={22} color={colors.ink} /></View>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Create a meal</T>
            <T variant="caption" tone="soft">Build and save a meal for later</T>
          </View>
          <Icon name="chevron-right" size={19} color={colors.inkSoft} />
        </Pressable>
      ) : null}
      {savedSection && meals.length > 0 ? (
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.inkFaint} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search my meals" placeholderTextColor={colors.inkFaint} style={styles.searchInput} accessibilityLabel="Search my meals" />
        </View>
      ) : null}
      {saved.isLoading ? <ListSkeleton rows={4} header={false} /> : null}
      {saved.error ? <ErrorState message={errorMessage(saved.error)} onRetry={() => saved.refetch()} /> : null}
      {(!savedSection || (saved.data && saved.data.meals.length === 0)) ? (
        <Notice mood="idle" title="No meals yet" message="Meals you log will appear here." />
      ) : null}
      {savedSection && filteredMeals.length ? (
        <View style={{ gap: space.sm }}>
          <View style={styles.list}>
            {filteredMeals.map((meal) => <Row key={meal.id} meal={meal} />)}
          </View>
        </View>
      ) : null}
      {savedSection && meals.length > 0 && filteredMeals.length === 0 ? <Notice mood="idle" title="No meals found" message="Try another name." /> : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ meal }: { meal: SavedMeal }) {
  const startFromAi = useDraft((s) => s.startFromAi);
  const dishes = meal.draft.items.map((i) => (i.kind === "catalogue" ? i.food.name : i.name)).join(", ");
  const add = () => {
    startFromAi(meal.draft, "repeat");
    router.push("/review");
  };

  return (
    <View style={styles.row}>
      <View style={styles.details}>
        <T variant="bodyStrong" numberOfLines={1}>{meal.name}</T>
        <View style={styles.meta}>
          <Icon name="zap" size={15} color={colors.inkSoft} />
          <T variant="caption" tone="soft">{meal.calories} kcal · {meal.draft.items.length} {meal.draft.items.length === 1 ? "dish" : "dishes"}</T>
        </View>
        {dishes && meal.draft.items.length > 1 ? <T variant="caption" numberOfLines={1} tone="soft">{dishes}</T> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${meal.name} to your log`}
        onPress={add}
        hitSlop={8}
        style={({ pressed }) => [styles.addButton, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Icon name="plus" size={21} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: space.xl },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl, gap: space.lg },
  createCard: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  createIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.sunk },
  search: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: space.md },
  tab: { minHeight: 48, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.ink },
  tabTextActive: { color: colors.ink },
  list: { gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 92,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  details: { flex: 1, gap: space.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
});
