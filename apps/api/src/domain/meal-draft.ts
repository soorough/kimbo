import type { DraftItem, MealDraft, MealType } from "@kimbo/shared";
import type { RecognizedItem } from "../ai/types.js";
import { match, nutritionFor, resolveUnit, scale, sumNutrition, toFood } from "./catalogue.js";
import { UNKNOWN_DISH_PER_SERVING } from "./config.js";

/** Resolves AI candidates against the catalogue. Pure: nothing here is persisted. */
export function buildDraft(candidates: RecognizedItem[], suggestedMealType: MealType): MealDraft {
  const items: DraftItem[] = candidates
    .filter((c) => c.name.trim().length > 0)
    .map((c) => {
      const quantity = c.quantity && c.quantity > 0 ? c.quantity : 1;
      const entry = match(c.name);
      if (entry) {
        const unit = resolveUnit(entry, c.unit);
        return {
          kind: "catalogue",
          food: toFood(entry),
          heardAs: c.name,
          quantity,
          unit,
          nutrition: nutritionFor(entry, quantity, unit),
        };
      }
      return {
        kind: "estimate",
        heardAs: c.name,
        name: capitalise(c.name.trim()),
        quantity,
        unit: "serving",
        nutrition: scale(UNKNOWN_DISH_PER_SERVING, quantity),
      };
    });
  return { items, totals: sumNutrition(items.map((i) => i.nutrition)), suggestedMealType };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
