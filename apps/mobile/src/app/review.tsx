import type { MealType } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Chip, Icon, Notice, Screen, Segmented, Sheet, Stepper, T, formatQty } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { draftTotals, lineNutrition, toConfirmItems, useDraft, useFoodPicker, type DraftLine } from "@/lib/draft";
import { MEAL_LABEL, MEAL_ORDER } from "@/lib/format";
import { useAfterWrite } from "@/lib/mutations";
import { colors, fonts, radius, space } from "@/lib/theme";

const MEAL_OPTIONS = MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABEL[m] }));

/**
 * The confirmation step every AI result passes through. Items read as a short list;
 * editing one opens a sheet so the list stays scannable and the total stays visible.
 */
export default function Review() {
  const draft = useDraft();
  const setReplaceKey = useFoodPicker((s) => s.setReplaceKey);
  const afterWrite = useAfterWrite();
  const [editing, setEditing] = useState<string | null>(null);
  const totals = draftTotals(draft.lines);
  const editingLine = draft.lines.find((l) => l.key === editing) ?? null;
  const isAiDraft = !draft.mealId && (draft.source === "photo" || draft.source === "text");

  const save = useMutation({
    mutationFn: () => {
      const body = {
        mealType: draft.mealType,
        source: draft.source,
        eatenAt: draft.eatenAt.toISOString(),
        // Only an AI suggestion can be "corrected"; manual logs and edits aren't corrections.
        wasCorrected: draft.touched && isAiDraft,
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
    setEditing(null);
    setReplaceKey(replaceKey);
    router.push("/food-search");
  };

  return (
    <Screen
      back
      title={draft.mealId ? "Edit meal" : "Check your meal"}
      footer={
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <T variant="number" style={{ fontSize: 24, lineHeight: 28 }}>
              {totals.calories} <T variant="label">kcal</T>
            </T>
            <T variant="caption">
              P {totals.protein} · C {totals.carbs} · F {totals.fat} · Fibre {totals.fibre} g
            </T>
          </View>
          <View style={{ minWidth: 150 }}>
            <Button
              label={draft.mealId ? "Save changes" : "Save meal"}
              icon="check"
              disabled={!draft.lines.length}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
        </View>
      }
    >
      {draft.lines.length ? (
        <View style={styles.note}>
          <Kimbo mood={draft.mealId ? "idle" : "happy"} size={44} />
          <T variant="label" style={{ flex: 1 }}>
            {draft.mealId
              ? "Tap an item to change it."
              : isAiDraft
                ? "Here's what I found. Tap anything I got wrong — nothing's saved until you do."
                : "Tap an item to set the portion."}
          </T>
        </View>
      ) : (
        <Notice mood="idle" title="What's on the plate?" message="Add each dish from Kimbo's Indian food list." />
      )}

      <View style={styles.list}>
        {draft.lines.map((line, i) => (
          <ItemRow key={line.key} line={line} first={i === 0} onPress={() => setEditing(line.key)} />
        ))}
        <Pressable accessibilityRole="button" onPress={() => openSearch(null)} style={styles.addRow}>
          <Icon name="plus-circle" size={20} color={colors.leaf} />
          <T variant="bodyStrong" tone="leaf">
            {draft.lines.length ? "Add something I missed" : "Add a dish"}
          </T>
        </Pressable>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Meal</T>
        <Segmented<MealType> options={MEAL_OPTIONS} value={draft.mealType} onChange={draft.setMealType} />
      </View>
      <View style={styles.timeRow}>
        <Icon name="clock" size={18} color={colors.inkSoft} />
        <T variant="bodyStrong" style={{ flex: 1 }}>
          {formatTime(draft.eatenAt)}
        </T>
        <Chip label="−30 min" onPress={() => draft.shiftTime(-30)} />
        <Chip
          label="+30 min"
          disabled={Date.now() - draft.eatenAt.getTime() < 60_000}
          onPress={() => draft.shiftTime(30)}
        />
      </View>

      {save.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(save.error)}
        </T>
      ) : null}
      {draft.mealId ? (
        <Button
          label="Delete this meal"
          kind="danger"
          icon="trash-2"
          loading={remove.isPending}
          onPress={() => remove.mutate()}
        />
      ) : null}

      <Sheet
        visible={!!editingLine}
        onClose={() => setEditing(null)}
        title={editingLine ? lineName(editingLine) : undefined}
        subtitle={editingLine?.kind === "estimate" ? "Estimate — adjust the calories if you know them" : undefined}
      >
        {editingLine ? (
          <PortionEditor
            line={editingLine}
            onSwap={() => openSearch(editingLine.key)}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function ItemRow({ line, first, onPress }: { line: DraftLine; first: boolean; onPress: () => void }) {
  const n = lineNutrition(line);
  const name = lineName(line);
  const heardDifferently = line.heardAs && line.heardAs.toLowerCase() !== name.toLowerCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${portionLabel(line)}, ${n.calories} kilocalories. Edit`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && { backgroundColor: colors.sunk }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <T variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </T>
          {line.kind === "estimate" ? (
            <View style={styles.estimate}>
              <T variant="caption" tone="plum">
                estimate
              </T>
            </View>
          ) : null}
        </View>
        <T variant="label">{portionLabel(line)}</T>
        {heardDifferently ? <T variant="caption">You said "{line.heardAs}"</T> : null}
      </View>
      <T variant="bodyStrong">{n.calories} kcal</T>
      <Icon name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

function PortionEditor({ line, onSwap, onDone }: { line: DraftLine; onSwap: () => void; onDone: () => void }) {
  const update = useDraft((s) => s.update);
  const remove = useDraft((s) => s.remove);
  const n = lineNutrition(line);
  const grams = line.kind === "catalogue" && line.unit === "g";

  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.editorTop}>
        {grams ? (
          <Stepper
            label="Grams"
            value={line.quantity}
            step={25}
            min={5}
            max={2000}
            onChange={(quantity) => update(line.key, { quantity })}
          />
        ) : (
          <Stepper label="Portions" value={line.quantity} onChange={(quantity) => update(line.key, { quantity })} />
        )}
        <View style={{ alignItems: "flex-end" }}>
          <T variant="number">{n.calories}</T>
          <T variant="caption">kcal</T>
        </View>
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
        <View style={styles.kcalRow}>
          <T variant="body" style={{ flex: 1 }}>
            kcal per {line.unit}
          </T>
          <TextInput
            keyboardType="numeric"
            defaultValue={String(Math.round(line.perUnit.calories))}
            onEndEditing={(e) => {
              const v = Number(e.nativeEvent.text);
              if (v > 0) update(line.key, { perUnitCalories: v });
            }}
            style={styles.kcalInput}
            accessibilityLabel={`Calories per ${line.unit}`}
          />
        </View>
      )}

      <T variant="caption">
        Protein {n.protein} g · Carbs {n.carbs} g · Fat {n.fat} g · Fibre {n.fibre} g
      </T>

      <View style={styles.editorActions}>
        <Button label="Swap dish" kind="secondary" icon="repeat" compact onPress={onSwap} />
        <Button
          label="Remove"
          kind="danger"
          icon="trash-2"
          compact
          onPress={() => {
            onDone();
            remove(line.key);
          }}
        />
        <View style={{ flex: 1 }} />
        <Button label="Done" compact onPress={onDone} />
      </View>
    </View>
  );
}

function lineName(line: DraftLine): string {
  return line.kind === "catalogue" ? line.food.name : line.name;
}

function portionLabel(line: DraftLine): string {
  if (line.kind === "estimate") return `${formatQty(line.quantity)} ${line.unit}`;
  const option = line.food.units.find((u) => u.unit === line.unit);
  return line.unit === "g"
    ? `${formatQty(line.quantity)} g`
    : `${formatQty(line.quantity)} × ${option?.label ?? line.unit}`;
}

function formatTime(d: Date): string {
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString([], { weekday: "short" })}, ${time}`;
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "center", gap: space.md },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  estimate: { backgroundColor: colors.plumSoft, borderRadius: radius.pill, paddingHorizontal: space.sm },
  timeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  footer: { flexDirection: "row", alignItems: "center", gap: space.lg },
  editorTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  kcalRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  kcalInput: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: space.sm,
    textAlign: "right",
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  editorActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
