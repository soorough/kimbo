import { computeGoal, macroTargetsFor, TARGET_BOUNDS_KCAL, type Goal, type GoalInput } from "@kimbo/shared";

/** The shared calculation plus the plain-language explanation the API returns. */
export function computeTarget(input: GoalInput) {
  const n = computeGoal(input);
  const explanation = [
    `At rest your body uses about ${Math.round(n.bmr)} kcal a day (Mifflin-St Jeor formula).`,
    `Your activity multiplies that by ${n.activityFactor}, to about ${Math.round(n.maintenance)} kcal a day.`,
  ];
  if (n.adjustment < 0) explanation.push(`To lose ${n.weeklyKg} kg a week, Kimbo takes off ${-n.adjustment} kcal.`);
  if (n.adjustment > 0) {
    explanation.push(`To build muscle at ${n.weeklyKg} kg a week, Kimbo adds ${n.adjustment} kcal and more protein.`);
  }
  if (n.raw < TARGET_BOUNDS_KCAL.min || n.raw > TARGET_BOUNDS_KCAL.max) {
    explanation.push(
      `Targets stay between ${TARGET_BOUNDS_KCAL.min} and ${TARGET_BOUNDS_KCAL.max} kcal, so yours is ${n.target}.`,
    );
  }
  explanation.push("It's an estimate. You can change it any time.");
  return {
    target: n.target,
    explanation,
    breakdown: {
      bmr: Math.round(n.bmr),
      activityFactor: n.activityFactor,
      maintenance: Math.round(n.maintenance),
      adjustment: n.adjustment,
      kgPerWeek: n.kgPerWeek,
      weeksToGoal: n.weeksToGoal,
    },
    weeklyKg: n.weeklyKg,
  };
}

export function isTargetInBounds(target: number): boolean {
  return target >= TARGET_BOUNDS_KCAL.min && target <= TARGET_BOUNDS_KCAL.max;
}

export function buildGoal(input: GoalInput, targetOverride: number | null): Goal {
  const { target, explanation, breakdown, weeklyKg } = computeTarget(input);
  const effectiveTarget = targetOverride ?? target;
  return {
    age: input.age,
    sex: input.sex,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activity: input.activity,
    goal: input.goal,
    weeklyKg,
    targetWeightKg: input.targetWeightKg ?? null,
    computedTarget: target,
    targetOverride,
    effectiveTarget,
    explanation,
    breakdown,
    targets: macroTargetsFor(effectiveTarget, input.goal, input.weightKg),
  };
}
