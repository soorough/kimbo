import { MealType } from "@kimbo/shared";

export const MEAL_ORDER = MealType.options;

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};

export function mealTypeForNow(now = new Date()): MealType {
  const h = now.getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner";
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function isMealType(v: unknown): v is MealType {
  return typeof v === "string" && (MEAL_ORDER as readonly string[]).includes(v);
}
