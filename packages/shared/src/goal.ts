/**
 * Calorie and macro targets. Shared so the app can preview the numbers while
 * someone is still choosing (activity, pace) and the API — which stays the
 * source of truth — stores exactly the same result.
 */

export type ActivityKey = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalKey = "lose" | "maintain" | "build_muscle";
export type SexKey = "male" | "female" | "other";

/** Mifflin–St Jeor (1990) activity multipliers. */
export const ACTIVITY_FACTORS: Record<ActivityKey, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Weekly paces offered per goal (kg). Losing up to 1 kg a week and gaining
 * 0.25–0.5 kg a week are common safe ranges; muscle gain is kept slow to limit fat gain.
 */
export const PACES: Record<Exclude<GoalKey, "maintain">, readonly number[]> = {
  lose: [0.25, 0.5, 0.75, 1],
  build_muscle: [0.25, 0.5],
};
export const DEFAULT_PACE: Record<Exclude<GoalKey, "maintain">, number> = { lose: 0.5, build_muscle: 0.25 };

export const TARGET_BOUNDS_KCAL = { min: 1200, max: 4000 } as const;
export const TARGET_ROUNDING_KCAL = 10;
/** Common approximation of the energy in 1 kg of body weight. */
export const KCAL_PER_KG = 7700;
/** Balanced split for lose/maintain. */
export const MACRO_SPLIT = { protein: 0.2, carbs: 0.5, fat: 0.3 } as const;
/** Building muscle: 1.6 g protein per kg body weight (ISSN position stand, 2017); fat stays at 30%. */
export const MUSCLE_PROTEIN_G_PER_KG = 1.6;
/** ICMR-NIN 2020 suggests ~30 g/day dietary fibre. */
export const FIBRE_TARGET_G = 30;

const SEX_CONSTANT: Record<SexKey, number> = { male: 5, female: -161, other: -78 };

export interface GoalInput {
  age: number;
  sex: SexKey;
  heightCm: number;
  weightKg: number;
  activity: ActivityKey;
  goal: GoalKey;
  /** kg per week; ignored for maintain, defaults per goal */
  weeklyKg?: number;
  targetWeightKg?: number | null;
}

export interface GoalNumbers {
  bmr: number;
  maintenance: number;
  activityFactor: number;
  weeklyKg: number;
  /** signed kcal per day: negative to lose, positive to build */
  adjustment: number;
  /** before rounding and safety bounds */
  raw: number;
  target: number;
  /** signed kg per week */
  kgPerWeek: number;
  weeksToGoal: number | null;
}

export function bmrFor(i: Pick<GoalInput, "age" | "sex" | "heightCm" | "weightKg">): number {
  return 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + SEX_CONSTANT[i.sex];
}

export function maintenanceFor(i: Pick<GoalInput, "age" | "sex" | "heightCm" | "weightKg" | "activity">): number {
  return bmrFor(i) * ACTIVITY_FACTORS[i.activity];
}

export function clampTarget(kcal: number): number {
  const rounded = Math.round(kcal / TARGET_ROUNDING_KCAL) * TARGET_ROUNDING_KCAL;
  return Math.min(TARGET_BOUNDS_KCAL.max, Math.max(TARGET_BOUNDS_KCAL.min, rounded));
}

export function computeGoal(i: GoalInput): GoalNumbers {
  const bmr = bmrFor(i);
  const activityFactor = ACTIVITY_FACTORS[i.activity];
  const maintenance = bmr * activityFactor;
  const weeklyKg = i.goal === "maintain" ? 0 : (i.weeklyKg ?? DEFAULT_PACE[i.goal]);
  const sign = i.goal === "lose" ? -1 : i.goal === "build_muscle" ? 1 : 0;
  const adjustment = Math.round((sign * weeklyKg * KCAL_PER_KG) / 7);
  const raw = maintenance + adjustment;
  const kgToGo = i.targetWeightKg != null && weeklyKg > 0 ? Math.abs(i.targetWeightKg - i.weightKg) : null;
  return {
    bmr,
    maintenance,
    activityFactor,
    weeklyKg,
    adjustment,
    raw,
    target: clampTarget(raw),
    kgPerWeek: sign * weeklyKg,
    weeksToGoal: kgToGo === null ? null : Math.ceil(kgToGo / weeklyKg),
  };
}

export function macroTargetsFor(calories: number, goal: GoalKey, weightKg: number) {
  const fat = Math.round((calories * MACRO_SPLIT.fat) / 9);
  if (goal === "build_muscle") {
    const protein = Math.round(MUSCLE_PROTEIN_G_PER_KG * weightKg);
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    return { calories, protein, carbs, fat, fibre: FIBRE_TARGET_G };
  }
  return {
    calories,
    protein: Math.round((calories * MACRO_SPLIT.protein) / 4),
    carbs: Math.round((calories * MACRO_SPLIT.carbs) / 4),
    fat,
    fibre: FIBRE_TARGET_G,
  };
}
