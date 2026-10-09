import type { MealType } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Chip, Icon, Notice, Ring, Screen, Segmented, Sheet, Stepper, T, formatQty } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { draftTotals, lineNutrition, toConfirmItems, useDraft, type DraftLine } from "@/lib/draft";
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
  const report = useQuery({ queryKey: ["reportInsights"], queryFn: api.reportInsights, staleTime: 60_000 });
  const afterWrite = useAfterWrite();
  const [editing, setEditing] = useState<string | null>(null);
  const totals = draftTotals(draft.lines);
  const editingLine = draft.lines.find((l) => l.key === editing) ?? null;
  const insight = report.data?.insights;
  const risky = insight?.cutBackOn.find((item) => draft.lines.some((line) => lineName(line).toLowerCase().includes(item.name.toLowerCase())));
  const recommendation = insight?.helpers[0] ?? null;
  const itemNames = draft.lines.map(lineName);
  const mealAdvice = useQuery({
    queryKey: ["mealAdvice", itemNames.join("|"), insight?.focus.key],
    queryFn: () => api.ask({ text: `What goes well with these foods in my meal: ${itemNames.join(", ")}? Suggest one simple addition that supports my goals${insight?.focus ? ` and my ${insight.focus.title.toLowerCase()} focus` : ""}. Keep it to one short sentence.` }),
    enabled: itemNames.length > 0,
    staleTime: 60_000,
  });
  const addRecommendation = async () => {
    if (!recommendation) return;
    const { foods } = await api.searchFoods(recommendation);
    if (foods[0]) useDraft.getState().addFood(foods[0]);
  };
  const isAiDraft = !draft.mealId && (draft.source === "photo" || draft.source === "text" || draft.source === "voice");
  const isManualDraft = !draft.mealId && draft.source === "manual";
  const [keep, setKeep] = useState(false);
  const [keepName, setKeepName] = useState("");
  // Saved once per screen, so retrying a failed meal save doesn't duplicate it in My meals.
  const kept = useRef(false);

  const save = useMutation({
    mutationFn: async () => {
      const items = toConfirmItems(draft.lines);
      if (keep && !kept.current) {
        await api.saveMeal({ name: keepName.trim() || defaultName(draft.lines), items });
        kept.current = true;
      }
      const body = {
        mealType: draft.mealType,
        source: draft.source,
        eatenAt: draft.eatenAt.toISOString(),
        // Only an AI suggestion can be "corrected"; manual logs and edits aren't corrections.
        wasCorrected: draft.touched && isAiDraft,
        items,
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
    router.push({ pathname: "/food-search", params: replaceKey ? { replaceKey } : {} });
  };

  return (
    <Screen
      back
      title={draft.mealId ? "Edit meal" : isManualDraft ? "Create Meal" : "Check your meal"}
      footer={
        <View style={styles.footer}>
          {!isManualDraft ? <View style={{ flex: 1 }}>
            <T variant="number" style={{ fontSize: 24, lineHeight: 28 }}>{totals.calories} <T variant="label">kcal</T></T>
            <T variant="caption">P {totals.protein} · C {totals.carbs} · F {totals.fat} · Fibre {totals.fibre} g</T>
          </View> : null}
          <View style={isManualDraft ? { flex: 1 } : { minWidth: 150 }}>
            <Button
              label={draft.mealId ? "Save changes" : isManualDraft ? "Create Meal" : `Save ${draft.mealType}`}
              disabled={!draft.lines.length}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
        </View>
      }
    >
      {draft.lines.length > 0 && (risky || recommendation || mealAdvice.data?.reply.text) ? (
        <View style={[styles.guidance, risky ? styles.guidanceWarn : styles.guidanceGood]}>
          <Kimbo mood={risky ? "focus" : "proud"} size={34} />
          <T variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
            {risky ? `${risky.name} may work against your ${insight?.focus.title.toLowerCase() ?? "report focus"}.` : mealAdvice.data?.reply.text ?? `Kimbo suggests ${recommendation} to support today’s goal.`}
          </T>
          {recommendation ? <Pressable accessibilityRole="button" onPress={addRecommendation}><T variant="label" tone="leaf">Add</T></Pressable> : null}
        </View>
      ) : null}
      {!isManualDraft && draft.lines.length ? (
        <View style={styles.note}>
          <Kimbo mood={draft.mealId ? "idle" : "happy"} size={44} />
          <T variant="label" style={{ flex: 1 }}>
            {draft.mealId
              ? "Tap an item to change it."
              : isAiDraft
                ? "Tap a dish to fix its portion. Nothing is saved yet."
                : "Tap an item to set the portion."}
          </T>
        </View>
      ) : !isManualDraft ? (
          <Notice mood="idle" title={isManualDraft ? "Meal Items" : "What's on the plate?"} message={isManualDraft ? "Add items to this meal." : "Search Kimbo's list of Indian dishes."} />
      ) : null}

      {isManualDraft ? (
        <View style={styles.createSummary}>
          <View style={styles.nameCard}>
            <TextInput
              value={keepName}
              onChangeText={setKeepName}
              placeholder="Tap to name"
              placeholderTextColor={colors.inkSoft}
              style={styles.nameInput}
              accessibilityLabel="Meal name"
            />
            <Icon name="edit-2" size={20} color={colors.inkSoft} />
          </View>
          <View style={styles.calorieCard}>
            <View style={{ flex: 1, gap: space.xs }}>
              <T variant="label" tone="soft">Calories</T>
              <T variant="number" style={{ fontSize: 38 }}>{totals.calories}</T>
            </View>
            <Ring value={totals.calories} max={2000} size={86} stroke={8} color={colors.leaf}>
              <Icon name="zap" size={24} color={colors.leafDeep} />
            </Ring>
          </View>
          <View style={styles.macroRow}>
            <Macro label="Protein" value={`${totals.protein}g`} />
            <Macro label="Carbs" value={`${totals.carbs}g`} />
            <Macro label="Fats" value={`${totals.fat}g`} />
          </View>
        </View>
      ) : null}

      {isManualDraft ? <T variant="heading">Meal Items</T> : null}
      <View style={styles.list}>
        {draft.lines.map((line, i) => (
          <ItemRow key={line.key} line={line} first={i === 0} onPress={() => setEditing(line.key)} onRemove={() => draft.remove(line.key)} />
        ))}
        <Pressable accessibilityRole="button" onPress={() => openSearch(null)} style={styles.addRow}>
          <Icon name="plus-circle" size={20} color={colors.leaf} />
          <T variant="bodyStrong" tone="leaf">
            {isManualDraft ? "Add items to this meal" : "Add a dish"}
          </T>
        </Pressable>
      </View>

      {!isManualDraft ? <View style={{ gap: space.sm }}>
        <T variant="label">Meal</T>
        <Segmented<MealType> options={MEAL_OPTIONS} value={draft.mealType} onChange={draft.setMealType} />
      </View> : null}
      {!isManualDraft ? <View style={styles.timeRow}>
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
      </View> : null}

      {!isManualDraft ? <View style={styles.keep}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: keep }}
          onPress={() => setKeep((k) => !k)}
          style={styles.keepRow}
        >
          <Icon name={keep ? "check-square" : "square"} size={20} color={keep ? colors.leaf : colors.inkSoft} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Save to Saved foods</T>
            <T variant="caption">Log it again in one tap next time.</T>
          </View>
          <Icon name="bookmark" size={18} color={colors.inkFaint} />
        </Pressable>
        {keep ? (
          <TextInput
            value={keepName}
            onChangeText={setKeepName}
            placeholder={defaultName(draft.lines) || "Name this meal"}
            placeholderTextColor={colors.inkFaint}
            maxLength={40}
            style={styles.keepInput}
            accessibilityLabel="Name for this saved meal"
          />
        ) : null}
      </View> : null}

      {save.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(save.error)}
        </T>
      ) : null}
      {draft.mealId ? (
        <Button label="Delete this meal" kind="danger" loading={remove.isPending} onPress={() => remove.mutate()} />
      ) : null}

      <Sheet
        visible={!!editingLine}
        onClose={() => setEditing(null)}
        title={editingLine ? lineName(editingLine) : undefined}
        subtitle={editingLine?.kind === "estimate" ? "Rough estimate. Change the kcal if you know it." : undefined}
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

function ItemRow({ line, first, onPress, onRemove }: { line: DraftLine; first: boolean; onPress: () => void; onRemove: () => void }) {
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <Icon name="trash-2" size={18} color={colors.terracotta} />
      </Pressable>
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
        <Button label="Swap dish" kind="secondary" compact onPress={onSwap} />
        <Button
          label="Remove"
          kind="danger"
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

function Macro({ label, value }: { label: string; value: string }) {
  return <View style={styles.macro}><T variant="caption" tone="soft">{label}</T><T variant="bodyStrong">{value}</T></View>;
}

/** "Rajma, Steamed rice +1" — a sensible name when the user doesn't type one. */
function defaultName(lines: DraftLine[]): string {
  const names = lines.map(lineName);
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
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
  guidance: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md },
  guidanceWarn: { backgroundColor: colors.plumSoft },
  guidanceGood: { backgroundColor: colors.leafSoft },
  createSummary: { gap: space.sm },
  nameCard: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  nameInput: { flex: 1, fontFamily: fonts.bold, fontSize: 26, color: colors.ink, paddingVertical: space.xs },
  calorieCard: { flexDirection: "row", alignItems: "center", padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space.md },
  macroRow: { flexDirection: "row", gap: space.sm },
  macro: { flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space.xs },
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
  keep: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.md },
  keepRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  keepInput: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  footer: { flexDirection: "row", alignItems: "center", gap: space.lg },
  editorTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  kcalRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  kcalInput: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.lineStrong,
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
