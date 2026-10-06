import type { Nutrition } from "./index";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Kimbo's single rounding rule: whole kcal, 0.1 g for everything else. */
export function roundNutrition(n: Nutrition): Nutrition {
  return {
    calories: Math.round(n.calories),
    protein: round1(n.protein),
    carbs: round1(n.carbs),
    fat: round1(n.fat),
    fibre: round1(n.fibre),
    satFat: round1(n.satFat),
  };
}

/** quantity × per-unit nutrition — used by the API when saving and by the app while editing. */
export function scaleNutrition(perUnit: Nutrition, quantity: number): Nutrition {
  return roundNutrition({
    calories: perUnit.calories * quantity,
    protein: perUnit.protein * quantity,
    carbs: perUnit.carbs * quantity,
    fat: perUnit.fat * quantity,
    fibre: perUnit.fibre * quantity,
    satFat: perUnit.satFat * quantity,
  });
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  return roundNutrition(
    items.reduce(
      (acc, n) => ({
        calories: acc.calories + n.calories,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
        fibre: acc.fibre + n.fibre,
        satFat: acc.satFat + n.satFat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, satFat: 0 },
    ),
  );
}
