import type { FocusKey, MealType } from "@kimbo/shared";
import type { StoredMeal } from "../repo/meals.js";
import type { FocusAssignment } from "../repo/reports.js";
import { GOAL_BAND_PCT, MIN_MEALS_FOR_FOCUS_COMPARISON, STREAK_BREAK_GAP_DAYS } from "./config.js";
import { focusForDay } from "./focus-history.js";
import { mealSupportsFocus } from "./focus-match.js";
import { addDays, daysBetween, weekStart } from "./time.js";

/** Everything the progress engine needs; all pure inputs so results are reproducible. */
export interface ProgressInput {
  meals: StoredMeal[];
  focusHistory: FocusAssignment[];
  targetCalories: number | null;
  today: string;
  timezone: string;
}

export interface WeekStats {
  weekStart: string;
  weekEnd: string;
  daysElapsed: number;
  trackedDates: string[];
  /** kcal for each day Mon–Sun: 0 for a past day with nothing logged, null for days ahead */
  days: { date: string; calories: number | null }[];
  goalDaysMet: number | null;
  /** Completed tracked days, plus today once it's within the band — today never counts as a miss. */
  goalDaysEvaluated: number | null;
  focus: { key: FocusKey; supported: number; total: number; pct: number } | null;
  /** per-meal focus results, for insights */
  evaluated: { mealType: MealType; supports: boolean }[];
}

export function trackedDateSet(meals: StoredMeal[]): Set<string> {
  return new Set(meals.map((m) => m.localDate));
}

export function weekStats(input: ProgressInput, anyDateInWeek: string): WeekStats {
  const start = weekStart(anyDateInWeek);
  const end = addDays(start, 6);
  const lastCounted = input.today < end ? input.today : end;
  const daysElapsed = Math.max(0, Math.min(7, daysBetween(start, lastCounted) + 1));
  const weekMeals = input.meals.filter((m) => m.localDate >= start && m.localDate <= lastCounted);

  const caloriesByDay = new Map<string, number>();
  for (const m of weekMeals) caloriesByDay.set(m.localDate, (caloriesByDay.get(m.localDate) ?? 0) + m.totals.calories);
  const trackedDates = [...caloriesByDay.keys()].sort();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, calories: date > lastCounted ? null : Math.round(caloriesByDay.get(date) ?? 0) };
  });

  let goalDaysMet: number | null = null;
  let goalDaysEvaluated: number | null = null;
  if (input.targetCalories) {
    const band = (input.targetCalories * GOAL_BAND_PCT) / 100;
    // Compare in whole kcal so ±10% boundaries are inclusive despite float error.
    const low = Math.round(input.targetCalories - band);
    const high = Math.round(input.targetCalories + band);
    goalDaysMet = 0;
    goalDaysEvaluated = 0;
    for (const [date, calories] of caloriesByDay) {
      const met = calories >= low && calories <= high;
      if (met) goalDaysMet++;
      if (met || date < input.today) goalDaysEvaluated++;
    }
  }

  const evaluated: WeekStats["evaluated"] = [];
  for (const meal of weekMeals) {
    const focus = focusForDay(input.focusHistory, meal.localDate, input.timezone);
    if (focus) evaluated.push({ mealType: meal.mealType, supports: mealSupportsFocus(meal, focus).supports });
  }
  const currentFocus = focusForDay(input.focusHistory, lastCounted, input.timezone);
  const supported = evaluated.filter((e) => e.supports).length;
  const focus = currentFocus
    ? {
        key: currentFocus,
        supported,
        total: evaluated.length,
        pct: evaluated.length ? Math.round((supported / evaluated.length) * 100) : 0,
      }
    : null;

  return {
    weekStart: start,
    weekEnd: end,
    daysElapsed,
    trackedDates,
    days,
    goalDaysMet,
    goalDaysEvaluated,
    focus,
    evaluated,
  };
}

/**
 * Forgiving consistency streak: counts tracked days walking back from today,
 * tolerating single missed days; STREAK_BREAK_GAP_DAYS misses in a row end it.
 * Today only counts once logged — it is never a "miss" while still in progress.
 */
export function consistencyStreak(tracked: Set<string>, today: string, earliest: string): number {
  let count = 0;
  let gap = 0;
  for (let d = today; d >= earliest; d = addDays(d, -1)) {
    if (tracked.has(d)) {
      count++;
      gap = 0;
    } else if (d !== today) {
      gap++;
      if (gap >= STREAK_BREAK_GAP_DAYS) break;
    }
  }
  return count;
}

export function longestRun(tracked: Set<string>): number {
  let best = 0;
  for (const d of tracked) {
    if (tracked.has(addDays(d, -1))) continue;
    let len = 1;
    while (tracked.has(addDays(d, len))) len++;
    best = Math.max(best, len);
  }
  return best;
}

/** Comparison is only meaningful once both weeks have a few focus-evaluated meals. */
export function focusComparable(a: WeekStats, b: WeekStats): boolean {
  return (
    (a.focus?.total ?? 0) >= MIN_MEALS_FOR_FOCUS_COMPARISON && (b.focus?.total ?? 0) >= MIN_MEALS_FOR_FOCUS_COMPARISON
  );
}

const PLURAL: Record<MealType, string> = {
  breakfast: "breakfasts",
  lunch: "lunches",
  snack: "snacks",
  dinner: "dinners",
};

/** Light-touch pattern insights; empty until there's enough data to say something true. */
export function insights(week: WeekStats): string[] {
  const byType = new Map<MealType, { supports: number; total: number }>();
  for (const e of week.evaluated) {
    const s = byType.get(e.mealType) ?? { supports: 0, total: 0 };
    s.total++;
    if (e.supports) s.supports++;
    byType.set(e.mealType, s);
  }
  const candidates = [...byType.entries()]
    .filter(([, s]) => s.total >= MIN_MEALS_FOR_FOCUS_COMPARISON && s.supports / s.total > 0.5)
    .sort((a, b) => b[1].supports / b[1].total - a[1].supports / a[1].total);
  const out: string[] = [];
  if (candidates[0] && byType.size > 1) out.push(`Your ${PLURAL[candidates[0][0]]} most often support your focus.`);
  return out;
}
