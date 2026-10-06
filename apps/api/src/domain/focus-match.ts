import type { FocusKey, FocusResult } from "@kimbo/shared";
import type { StoredMeal } from "../repo/meals.js";
import { FOCUS_MATCH as T } from "./config.js";

/**
 * Deterministic meal → focus check. Reasons describe the meal, never judge it.
 */
export function mealSupportsFocus(meal: StoredMeal, focus: FocusKey): FocusResult {
  const has = (tag: string) => meal.items.filter((i) => i.tags.includes(tag as never));
  const fibreRich = has("fibre_rich");
  const sweet = has("high_sugar");
  const fried = has("fried");
  const refined = has("refined_carb");
  const leanProtein = has("lean_protein");
  const richSatFat = has("high_sat_fat");
  const { fibre, protein, satFat } = meal.totals;
  const names = (items: { name: string }[]) => joinNames(items.map((i) => i.name));

  const result = (supports: boolean, reason: string): FocusResult => ({ focus, supports, reason });

  switch (focus) {
    case "fibre_focus": {
      const fibreOk = fibre >= T.fibreRichMealG || fibreRich.length > 0;
      const satHeavy = richSatFat.length > 0 && satFat >= T.satFatHeavyMealG;
      if (fibreOk && !satHeavy) {
        return result(true, fibreRich.length ? `Fibre from ${names(fibreRich)} (${fibre} g)` : `${fibre} g of fibre`);
      }
      if (satHeavy) return result(false, `${satFat} g saturated fat, mostly from ${names(richSatFat)}`);
      return result(false, `Only ${fibre} g fibre`);
    }
    case "steady_carbs": {
      if (sweet.length) return result(false, `Includes something sweet (${names(sweet)})`);
      const paired = fibreRich.length > 0 || leanProtein.length > 0 || protein >= T.proteinPairedG;
      return paired
        ? result(true, `Carbs paired with ${names([...fibreRich, ...leanProtein]) || `${protein} g protein`}`)
        : result(false, "Mostly carbs. Dal, sabzi or egg would balance it");
    }
    case "less_sugar_refined": {
      if (sweet.length) return result(false, `Includes something sweet (${names(sweet)})`);
      if (fried.length) return result(false, `Includes something fried (${names(fried)})`);
      if (refined.length && !fibreRich.length) return result(false, `Mostly refined carbs (${names(refined)})`);
      return result(true, fibreRich.length ? `Built around ${names(fibreRich)}` : "No added sugar or refined carbs");
    }
    case "balanced_plate": {
      const proteinOk = protein >= T.balancedProteinG || leanProtein.length > 0;
      const fibreOk = fibre >= T.balancedFibreG || fibreRich.length > 0;
      if (proteinOk && fibreOk) return result(true, `Protein and fibre on one plate (${protein} g / ${fibre} g)`);
      return result(false, proteinOk ? "Could use some vegetables or dal" : "Could use some protein");
    }
  }
}

function joinNames(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.toLowerCase()))];
  if (unique.length <= 1) return unique[0] ?? "";
  return `${unique.slice(0, -1).join(", ")} and ${unique.at(-1)}`;
}

const SHORT_NAMES: Record<FocusKey, string> = {
  fibre_focus: "fibre",
  steady_carbs: "steady-carbs",
  less_sugar_refined: "less-sugar",
  balanced_plate: "balanced-plate",
};

export function supportedMessage(focus: FocusKey): string {
  return `That helped today's ${SHORT_NAMES[focus]} focus ↑`;
}
