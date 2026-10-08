import type { TodayMeal } from "@kimbo/shared";
import { MEAL_LABEL } from "./format";

/** "Sprouts salad", or "Roti, Dal tadka +1" for a bigger plate. */
export function mealTitle(meal: TodayMeal): string {
  const names = meal.items.map((i) => i.name);
  if (!names.length) return MEAL_LABEL[meal.mealType];
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}
