import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ErrorState, Loading } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft, useFoodPicker } from "@/lib/draft";
import { colors, font, radius, space } from "@/lib/theme";

export default function FoodSearch() {
  const [q, setQ] = useState("");
  const addFood = useDraft((s) => s.addFood);
  const replaceKey = useFoodPicker((s) => s.replaceKey);
  const results = useQuery({ queryKey: ["foods", q.trim().toLowerCase()], queryFn: () => api.searchFoods(q.trim()) });

  return (
    <View style={styles.screen}>
      <TextInput
        autoFocus
        value={q}
        onChangeText={setQ}
        placeholder="Search roti, dal, paneer…"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      {results.isLoading ? <Loading /> : null}
      {results.error ? <ErrorState message={errorMessage(results.error)} onRetry={() => results.refetch()} /> : null}
      <FlatList
        data={results.data?.foods ?? []}
        keyExtractor={(f) => f.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          results.data ? <Text style={[font.small, { padding: space.lg }]}>No match — try another name.</Text> : null
        }
        renderItem={({ item }) => {
          const unit = item.units.find((u) => u.unit === item.defaultUnit)!;
          return (
            <Pressable
              style={styles.row}
              onPress={() => {
                addFood(item, replaceKey ?? undefined);
                router.back();
              }}
            >
              <Text style={font.body}>{item.name}</Text>
              <Text style={font.small}>
                {Math.round(unit.perUnit.calories)} kcal / {unit.label}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    color: colors.text,
  },
  row: { paddingVertical: space.md, gap: 2 },
  sep: { height: 1, backgroundColor: colors.border },
});
