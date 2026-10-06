import type { Deps } from "./app.js";
import type { KimboEvent } from "@kimbo/shared";
import { milestoneCandidates } from "./domain/achievements.js";
import { onTargetStreak, streakCandidates } from "./domain/journey.js";
import type { ProgressInput } from "./domain/progress.js";
import { addDays, localDate, startOfLocalDay } from "./domain/time.js";
import { unlock } from "./repo/achievements.js";
import { listMeals } from "./repo/meals.js";
import { goalOf, type ProfileRow } from "./repo/profiles.js";
import { listFocusAssignments } from "./repo/reports.js";

/** How far back progress looks — long enough for any realistic streak. */
const HISTORY_DAYS = 400;

export async function loadProgressInput(deps: Deps, profile: ProfileRow): Promise<ProgressInput> {
  const tz = profile.timezone;
  const today = localDate(deps.clock(), tz);
  const [meals, focusHistory] = await Promise.all([
    listMeals(deps.db, profile.id, tz, {
      from: startOfLocalDay(addDays(today, -HISTORY_DAYS), tz),
      to: startOfLocalDay(addDays(today, 1), tz),
    }),
    listFocusAssignments(deps.db, profile.id),
  ]);
  return { meals, focusHistory, targetCalories: goalOf(profile)?.effectiveTarget ?? null, today, timezone: tz };
}

/** Persists any newly reached milestones and returns their events (each fires once). */
export async function unlockMilestones(deps: Deps, profile: ProfileRow): Promise<KimboEvent[]> {
  const input = await loadProgressInput(deps, profile);
  const candidates = milestoneCandidates(input);
  if (input.targetCalories) {
    candidates.push(...streakCandidates(onTargetStreak(input.meals, input.targetCalories, input.today)));
  }
  const events: KimboEvent[] = [];
  for (const c of candidates) {
    if (await unlock(deps.db, profile.id, c.key, c.event.type, deps.clock())) events.push(c.event);
  }
  return events;
}
