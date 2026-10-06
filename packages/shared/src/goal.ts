/**
 * Calorie and macro targets. Shared so the app can preview the numbers while
 * someone is still choosing (activity, pace) and the API — which stays the
 * source of truth — stores exactly the same result.
 */

export type ActivityKey = "sedentary" | "light" | "moderate" | "active" | "very_active";
/** "recomp" is maingaining: maintenance calories with muscle-building protein, weight held steady. */
export type GoalKey = "lose" | "maintain" | "build_muscle" | "recomp";
/** Goals that move the scale, and so have a goal weight and a weekly pace. */
export type WeightGoalKey = "lose" | "build_muscle";
export const isWeightGoal = (g: GoalKey): g is WeightGoalKey => g === "lose" || g === "build_muscle";
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
export const PACES: Record<WeightGoalKey, readonly number[]> = {
  lose: [0.25, 0.5, 0.75, 1],
  build_muscle: [0.25, 0.5],
};
export const DEFAULT_PACE: Record<WeightGoalKey, number> = { lose: 0.5, build_muscle: 0.25 };

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
  const weeklyKg = isWeightGoal(i.goal) ? (i.weeklyKg ?? DEFAULT_PACE[i.goal]) : 0;
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

/** Saturated fat ceiling: under 10% of daily energy (WHO). A limit, not a target to reach. */
const SAT_FAT_MAX_ENERGY_SHARE = 0.1;

export function macroTargetsFor(calories: number, goal: GoalKey, weightKg: number) {
  const fat = Math.round((calories * MACRO_SPLIT.fat) / 9);
  const satFat = Math.round((calories * SAT_FAT_MAX_ENERGY_SHARE) / 9);
  if (goal === "build_muscle" || goal === "recomp") {
    const protein = Math.round(MUSCLE_PROTEIN_G_PER_KG * weightKg);
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    return { calories, protein, carbs, fat, fibre: FIBRE_TARGET_G, satFat };
  }
  return {
    calories,
    protein: Math.round((calories * MACRO_SPLIT.protein) / 4),
    carbs: Math.round((calories * MACRO_SPLIT.carbs) / 4),
    fat,
    fibre: FIBRE_TARGET_G,
    satFat,
  };
}

/**
 * Honest read on a goal date. Losing up to ~0.5% of body weight a week is comfortable and
 * up to ~1% is doable; beyond that, more of the loss is muscle and hunger makes it hard to
 * keep up. Muscle can only be built at about 0.25–0.5 kg a week, so a faster gain is mostly fat.
 */
export const LOSS_COMFORTABLE_PCT = 0.5;
export const LOSS_REALISTIC_PCT = 1;

export type TimelineVerdict = "comfortable" | "effort" | "hard" | "unrealistic";

export interface TimelineAssessment {
  requiredKgPerWeek: number;
  verdict: TimelineVerdict;
  /** slowest offered pace that reaches the goal by the date; null if none does */
  pace: number | null;
  /** weeks the goal takes at the fastest realistic pace */
  realisticWeeks: number | null;
  /** where the fastest realistic pace gets you by the date */
  realisticGoalWeightKg: number | null;
}

export function assessTimeline(
  i: Omit<GoalInput, "goal" | "weeklyKg" | "targetWeightKg"> & {
    goal: WeightGoalKey;
    targetWeightKg: number;
  },
  weeks: number,
): TimelineAssessment {
  const kgToGo = Math.abs(i.targetWeightKg - i.weightKg);
  const requiredKgPerWeek = Math.round((kgToGo / Math.max(1, weeks)) * 100) / 100;
  // Paces whose calorie target stays at or above the safe minimum for this person.
  const feasible = PACES[i.goal].filter((p) => computeGoal({ ...i, weeklyKg: p }).raw >= TARGET_BOUNDS_KCAL.min);
  const pctOf = (p: number) => (p / i.weightKg) * 100;
  const realistic = feasible.filter((p) => (i.goal === "lose" ? pctOf(p) <= LOSS_REALISTIC_PCT : true));
  const fastest = realistic.at(-1) ?? null;

  const pace = feasible.find((p) => p >= requiredKgPerWeek - 1e-9) ?? null;
  let verdict: TimelineVerdict;
  if (pace === null) verdict = "unrealistic";
  else if (i.goal === "build_muscle") verdict = pace <= 0.25 ? "comfortable" : "effort";
  else verdict = pctOf(pace) <= LOSS_COMFORTABLE_PCT ? "comfortable" : pctOf(pace) <= LOSS_REALISTIC_PCT ? "effort" : "hard";

  const sign = i.goal === "lose" ? -1 : 1;
  return {
    requiredKgPerWeek,
    verdict,
    pace,
    realisticWeeks: fastest ? Math.ceil(kgToGo / fastest) : null,
    realisticGoalWeightKg: fastest ? Math.round((i.weightKg + sign * fastest * weeks) * 2) / 2 : null,
  };
}
