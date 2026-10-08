import type { Diet, FoodTag, HealthScore, MacroTargets, Nutrition } from "@kimbo/shared";
import type { StoredMeal } from "../repo/meals.js";
import { sumNutrition } from "./catalogue.js";

const PROCESSED: FoodTag[] = ["fried", "refined_carb", "high_sugar"];

const PROTEIN_TIP: Record<Diet, string> = {
  vegetarian: "A katori of dal or some paneer would lift it.",
  jain: "A katori of moong dal or some paneer would lift it.",
  vegan: "A katori of dal or chana would lift it.",
  eggetarian: "Dal, paneer or a couple of eggs would lift it.",
  non_vegetarian: "Dal, eggs or some chicken would lift it.",
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Today's health score out of 10, by Kimbo's rules: fibre, protein, saturated fat kept in check
 * and how processed the food was, a quarter each. Fibre, protein and sat fat are judged against
 * the share of the day eaten so far, so a light breakfast isn't a failed day.
 */
export function healthScore(meals: StoredMeal[], targets: MacroTargets | null, diet: Diet | null): HealthScore {
  const items = meals.flatMap((m) => m.items);
  if (!items.length || !targets) {
    return {
      score: null,
      status: "Not evaluated",
      line: targets
        ? "Log a meal and Kimbo scores your day out of 10: fibre, protein, saturated fat and how processed it is."
        : "Set a goal and Kimbo can score your day.",
      parts: [],
    };
  }
  const n: Nutrition = sumNutrition(meals.map((m) => m.totals));
  const share = Math.max(0.25, Math.min(1, n.calories / targets.calories));
  const satRatio = n.satFat / (targets.satFat * share);
  const processed = items.filter((i) => i.tags.some((t) => PROCESSED.includes(t))).length;

  const parts = {
    fibre: clamp(n.fibre / (targets.fibre * share)),
    protein: clamp(n.protein / (targets.protein * share)),
    satFat: satRatio <= 1 ? 1 : clamp(2 - satRatio),
    processed: 1 - processed / items.length,
  };
  const score = Math.round((parts.fibre + parts.protein + parts.satFat + parts.processed) * 2.5);
  const status = score >= 8 ? "Great day" : score >= 6 ? "Good" : score >= 4 ? "Could be better" : "Needs some love";

  const weakest = (Object.keys(parts) as (keyof typeof parts)[]).reduce((a, b) => (parts[b] < parts[a] ? b : a));
  const line =
    parts[weakest] >= 0.8
      ? "Balanced and wholesome so far."
      : {
          fibre: "Add dal, sabzi, salad or fruit to lift it.",
          protein: PROTEIN_TIP[diet ?? "vegetarian"],
          satFat: "Go easy on ghee, butter and fried snacks for the rest of today.",
          processed: "Fewer fried, refined or sugary bites would lift it.",
        }[weakest];

  const rate = (v: number): "good" | "ok" | "low" => (v >= 0.8 ? "good" : v >= 0.5 ? "ok" : "low");
  return {
    score,
    status,
    line,
    parts: [
      { key: "fibre", label: "Fibre", value: `${Math.round(n.fibre)}g`, status: rate(parts.fibre) },
      { key: "protein", label: "Protein", value: `${Math.round(n.protein)}g`, status: rate(parts.protein) },
      { key: "satFat", label: "Saturated fat", value: `${Math.round(n.satFat)}g`, status: rate(parts.satFat) },
      {
        key: "processed",
        label: "Processed food",
        value: processed === 0 ? "None" : processed / items.length <= 0.25 ? "A little" : "A lot",
        status: rate(parts.processed),
      },
    ],
  };
}
