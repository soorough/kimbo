import { createHash } from "node:crypto";
import type { DraftItem, MealType, RecentMeal, Unit } from "@kimbo/shared";
import type { StoredItem, StoredMeal } from "../repo/meals.js";
import { getEntry, gramsPerUnit, nutritionFor, sumNutrition, toFood } from "./catalogue.js";

export const RECENT_LOOKBACK_DAYS = 60;
const MAX_RECENT = 6;
const MAX_NAMES_IN_LABEL = 3;

/** Same dishes in the same portions are the same meal, whatever order they were logged in. */
export function mealKey(meal: StoredMeal): string {
  const signature = meal.items
    .map((i) => `${i.foodId ?? `est:${i.name.trim().toLowerCase()}`}@${i.quantity}${i.unit}`)
    .sort()
    .join("|");
  return createHash("sha1").update(signature).digest("base64url").slice(0, 16);
}

/**
 * Distinct past meals for quick add, most often logged first (newest breaks ties).
 * Meals the user removed are left out; saving one again clears that (see the meal routes).
 */
export function recentMeals(meals: StoredMeal[], hidden: Set<string>, suggestedMealType: MealType): RecentMeal[] {
  const groups = new Map<string, { latest: StoredMeal; count: number }>();
  for (const meal of meals) {
    const key = mealKey(meal);
    const g = groups.get(key);
    if (!g) groups.set(key, { latest: meal, count: 1 });
    else {
      g.count++;
      if (meal.eatenAt > g.latest.eatenAt) g.latest = meal;
    }
  }
  return [...groups.entries()]
    .filter(([key]) => !hidden.has(key))
    .sort(([, a], [, b]) => b.count - a.count || b.latest.eatenAt.localeCompare(a.latest.eatenAt))
    .slice(0, MAX_RECENT)
    .map(([key, g]) => {
      const items = g.latest.items.map(toDraftItem);
      const totals = sumNutrition(items.map((i) => i.nutrition));
      return {
        key,
        label: label(items.map((i) => (i.kind === "catalogue" ? i.food.name : i.name))),
        calories: Math.round(totals.calories),
        timesLogged: g.count,
        draft: { items, totals, suggestedMealType },
      };
    });
}

/** Catalogue dishes are re-resolved so a quick add uses today's catalogue values. */
export function toDraftItem(item: StoredItem): DraftItem {
  const entry = item.foodId ? getEntry(item.foodId) : null;
  if (entry && gramsPerUnit(entry, item.unit as Unit) !== null) {
    const unit = item.unit as Unit;
    return {
      kind: "catalogue",
      food: toFood(entry),
      heardAs: entry.name,
      quantity: item.quantity,
      unit,
      nutrition: nutritionFor(entry, item.quantity, unit),
    };
  }
  return {
    kind: "estimate",
    heardAs: item.name,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    nutrition: item.nutrition,
  };
}

function label(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES_IN_LABEL).join(", ");
  const more = names.length - MAX_NAMES_IN_LABEL;
  return more > 0 ? `${shown} +${more}` : shown;
}
