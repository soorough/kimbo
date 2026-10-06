/**
 * Every tunable product constant lives here so it can be reviewed in one place.
 * Sources are noted inline; medical thresholds should be re-reviewed before release.
 */
import type { ActivityLevel } from "@kimbo/shared";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

// --- Calorie target (Mifflin–St Jeor, 1990) ---
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: "mostly sitting" },
  light: { factor: 1.375, label: "lightly active (1–3 days of exercise a week)" },
  moderate: { factor: 1.55, label: "moderately active (3–5 days a week)" },
  active: { factor: 1.725, label: "very active (6–7 days a week)" },
  very_active: { factor: 1.9, label: "extremely active (physical job or twice-daily training)" },
};
export const GOAL_ADJUSTMENT_KCAL = { maintain: 0, lose: -500, gain: 300 } as const;
export const TARGET_BOUNDS_KCAL = { min: 1200, max: 4000 } as const;
export const TARGET_ROUNDING_KCAL = 10;
/** Share of calories from each macro (common balanced-diet split). */
export const MACRO_SPLIT = { protein: 0.2, carbs: 0.5, fat: 0.3 } as const;
/** ICMR-NIN 2020 suggests ~30 g/day dietary fibre for a 2000 kcal diet. */
export const FIBRE_TARGET_G = 30;

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
/** Editable per-serving placeholder for dishes outside the catalogue (a typical mixed home dish). */
export const UNKNOWN_DISH_PER_SERVING = { calories: 250, protein: 8, carbs: 30, fat: 10, fibre: 3, satFat: 3 } as const;

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
