import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ErrorState, Icon, Loading, SheetPanel, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft, useFoodPicker } from "@/lib/draft";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Pick (or swap in) a dish. Anything Kimbo doesn't know can still be added as an estimate. */
export default function FoodSearch() {
  const [q, setQ] = useState("");
  const addFood = useDraft((s) => s.addFood);
  const addEstimate = useDraft((s) => s.addEstimate);
  const replaceKey = useFoodPicker((s) => s.replaceKey);
  const query = q.trim();
  const results = useQuery({ queryKey: ["foods", query.toLowerCase()], queryFn: () => api.searchFoods(query) });

  return (
    <SheetPanel title={replaceKey ? "Swap dish" : "Add a dish"} onClose={() => router.back()} maxHeight={0.88}>
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
      {results.isLoading ? <Loading /> : null}
      {results.error ? <ErrorState message={errorMessage(results.error)} onRetry={() => results.refetch()} /> : null}
      <FlatList
        style={{ marginTop: space.sm }}
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
                <T variant="bodyStrong">Add "{query}" as an estimate</T>
                <T variant="caption">For dishes not in Kimbo's list yet — you can adjust the calories.</T>
              </View>
            </Pressable>
          ) : null
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
    </SheetPanel>
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
    borderColor: colors.line,
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
});
