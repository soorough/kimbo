import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { FoodCard, LibraryEmpty, LogFoodTabs, useLogFoodParams } from "@/components/LogFood";
import { ListSkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Notice, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { mealTypeForNow } from "@/lib/format";
import { colors, fonts, radius, space } from "@/lib/theme";

/**
 * Log Food → My meals (build a go-to combination) and → Saved foods (the meals the user
 * bookmarked), after Cal AI. Either one opens straight in review.
 */
export default function MyMeals({ savedSection = false }: { savedSection?: boolean }) {
  const { pick } = useLogFoodParams();
  const saved = useQuery({ queryKey: ["savedMeals"], queryFn: api.savedMeals, enabled: savedSection });
  const [search, setSearch] = useState("");
  const meals = saved.data?.meals ?? [];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? meals.filter((meal) => meal.name.toLowerCase().includes(q)) : meals;
  }, [meals, search]);

  const createMeal = () => {
    if (pick) return router.back();
    useDraft.getState().startManual(mealTypeForNow());
    router.push("/review");
  };

  return (
    <Screen back title="Log food" scroll={false} padded={false} bottomClearance={false}>
      <LogFoodTabs active={savedSection ? "/saved-foods" : "/my-meals"} />
      {!savedSection ? (
        <LibraryEmpty
          emoji="🥗"
          title="My Meals"
          message="Quickly log your go-to meal combinations."
          action="Create meal"
          onAction={createMeal}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              accessibilityLabel="Search saved foods"
            />
          </View>
          {saved.isLoading ? <ListSkeleton rows={4} header={false} /> : null}
          {saved.error ? <ErrorState message={errorMessage(saved.error)} onRetry={() => saved.refetch()} /> : null}
          {saved.data && meals.length === 0 ? (
            <Notice mood="idle" title="Nothing saved yet" message="Tap the bookmark on a meal to keep it here." />
          ) : null}
          {shown.map((meal) => (
            <FoodCard
              key={meal.id}
              title={meal.name}
              calories={meal.calories}
              portion={meal.draft.items.length === 1 ? "1 dish" : `${meal.draft.items.length} dishes`}
              onAdd={() => {
                if (pick) {
                  useDraft.getState().appendDraft(meal.draft);
                  router.back();
                  return;
                }
                useDraft.getState().startFromAi(meal.draft, "repeat");
                router.push("/review");
              }}
            />
          ))}
          {meals.length > 0 && shown.length === 0 ? <Notice mood="idle" title="No matches" message="Try another name." /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl, gap: space.md },
  search: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: space.md },
});
