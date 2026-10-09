import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ListSkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Screen, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Pick (or swap in) a dish. Anything Kimbo doesn't know can still be added as an estimate. */
export default function FoodSearch() {
  const params = useLocalSearchParams<{ replaceKey?: string }>();
  const [q, setQ] = useState("");
  const addFood = useDraft((s) => s.addFood);
  const addEstimate = useDraft((s) => s.addEstimate);
  const replaceKey = params.replaceKey ?? null;
  const query = q.trim();
  const results = useQuery({ queryKey: ["foods", query.toLowerCase()], queryFn: () => api.searchFoods(query) });

  return (
    <Screen back title="Log food" scroll={false} padded={false} bottomClearance={false}>
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.tab, styles.tabActive]}>
          <T variant="label" style={styles.tabTextActive}>All</T>
        </Pressable>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/my-foods")} style={styles.tab}>
          <T variant="label" tone="soft">My foods</T>
        </Pressable>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/my-meals")} style={styles.tab}>
          <T variant="label" tone="soft">My meals</T>
        </Pressable>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/saved-foods")} style={styles.tab}>
          <T variant="label" tone="soft">Saved foods</T>
        </Pressable>
      </View>
        <View style={styles.content}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkFaint} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Roti, dal, paneer, dosa…"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              accessibilityLabel="Search foods"
            />
          </View>
          {results.isLoading ? <ListSkeleton rows={6} header={false} /> : null}
          {results.error ? <ErrorState message={errorMessage(results.error)} onRetry={() => results.refetch()} /> : null}
          <FlatList
            style={styles.results}
            contentContainerStyle={styles.resultsContent}
            data={results.data?.foods ?? []}
            keyExtractor={(f) => f.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListFooterComponent={
              query.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    addEstimate(query.charAt(0).toUpperCase() + query.slice(1), replaceKey ?? undefined);
                    router.back();
                  }}
                  style={styles.custom}
                >
                  <Icon name="edit-3" size={18} color={colors.plum} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">Add "{query}" with a rough estimate</T>
                    <T variant="caption">Use this if the listed matches don’t fit your dish.</T>
                  </View>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              results.isLoading || results.error ? null : (
                <View style={styles.empty}>
                  <Icon name="search" size={22} color={colors.inkFaint} />
                  <T variant="bodyStrong">{query ? `No matches for “${query}”` : "No foods found"}</T>
                  {query.length > 1 ? <T variant="caption" align="center">You can add a rough estimate below.</T> : null}
                </View>
              )
            }
            renderItem={({ item }) => {
              const unit = item.units.find((u) => u.unit === item.defaultUnit) ?? item.units[0]!;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    addFood(item, replaceKey ?? undefined);
                    router.back();
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunk }]}
                >
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{item.name}</T>
                    <T variant="caption">{unit.label}</T>
                  </View>
                  <T variant="label">{Math.round(unit.perUnit.calories)} kcal</T>
                  <Icon name="plus" size={18} color={colors.leaf} />
                </Pressable>
              );
            }}
          />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.lg,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  custom: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    marginTop: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.plumSoft,
  },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: space.xl },
  tab: { minHeight: 48, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.ink },
  tabTextActive: { color: colors.ink },
  content: { flex: 1, alignSelf: "stretch", paddingHorizontal: space.xxl, paddingTop: space.lg, paddingBottom: space.md },
  results: { flex: 1, width: "100%", marginTop: space.sm },
  resultsContent: { flexGrow: 1 },
});
