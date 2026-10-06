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

/** Today's headline asks about the next meal still to log, which is what the screen is for. */
export function nextMealPrompt(logged: MealType[], now = new Date()): string {
  const order = MEAL_ORDER.slice(MEAL_ORDER.indexOf(mealTypeForNow(now)));
  const next = order.find((m) => !logged.includes(m));
  return next ? NEXT_MEAL_PROMPT[next] : "All meals logged";
}

const NEXT_MEAL_PROMPT: Record<MealType, string> = {
  breakfast: "What's for breakfast?",
  lunch: "What's for lunch?",
  snack: "Chai time?",
  dinner: "What's for dinner?",
};

export function isMealType(v: unknown): v is MealType {
  return typeof v === "string" && (MEAL_ORDER as readonly string[]).includes(v);
}
