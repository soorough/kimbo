import {
  scaleNutrition,
  sumNutrition,
  type ConfirmItem,
  type Food,
  type Meal,
  type MealDraft,
  type MealSource,
  type MealType,
  type Nutrition,
  type Unit,
} from "@kimbo/shared";
import { create } from "zustand";

export type DraftLine =
  | { key: string; kind: "catalogue"; food: Food; heardAs: string | null; quantity: number; unit: Unit }
  | {
      key: string;
      kind: "estimate";
      name: string;
      heardAs: string | null;
      quantity: number;
      unit: string;
      perUnit: Nutrition;
    };

interface DraftState {
  mealId: string | null;
  source: MealSource;
  mealType: MealType;
  eatenAt: Date;
  lines: DraftLine[];
  /** true once the user changes anything Kimbo suggested */
  touched: boolean;
  startFromAi: (draft: MealDraft, source: MealSource, mealType?: MealType) => void;
  startManual: (mealType: MealType) => void;
  startEdit: (meal: Meal, foods: Record<string, Food>) => void;
  update: (key: string, patch: Partial<{ quantity: number; unit: Unit; perUnitCalories: number }>) => void;
  remove: (key: string) => void;
  addFood: (food: Food, replaceKey?: string) => void;
  /** A dish Kimbo doesn't know yet: an editable estimate the user prices themselves. */
  addEstimate: (name: string, replaceKey?: string) => void;
  setMealType: (t: MealType) => void;
  shiftTime: (minutes: number) => void;
}

/** Exact nutrition for one unit (no rounding), so re-scaling never drifts. */
function perOne(n: Nutrition, quantity: number): Nutrition {
  return {
    calories: n.calories / quantity,
    protein: n.protein / quantity,
    carbs: n.carbs / quantity,
    fat: n.fat / quantity,
    fibre: n.fibre / quantity,
    satFat: n.satFat / quantity,
  };
}

/** Starting point for a user-added dish; mirrors the API's unknown-dish placeholder. */
const ESTIMATE_PER_SERVING: Nutrition = { calories: 250, protein: 8, carbs: 30, fat: 10, fibre: 3, satFat: 3 };

let seq = 0;
const nextKey = () => `line-${++seq}`;

export const useDraft = create<DraftState>((set) => ({
  mealId: null,
  source: "text",
  mealType: "lunch",
  eatenAt: new Date(),
  lines: [],
  touched: false,
  startFromAi: (draft, source, mealType) =>
    set({
      mealId: null,
      source,
      mealType: mealType ?? draft.suggestedMealType,
      eatenAt: new Date(),
      touched: false,
      lines: draft.items.map((item) =>
        item.kind === "catalogue"
          ? {
              key: nextKey(),
              kind: "catalogue",
              food: item.food,
              heardAs: item.heardAs,
              quantity: item.quantity,
              unit: item.unit,
            }
          : {
              key: nextKey(),
              kind: "estimate",
              name: item.name,
              heardAs: item.heardAs,
              quantity: item.quantity,
              unit: item.unit,
              perUnit: perOne(item.nutrition, item.quantity),
            },
      ),
    }),
  startManual: (mealType) =>
    set({ mealId: null, source: "manual", mealType, eatenAt: new Date(), touched: false, lines: [] }),
  startEdit: (meal, foods) =>
    set({
      mealId: meal.id,
      source: meal.source,
      mealType: meal.mealType,
      eatenAt: new Date(meal.eatenAt),
      touched: false,
      lines: meal.items.map((i) => {
        const food = i.foodId ? foods[i.foodId] : undefined;
        return food
          ? {
              key: nextKey(),
              kind: "catalogue" as const,
              food,
              heardAs: null,
              quantity: i.quantity,
              unit: i.unit as Unit,
            }
          : {
              key: nextKey(),
              kind: "estimate" as const,
              name: i.name,
              heardAs: null,
              quantity: i.quantity,
              unit: i.unit,
              perUnit: perOne(i.nutrition, i.quantity),
            };
      }),
    }),
  update: (key, patch) =>
    set((s) => ({
      touched: true,
      lines: s.lines.map((l) => {
        if (l.key !== key) return l;
        if (l.kind === "catalogue") return { ...l, quantity: patch.quantity ?? l.quantity, unit: patch.unit ?? l.unit };
        const perUnit =
          patch.perUnitCalories !== undefined && l.perUnit.calories > 0
            ? perOne(l.perUnit, l.perUnit.calories / patch.perUnitCalories)
            : l.perUnit;
        return { ...l, quantity: patch.quantity ?? l.quantity, perUnit };
      }),
    })),
  remove: (key) => set((s) => ({ touched: true, lines: s.lines.filter((l) => l.key !== key) })),
  addFood: (food, replaceKey) =>
    set((s) => {
      const line: DraftLine = {
        key: nextKey(),
        kind: "catalogue",
        food,
        heardAs: null,
        quantity: 1,
        unit: food.defaultUnit,
      };
      return {
        touched: true,
        lines: replaceKey ? s.lines.map((l) => (l.key === replaceKey ? line : l)) : [...s.lines, line],
      };
    }),
  addEstimate: (name, replaceKey) =>
    set((s) => {
      const line: DraftLine = {
        key: nextKey(),
        kind: "estimate",
        name,
        heardAs: null,
        quantity: 1,
        unit: "serving",
        perUnit: { ...ESTIMATE_PER_SERVING },
      };
      return {
        touched: true,
        lines: replaceKey ? s.lines.map((l) => (l.key === replaceKey ? line : l)) : [...s.lines, line],
      };
    }),
  setMealType: (mealType) => set({ mealType }),
  shiftTime: (minutes) =>
    set((s) => {
      const next = new Date(s.eatenAt.getTime() + minutes * 60_000);
      return { eatenAt: next > new Date() ? new Date() : next };
    }),
}));

export function lineNutrition(line: DraftLine): Nutrition {
  if (line.kind === "estimate") return scaleNutrition(line.perUnit, line.quantity);
  const option = line.food.units.find((u) => u.unit === line.unit) ?? line.food.units[0]!;
  return scaleNutrition(option.perUnit, line.quantity);
}

export function draftTotals(lines: DraftLine[]): Nutrition {
  return sumNutrition(lines.map(lineNutrition));
}

export function toConfirmItems(lines: DraftLine[]): ConfirmItem[] {
  return lines.map((l) =>
    l.kind === "catalogue"
      ? { kind: "catalogue", foodId: l.food.id, quantity: l.quantity, unit: l.unit }
      : { kind: "estimate", name: l.name, quantity: l.quantity, unit: l.unit, nutrition: lineNutrition(l) },
  );
}

/** Where the food-search screen should put the chosen food. */
export const useFoodPicker = create<{ replaceKey: string | null; setReplaceKey: (k: string | null) => void }>(
  (set) => ({
    replaceKey: null,
    setReplaceKey: (replaceKey) => set({ replaceKey }),
  }),
);
