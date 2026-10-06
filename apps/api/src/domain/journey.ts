import type { Goal, JourneyResponse, KimboEvent } from "@kimbo/shared";
import type { WeighIn } from "../repo/weigh-ins.js";
import type { StoredMeal } from "../repo/meals.js";
import type { Candidate } from "./achievements.js";
import { GOAL_BAND_PCT } from "./config.js";
import { addDays } from "./time.js";

const round1 = (n: number) => Math.round(n * 10) / 10;
const HISTORY_POINTS = 12;

/**
 * Consecutive days within ±GOAL_BAND_PCT of the calorie target, counting back from
 * today. Today only counts once it's on target; it never breaks the streak early.
 */
export function onTargetStreak(
  meals: StoredMeal[],
  targetKcal: number,
  today: string,
): { days: number; start: string | null } {
  const byDay = new Map<string, number>();
  for (const m of meals) byDay.set(m.localDate, (byDay.get(m.localDate) ?? 0) + m.totals.calories);
  const band = (targetKcal * GOAL_BAND_PCT) / 100;
  const low = Math.round(targetKcal - band);
  const high = Math.round(targetKcal + band);
  const met = (d: string) => {
    const c = byDay.get(d);
    return c !== undefined && c >= low && c <= high;
  };
  let days = 0;
  let day = met(today) ? today : addDays(today, -1);
  let start: string | null = null;
  while (met(day)) {
    days++;
    start = day;
    day = addDays(day, -1);
  }
  // `start` is the streak's first day, used to key milestones so each run is celebrated once.
  return { days, start };
}

export function computeJourney(goal: Goal, weighIns: WeighIn[], streak: number): JourneyResponse {
  const startKg = goal.weightKg;
  const last = weighIns.at(-1) ?? null;
  const currentKg = last?.kg ?? startKg;
  const targetKg = goal.goal === "maintain" ? null : goal.targetWeightKg;
  let kgToGo: number | null = null;
  let pct: number | null = null;
  if (targetKg !== null) {
    const total = Math.abs(targetKg - startKg);
    // Weights are recorded to 0.1 kg; round so 71.1 - 70 is 1.1, not 1.0999….
    const done = round1(goal.goal === "lose" ? startKg - currentKg : currentKg - startKg);
    kgToGo = round1(Math.max(0, total - done));
    pct = total > 0 ? Math.round(Math.min(100, Math.max(0, (done / total) * 100))) : 100;
  }
  return {
    goal: goal.goal,
    startKg,
    currentKg,
    targetKg,
    kgToGo,
    pct,
    weeklyKg: goal.weeklyKg,
    lastWeighIn: last?.date ?? null,
    onTargetStreak: streak,
    history: weighIns.slice(-HISTORY_POINTS).map((w) => ({ date: w.date, kg: w.kg })),
  };
}

const event = (type: KimboEvent["type"], message: string): KimboEvent => ({ type, message });

/** Weight milestones the journey has reached; the caller persists keys so each fires once. */
export function weightCandidates(j: JourneyResponse, isFirstWeighIn: boolean): Candidate[] {
  const out: Candidate[] = [];
  if (isFirstWeighIn) {
    out.push({
      key: "first_weigh_in",
      event: event("first_weigh_in", "First weigh-in logged. Kimbo will track the trend."),
    });
  }
  if (j.targetKg === null || j.kgToGo === null || j.pct === null) return out;
  const direction = j.goal === "lose" ? "down" : "up";
  const done = Math.abs(j.currentKg - j.startKg);
  const movingRightWay = j.goal === "lose" ? j.currentKg < j.startKg : j.currentKg > j.startKg;
  const wholeKg = movingRightWay ? Math.floor(done + 1e-9) : 0;
  if (j.kgToGo === 0) {
    out.push({
      key: `goal_reached:${j.targetKg}`,
      event: event("goal_reached", `You reached ${j.targetKg} kg. That's your goal.`),
    });
  } else {
    if (wholeKg >= 1) {
      out.push({
        key: `kg_progress:${j.targetKg}:${wholeKg}`,
        event: event("kg_progress", `${wholeKg} kg ${direction}. ${Math.round(j.kgToGo)} to go.`),
      });
    }
    if (j.pct >= 50) {
      out.push({
        key: `halfway:${j.targetKg}`,
        event: event("halfway_to_goal", `Halfway to ${j.targetKg} kg.`),
      });
    }
  }
  return out;
}

/** On-target streak milestones, keyed to the streak's first day. */
export function streakCandidates({ days: streak, start }: { days: number; start: string | null }): Candidate[] {
  const out: Candidate[] = [];
  if (streak >= 3) {
    out.push({ key: `on_target_3:${start}`, event: event("on_target_3", "3 days in a row on target.") });
  }
  if (streak >= 7) {
    out.push({ key: `on_target_7:${start}`, event: event("on_target_7", "A full week on target.") });
  }
  return out;
}
