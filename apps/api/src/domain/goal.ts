import type { Goal, GoalRequest, MacroTargets } from "@kimbo/shared";
import {
  ACTIVITY_MULTIPLIERS,
  FIBRE_TARGET_G,
  GOAL_ADJUSTMENT_KCAL,
  MACRO_SPLIT,
  TARGET_BOUNDS_KCAL,
  TARGET_ROUNDING_KCAL,
} from "./config.js";

const SEX_CONSTANT = { male: 5, female: -161, other: -78 } as const;

export function computeTarget(input: Omit<GoalRequest, "targetOverride">): { target: number; explanation: string[] } {
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + SEX_CONSTANT[input.sex];
  const activity = ACTIVITY_MULTIPLIERS[input.activity];
  const maintenance = bmr * activity.factor;
  const adjustment = GOAL_ADJUSTMENT_KCAL[input.goal];
  const raw = maintenance + adjustment;
  const rounded = Math.round(raw / TARGET_ROUNDING_KCAL) * TARGET_ROUNDING_KCAL;
  const target = Math.min(TARGET_BOUNDS_KCAL.max, Math.max(TARGET_BOUNDS_KCAL.min, rounded));

  const explanation = [
    `Your body uses about ${Math.round(bmr)} kcal a day at rest (Mifflin–St Jeor formula, from your age, sex, height and weight).`,
    `Being ${activity.label} multiplies that by ${activity.factor}, so you burn about ${Math.round(maintenance)} kcal a day.`,
  ];
  if (adjustment < 0) explanation.push(`To lose weight gently, Kimbo subtracts ${-adjustment} kcal.`);
  if (adjustment > 0) explanation.push(`To gain weight steadily, Kimbo adds ${adjustment} kcal.`);
  if (target !== rounded) {
    explanation.push(`Kimbo keeps targets between ${TARGET_BOUNDS_KCAL.min} and ${TARGET_BOUNDS_KCAL.max} kcal, so yours is set to ${target}.`);
  }
  explanation.push("This is an estimate — you can adjust it anytime.");
  return { target, explanation };
}

export function macroTargets(calories: number): MacroTargets {
  return {
    calories,
    protein: Math.round((calories * MACRO_SPLIT.protein) / 4),
    carbs: Math.round((calories * MACRO_SPLIT.carbs) / 4),
    fat: Math.round((calories * MACRO_SPLIT.fat) / 9),
    fibre: FIBRE_TARGET_G,
  };
}

export function isTargetInBounds(target: number): boolean {
  return target >= TARGET_BOUNDS_KCAL.min && target <= TARGET_BOUNDS_KCAL.max;
}

export function buildGoal(input: Omit<GoalRequest, "targetOverride">, targetOverride: number | null): Goal {
  const { target, explanation } = computeTarget(input);
  const effectiveTarget = targetOverride ?? target;
  return {
    ...input,
    computedTarget: target,
    targetOverride,
    effectiveTarget,
    explanation,
    targets: macroTargets(effectiveTarget),
  };
}
