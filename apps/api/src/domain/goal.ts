import type { Goal, GoalRequest, MacroTargets } from "@kimbo/shared";
import {
  ACTIVITY_MULTIPLIERS,
  FIBRE_TARGET_G,
  GOAL_ADJUSTMENT_KCAL,
  MACRO_SPLIT,
  TARGET_BOUNDS_KCAL,
  KCAL_PER_KG,
  TARGET_ROUNDING_KCAL,
} from "./config.js";

const SEX_CONSTANT = { male: 5, female: -161, other: -78 } as const;

export interface TargetCalculation {
  target: number;
  explanation: string[];
  breakdown: Goal["breakdown"];
}

export function computeTarget(input: Omit<GoalRequest, "targetOverride">): TargetCalculation {
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + SEX_CONSTANT[input.sex];
  const activity = ACTIVITY_MULTIPLIERS[input.activity];
  const maintenance = bmr * activity.factor;
  const adjustment = GOAL_ADJUSTMENT_KCAL[input.goal];
  const raw = maintenance + adjustment;
  const rounded = Math.round(raw / TARGET_ROUNDING_KCAL) * TARGET_ROUNDING_KCAL;
  const target = Math.min(TARGET_BOUNDS_KCAL.max, Math.max(TARGET_BOUNDS_KCAL.min, rounded));

  const explanation = [
    `At rest your body uses about ${Math.round(bmr)} kcal a day (Mifflin-St Jeor formula).`,
    `Your activity multiplies that by ${activity.factor}, to about ${Math.round(maintenance)} kcal a day.`,
  ];
  if (adjustment < 0) explanation.push(`To lose weight, Kimbo takes off ${-adjustment} kcal.`);
  if (adjustment > 0) explanation.push(`To gain weight, Kimbo adds ${adjustment} kcal.`);
  if (target !== rounded) {
    explanation.push(
      `Targets stay between ${TARGET_BOUNDS_KCAL.min} and ${TARGET_BOUNDS_KCAL.max} kcal, so yours is ${target}.`,
    );
  }
  explanation.push("It's an estimate. You can change it any time.");
  const breakdown = {
    bmr: Math.round(bmr),
    activityFactor: activity.factor,
    maintenance: Math.round(maintenance),
    adjustment,
    kgPerWeek: Math.round(((adjustment * 7) / KCAL_PER_KG) * 100) / 100,
  };
  return { target, explanation, breakdown };
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
  const { target, explanation, breakdown } = computeTarget(input);
  const effectiveTarget = targetOverride ?? target;
  return {
    ...input,
    computedTarget: target,
    targetOverride,
    effectiveTarget,
    explanation,
    breakdown,
    targets: macroTargets(effectiveTarget),
  };
}
