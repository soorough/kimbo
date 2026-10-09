import type { Food } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { FoodCard, LogFoodTabs, useLogFoodParams } from "@/components/LogFood";
import { ListSkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Screen, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { mealTypeForNow } from "@/lib/format";
import { colors, fonts, radius, space } from "@/lib/theme";

/**
 * Log Food → All, after Cal AI: describe what you ate, pick from Kimbo's dish list, or
 * re-log something recent. Opened from review (`pick`), a pick goes back into that meal.
 */
export default function FoodSearch() {
  const { pick, replaceKey } = useLogFoodParams();
  const [q, setQ] = useState("");
  const query = q.trim();
  const results = useQuery({
    queryKey: ["foods", query.toLowerCase()],
    queryFn: () => api.searchFoods(query),
    enabled: query.length > 0,
  });
  const recent = useQuery({ queryKey: ["recentMeals"], queryFn: api.recentMeals, enabled: !pick });

  const generate = useMutation({
    mutationFn: () => api.parseMeal({ text: query }),
    onSuccess: (draft) => {
      useDraft.getState().startFromAi(draft, "text");
      router.push("/review");
    },
  });

  function addFood(food: Food) {
    const draft = useDraft.getState();
    if (pick) {
      draft.addFood(food, replaceKey);
      router.back();
      return;
    }
    draft.startQuick(mealTypeForNow());
    draft.addFood(food);
    router.push("/review");
  }

  const footer = pick ? (
    query.length > 1 ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          useDraft.getState().addEstimate(query.charAt(0).toUpperCase() + query.slice(1), replaceKey);
          router.back();
        }}
        style={styles.pill}
      >
        <Icon name="edit-3" size={18} color={colors.ink} />
        <T variant="bodyStrong">Add “{query}” as an estimate</T>
      </Pressable>
    ) : null
  ) : query ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => generate.mutate()}
      disabled={generate.isPending}
      style={[styles.pill, generate.isPending && { opacity: 0.6 }]}
    >
      <Icon name="star" size={18} color={colors.ink} />
      <T variant="bodyStrong">{generate.isPending ? "Kimbo is preparing your meal…" : "Let Kimbo prepare your meal"}</T>
    </Pressable>
  ) : (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          useDraft.getState().startManual(mealTypeForNow());
          router.push("/review");
        }}
        style={[styles.pill, { flex: 1 }]}
      >
        <Icon name="file-text" size={18} color={colors.ink} />
        <T variant="bodyStrong">Manual Add</T>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/log", params: { voice: "1" } })}
        style={[styles.pill, { flex: 1 }]}
      >
        <Icon name="mic" size={18} color={colors.ink} />
        <T variant="bodyStrong">Voice Log</T>
      </Pressable>
    </View>
  );

  return (
    <Screen back title="Log food" scroll={false} padded={false} bottomClearance={false} footer={footer}>
      <LogFoodTabs active="/food-search" />
      <View style={styles.content}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.inkFaint} />
          <TextInput
            autoFocus={pick}
            value={q}
            onChangeText={setQ}
            placeholder="Describe what you ate"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            returnKeyType="search"
            accessibilityLabel="Describe what you ate"
          />
          {q ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={() => setQ("")}>
              <Icon name="x" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
        {generate.error ? <ErrorState message={errorMessage(generate.error)} /> : null}

        {query ? (
          <>
            {results.isLoading ? <ListSkeleton rows={6} header={false} /> : null}
            {results.error ? <ErrorState message={errorMessage(results.error)} onRetry={() => results.refetch()} /> : null}
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={results.data?.foods ?? []}
              keyExtractor={(f) => f.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={results.data?.foods.length ? <T variant="heading">Select from database</T> : null}
              ListEmptyComponent={
                results.isLoading || results.error ? null : (
                  <View style={styles.empty}>
                    <T variant="bodyStrong">No matches for “{query}”</T>
                    <T variant="caption" align="center">
                      {pick ? "You can add it as an estimate below." : "Let Kimbo prepare it for you below."}
                    </T>
                  </View>
                )
              }
              renderItem={({ item }) => {
                const unit = item.units.find((u) => u.unit === item.defaultUnit) ?? item.units[0]!;
                return (
                  <FoodCard
                    title={item.name}
                    calories={Math.round(unit.perUnit.calories)}
                    portion={unit.label}
                    onAdd={() => addFood(item)}
                  />
                );
              }}
            />
          </>
        ) : !pick ? (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={recent.data?.meals ?? []}
            keyExtractor={(m) => m.key}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={recent.data?.meals.length ? <T variant="heading">Recently logged</T> : null}
            ListEmptyComponent={recent.isLoading ? <ListSkeleton rows={3} header={false} /> : null}
            renderItem={({ item }) => (
              <FoodCard
                title={item.label}
                calories={Math.round(item.calories)}
                portion={item.draft.items.length === 1 ? "1 dish" : `${item.draft.items.length} dishes`}
                onAdd={() => {
                  useDraft.getState().startFromAi(item.draft, "repeat");
                  router.push("/review");
                }}
              />
            )}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignSelf: "stretch", paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.lg,
    minHeight: 54,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: space.md },
  list: { flex: 1, width: "100%" },
  listContent: { flexGrow: 1, gap: space.md, paddingBottom: space.lg },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  actions: { flexDirection: "row", gap: space.md },
  pill: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
});
