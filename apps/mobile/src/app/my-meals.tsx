import type { SavedMeal } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ErrorState, Icon, Notice, Screen, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Manage "My meals": rename one by tapping its name, or delete it. */
export default function MyMeals() {
  const saved = useQuery({ queryKey: ["savedMeals"], queryFn: api.savedMeals });

  return (
    <Screen back title="My meals">
      {saved.error ? (
        <ErrorState message={errorMessage(saved.error)} onRetry={() => saved.refetch()} />
      ) : saved.data && saved.data.meals.length === 0 ? (
        <Notice
          mood="idle"
          title="No saved meals yet"
          message="Tick “Save to My meals” when you check a meal to keep it here."
        />
      ) : (
        <View style={styles.list}>
          {saved.data?.meals.map((m, i) => <Row key={m.id} meal={m} first={i === 0} />)}
        </View>
      )}
    </Screen>
  );
}

function Row({ meal, first }: { meal: SavedMeal; first: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(meal.name);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["savedMeals"] });

  const rename = useMutation({
    mutationFn: () => api.renameSavedMeal(meal.id, name.trim()),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: () => api.deleteSavedMeal(meal.id), onSuccess: refresh });

  const commit = () => (name.trim() && name.trim() !== meal.name ? rename.mutate() : setEditing(false));
  const dishes = meal.draft.items.map((i) => (i.kind === "catalogue" ? i.food.name : i.name)).join(", ");

  return (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={{ flex: 1, gap: 2 }}>
        {editing ? (
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={commit}
            onBlur={commit}
            style={styles.input}
            accessibilityLabel="Meal name"
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityHint="Rename" onPress={() => setEditing(true)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {meal.name}
              </T>
              <Icon name="edit-2" size={14} color={colors.inkFaint} />
            </View>
          </Pressable>
        )}
        <T variant="caption" numberOfLines={2}>
          {meal.calories} kcal · {dishes}
        </T>
        {rename.error || remove.error ? (
          <T variant="caption" tone="plum">
            {errorMessage(rename.error ?? remove.error)}
          </T>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${meal.name}`}
        hitSlop={10}
        disabled={remove.isPending}
        onPress={() => remove.mutate()}
        style={[styles.delete, remove.isPending && { opacity: 0.4 }]}
      >
        <Icon name="trash-2" size={18} color={colors.terracotta} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  input: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.ink,
  },
  delete: { padding: space.sm },
});
