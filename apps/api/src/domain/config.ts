/**
 * Every tunable product constant lives here so it can be reviewed in one place.
 * Sources are noted inline; medical thresholds should be re-reviewed before release.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

// --- Calorie target ---
// Formula, activity factors, weekly paces and macro rules live in @kimbo/shared (goal.ts),
// so the app previews exactly what the API stores.

// --- Progress ---
/** A tracked day "meets the goal" when calories are within ±10% of target. */
export const GOAL_BAND_PCT = 10;
/** Consecutive untracked (completed) days that end a consistency streak. */
export const STREAK_BREAK_GAP_DAYS = 2;
/** Days without a meal before opening the app counts as returning from a break. */
export const WELCOME_BACK_AFTER_DAYS = 3;
/** Minimum focus-evaluated meals in each week before week-over-week adherence is compared. */
export const MIN_MEALS_FOR_FOCUS_COMPARISON = 3;

// --- Meal-type suggestion by local hour ---
export const MEAL_TYPE_HOURS = { breakfastBefore: 11, lunchBefore: 16, snackBefore: 19 } as const;

// --- Unknown dishes ---
/** Editable placeholder for one serving of a dish outside the catalogue (a typical mixed home dish). */
export const UNKNOWN_DISH_PER_SERVING = { calories: 250, protein: 8, carbs: 30, fat: 10, fibre: 3, satFat: 3 } as const;
/** Placeholder kcal per unit for unknown dishes, so "6 pieces" isn't priced as 6 plates. */
export const UNKNOWN_DISH_KCAL_PER_UNIT = {
  piece: 100,
  katori: 200,
  bowl: 300,
  plate: 400,
  glass: 150,
  cup: 100,
  tbsp: 45,
  g: 2,
  serving: 250,
} as const;

// --- Health markers ---
/**
 * Status thresholds in canonical units (lower bound of each band).
 * LDL: NCEP ATP III (<100 optimal, 160+ high). HbA1c: ADA (5.7–6.4 prediabetes range, 6.5+).
 * Triglycerides: NCEP ATP III (<150 normal, 150–199 borderline, 200+ high).
 * Kimbo words these non-diagnostically; review before release.
 */
export const MARKER_THRESHOLDS = {
  ldl: { worthWatching: 100, high: 160 },
  hba1c: { worthWatching: 5.7, high: 6.5 },
  triglycerides: { worthWatching: 150, high: 200 },
} as const;

/** When markers are equally out of range, the earlier one decides the focus. */
export const FOCUS_PRIORITY = ["ldl", "hba1c", "triglycerides"] as const;

// --- Meal ↔ focus matching ---
export const FOCUS_MATCH = {
  /** A meal with this much fibre counts as fibre-rich even without a fibre-rich dish (≈ 1/5 of 30 g/day). */
  fibreRichMealG: 6,
  /** Saturated fat from rich dishes above this, in one meal, outweighs the fibre for the LDL focus. */
  satFatHeavyMealG: 8,
  /** Protein that makes a meal count as "carbs paired with protein". */
  proteinPairedG: 15,
  /** Balanced plate: some protein plus some fibre. */
  balancedProteinG: 12,
  balancedFibreG: 4,
} as const;

/** Everyday water goal: about eight 250 ml glasses. */
export const WATER_GOAL_ML = 2000;
/** Body weight to use for exercise calories before any weigh-in or goal exists. */
export const DEFAULT_WEIGHT_KG = 65;
