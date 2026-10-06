import type { MealType } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Card, Chip, Screen, Stepper, formatQty } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { draftTotals, lineNutrition, toConfirmItems, useDraft, useFoodPicker, type DraftLine } from "@/lib/draft";
import { useAfterWrite } from "@/lib/mutations";
import { colors, font, radius, space } from "@/lib/theme";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

export default function Review() {
  const draft = useDraft();
  const setReplaceKey = useFoodPicker((s) => s.setReplaceKey);
  const afterWrite = useAfterWrite();
  const totals = draftTotals(draft.lines);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        mealType: draft.mealType,
        source: draft.source,
        eatenAt: draft.eatenAt.toISOString(),
        // Only an AI suggestion can be "corrected"; manual logs and edits aren't corrections.
        wasCorrected: draft.touched && (draft.source === "photo" || draft.source === "text") && !draft.mealId,
        items: toConfirmItems(draft.lines),
      };
      return draft.mealId ? api.updateMeal(draft.mealId, body) : api.confirmMeal(body);
    },
    onSuccess: async (res) => {
      await afterWrite(res.events);
      router.dismissTo("/(tabs)");
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteMeal(draft.mealId!),
    onSuccess: async () => {
      await afterWrite();
      router.dismissTo("/(tabs)");
    },
  });

  const openSearch = (replaceKey: string | null) => {
    setReplaceKey(replaceKey);
    router.push("/food-search");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Kimbo mood={draft.lines.length ? "happy" : "idle"} size={52} />
        <Text style={[font.body, { flex: 1 }]}>
          {draft.mealId
            ? "Edit anything that's changed."
            : draft.lines.length
              ? "Here's what I found. Fix anything I got wrong — nothing is saved until you confirm."
              : "Add what you ate from the food list."}
        </Text>
      </View>

      {draft.lines.map((line) => (
        <ItemCard key={line.key} line={line} onSwap={() => openSearch(line.key)} />
      ))}

      <Button label="Add an item" icon="+" kind="secondary" onPress={() => openSearch(null)} />

      <Card>
        <Text style={font.h2}>{totals.calories} kcal</Text>
        <Text style={font.small}>
          Protein {totals.protein} g · Carbs {totals.carbs} g · Fat {totals.fat} g · Fibre {totals.fibre} g
        </Text>
      </Card>

      <Card>
        <Text style={styles.label}>Meal</Text>
        <View style={styles.chips}>
          {MEAL_TYPES.map((t) => (
            <Chip key={t} label={t[0]!.toUpperCase() + t.slice(1)} selected={draft.mealType === t} onPress={() => draft.setMealType(t)} />
          ))}
        </View>
        <Text style={styles.label}>Time</Text>
        <View style={[styles.chips, { alignItems: "center" }]}>
          <Chip label="− 30 min" onPress={() => draft.shiftTime(-30)} />
          <Text style={[font.body, { fontWeight: "700" }]}>{formatTime(draft.eatenAt)}</Text>
          <Chip label="+ 30 min" onPress={() => draft.shiftTime(30)} />
        </View>
      </Card>

      {save.error ? <Text style={styles.error}>{errorMessage(save.error)}</Text> : null}
      <Button label={draft.mealId ? "Save changes" : "Confirm meal"} disabled={!draft.lines.length} loading={save.isPending} onPress={() => save.mutate()} />
      {draft.mealId ? (
        <Button label="Delete this meal" kind="ghost" loading={remove.isPending} onPress={() => remove.mutate()} />
      ) : (
        <Button label="Cancel" kind="ghost" onPress={() => router.back()} />
      )}
    </Screen>
  );
}

function ItemCard({ line, onSwap }: { line: DraftLine; onSwap: () => void }) {
  const update = useDraft((s) => s.update);
  const remove = useDraft((s) => s.remove);
  const n = lineNutrition(line);
  const name = line.kind === "catalogue" ? line.food.name : line.name;
  const heardDifferently = line.heardAs && line.heardAs.toLowerCase() !== name.toLowerCase();

  return (
    <Card>
      <View style={styles.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={font.h2}>{name}</Text>
          {heardDifferently ? <Text style={font.small}>Kimbo heard "{line.heardAs}"</Text> : null}
          {line.kind === "estimate" ? <Text style={styles.estimate}>Estimate — not in Kimbo's food list yet</Text> : null}
        </View>
        <Pressable accessibilityLabel={`Remove ${name}`} onPress={() => remove(line.key)} hitSlop={10}>
          <Text style={styles.remove}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.itemRow}>
        {line.unit === "g" ? (
          <Stepper value={line.quantity} step={25} min={5} max={2000} onChange={(quantity) => update(line.key, { quantity })} />
        ) : (
          <Stepper value={line.quantity} onChange={(quantity) => update(line.key, { quantity })} />
        )}
        <Text style={[font.body, { fontWeight: "700" }]}>{n.calories} kcal</Text>
      </View>

      {line.kind === "catalogue" ? (
        <View style={styles.chips}>
          {line.food.units.map((u) => (
            <Chip
              key={u.unit}
              label={u.label}
              selected={line.unit === u.unit}
              onPress={() =>
                // Switching between grams and household units resets to a sensible amount.
                update(line.key, {
                  unit: u.unit,
                  ...(u.unit === "g" && line.unit !== "g" ? { quantity: 100 } : {}),
                  ...(u.unit !== "g" && line.unit === "g" ? { quantity: 1 } : {}),
                })
              }
            />
          ))}
        </View>
      ) : (
        <View style={styles.itemRow}>
          <Text style={font.small}>kcal per {line.unit}</Text>
          <TextInput
            keyboardType="numeric"
            defaultValue={String(Math.round(line.perUnit.calories))}
            onEndEditing={(e) => {
              const v = Number(e.nativeEvent.text);
              if (v > 0) update(line.key, { perUnitCalories: v });
            }}
            style={styles.kcalInput}
          />
        </View>
      )}
      <Text style={styles.swap} onPress={onSwap}>
        Not {formatQty(line.quantity)} × {name}? Swap it
      </Text>
    </Card>
  );
}

function formatTime(d: Date): string {
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString([], { weekday: "short" })}, ${time}`;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  itemTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  remove: { fontSize: 18, color: colors.muted, padding: space.xs },
  estimate: { fontSize: 12, color: colors.calm, marginTop: 2 },
  swap: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  kcalInput: {
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.sm,
    textAlign: "right",
    color: colors.text,
  },
  error: { color: colors.calm, textAlign: "center" },
});
