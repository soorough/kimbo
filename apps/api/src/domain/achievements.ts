import type { KimboEvent, KimboEventType } from "@kimbo/shared";
import { focusComparable, longestRun, trackedDateSet, weekStats, type ProgressInput } from "./progress.js";
import { addDays, daysBetween } from "./time.js";
import { WELCOME_BACK_AFTER_DAYS } from "./config.js";

export const ACHIEVEMENT_TITLES: Record<KimboEventType, string> = {
  first_3_days: "First 3 days tracked",
  first_full_week: "A full week tracked",
  consistency_improved: "More consistent than last week",
  focus_improved: "Focus up from last week",
  welcome_back: "Welcome back",
  meal_supported_focus: "Meal supported your focus",
  report_became_focus: "Report became your focus",
  correction_accepted: "Correction saved",
};

const MESSAGES: Partial<Record<KimboEventType, string>> = {
  first_3_days: "3 days tracked — a habit is starting ✦",
  first_full_week: "A full week of tracking. That's real consistency!",
  consistency_improved: "You've tracked more days than last week ↑",
  focus_improved: "Your focus is going better than last week ↑",
  welcome_back: "Welcome back! Good to see you — one meal is a great place to start.",
};

/** A candidate milestone and the key that makes it fire only once (per week where relevant). */
export interface Candidate {
  key: string;
  event: KimboEvent;
}

const candidate = (type: KimboEventType, key: string = type): Candidate => ({
  key,
  event: { type, message: MESSAGES[type]! },
});

/** Milestones the current log qualifies for; the caller persists them so each fires once. */
export function milestoneCandidates(input: ProgressInput): Candidate[] {
  const tracked = trackedDateSet(input.meals);
  const out: Candidate[] = [];
  if (tracked.size >= 3) out.push(candidate("first_3_days"));
  if (longestRun(tracked) >= 7) out.push(candidate("first_full_week"));

  const thisWeek = weekStats(input, input.today);
  const lastWeek = weekStats(input, addDays(thisWeek.weekStart, -1));
  if (lastWeek.trackedDates.length >= 1 && thisWeek.trackedDates.length > lastWeek.trackedDates.length) {
    out.push(candidate("consistency_improved", `consistency_improved:${thisWeek.weekStart}`));
  }
  if (focusComparable(thisWeek, lastWeek) && thisWeek.focus!.pct > lastWeek.focus!.pct) {
    out.push(candidate("focus_improved", `focus_improved:${thisWeek.weekStart}`));
  }
  return out;
}

/** On app open: a warm hello after WELCOME_BACK_AFTER_DAYS without meals, keyed to that break. */
export function welcomeBackCandidate(lastMealDate: string | null, today: string): Candidate | null {
  if (!lastMealDate || daysBetween(lastMealDate, today) < WELCOME_BACK_AFTER_DAYS) return null;
  return candidate("welcome_back", `welcome_back:${lastMealDate}`);
}
