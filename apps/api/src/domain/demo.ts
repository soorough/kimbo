import type { ConfirmItem, MealType } from "@kimbo/shared";
import type { Deps } from "../app.js";
import { unlockMilestones } from "../progress-input.js";
import { addExercise } from "../repo/exercise.js";
import { insertMeal } from "../repo/meals.js";
import { getProfile, saveGoal, type ProfileRow } from "../repo/profiles.js";
import { insertReportWithFocus } from "../repo/reports.js";
import { insertSavedMeal } from "../repo/saved-meals.js";
import { addWater } from "../repo/water.js";
import { upsertWeighIn } from "../repo/weigh-ins.js";
import { resolveConfirmedItems } from "./confirm-meal.js";
import { exerciseDraft } from "./exercise.js";
import { computeTarget } from "./goal.js";
import { SAMPLE_REPORT, selectFocus, toDraftMarkers } from "./health.js";
import { addDays, localDate, startOfLocalDay } from "./time.js";

/**
 * Seeds a demo profile so a reviewer can try every screen at once: a goal, a sample
 * report and its focus, 30 days of realistic meals (two missed days, to show the streak
 * forgiving them), water, workouts, a weight trend heading for the goal, two saved
 * meals and the milestones that history earns. Everything is dated relative to "now",
 * so the data is never stale.
 */

const DEMO_GOAL = { age: 34, sex: "female", heightCm: 162, weightKg: 64, activity: "light", goal: "lose", targetWeightKg: 59 } as const;

const c = (foodId: string, quantity: number, unit: string): ConfirmItem =>
  ({ kind: "catalogue", foodId, quantity, unit }) as ConfirmItem;

const BREAKFASTS: ConfirmItem[][] = [
  [c("poha", 1, "plate"), c("masala_chai", 1, "cup")],
  [c("idli", 3, "piece"), c("sambar", 1, "katori"), c("coconut_chutney", 2, "tbsp")],
  [c("oats", 1, "bowl"), c("banana", 1, "piece")],
  [c("aloo_paratha", 1, "piece"), c("curd", 1, "katori")],
  [c("omelette", 1, "piece"), c("brown_bread", 2, "piece")],
  [c("upma", 1, "plate"), c("masala_chai", 1, "cup")],
  [c("masala_dosa", 1, "piece"), c("sambar", 1, "katori")],
];
// Lunch index = (daysAgo + 1) % 7, so yesterday gets index 2 — kept light for a clear demo story.
const LUNCHES: ConfirmItem[][] = [
  [c("roti", 2, "piece"), c("dal_tadka", 1, "katori"), c("bhindi", 1, "katori")],
  [c("white_rice", 1, "katori"), c("rajma", 1, "katori"), c("salad", 1, "bowl")],
  [c("chicken_curry", 1, "katori"), c("white_rice", 1, "katori"), c("salad", 1, "bowl")],
  [c("roti", 2, "piece"), c("chole", 1, "katori"), c("raita", 1, "katori")],
  [c("white_rice", 1, "katori"), c("sambar", 1, "katori"), c("cabbage_sabzi", 1, "katori")],
  [c("paneer_butter_masala", 1, "katori"), c("naan", 2, "piece")],
  [c("khichdi", 1, "katori"), c("curd", 1, "katori")],
];
const DINNERS: ConfirmItem[][] = [
  [c("roti", 2, "piece"), c("mixed_veg", 1, "katori"), c("moong_dal", 1, "katori")],
  [c("butter_chicken", 1, "katori"), c("naan", 1, "piece")],
  [c("roti", 2, "piece"), c("palak_paneer", 1, "katori")],
  [c("roti", 2, "piece"), c("baingan_bharta", 1, "katori"), c("masoor_dal", 1, "katori")],
  [c("veg_biryani", 1, "plate"), c("raita", 1, "katori")],
  [c("roti", 2, "piece"), c("aloo_gobi", 1, "katori"), c("dal_tadka", 1, "katori")],
  [c("fish_curry", 1, "katori"), c("white_rice", 1, "katori"), c("beans_poriyal", 1, "katori")],
];
const SNACKS: ConfirmItem[][] = [
  [c("masala_chai", 1, "cup"), c("biscuits", 2, "piece")],
  [c("sprouts", 1, "katori")],
  [c("samosa", 1, "piece"), c("masala_chai", 1, "cup")],
];

const SLOTS: { type: MealType; hours: number; menu: ConfirmItem[][] }[] = [
  { type: "breakfast", hours: 8.5, menu: BREAKFASTS },
  { type: "lunch", hours: 13.25, menu: LUNCHES },
  { type: "snack", hours: 17, menu: SNACKS },
  { type: "dinner", hours: 20.5, menu: DINNERS },
];

/** Days before today with no meals — shows a missed day not breaking consistency. */
const MISSED_DAYS_AGO = new Set([4, 17]);
/** Days before today: with today, a full 30-day month. */
const HISTORY_DAYS = 29;

/** Workouts by weekday-ish rhythm (days ago % 7), at 7 am. */
const WORKOUTS: Record<number, Parameters<typeof exerciseDraft>> = {
  0: ["walk", "medium", 35, DEMO_GOAL.weightKg],
  2: ["yoga", "medium", 40, DEMO_GOAL.weightKg],
  5: ["run", "low", 25, DEMO_GOAL.weightKg],
};

/** 64 kg → about 62 kg over the month: steady loss with day-to-day wobble. */
function demoWeight(daysAgo: number): number {
  const wobble = [0, 0.3, -0.1, 0.2, -0.2, 0.1][daysAgo % 6]!;
  return Math.round((DEMO_GOAL.weightKg - (HISTORY_DAYS - daysAgo) * 0.065 + wobble) * 10) / 10;
}

export async function seedDemoProfile(deps: Deps, row: ProfileRow): Promise<ProfileRow> {
  const now = deps.clock();
  const tz = row.timezone;
  const today = localDate(now, tz);

  await saveGoal(deps.db, row.id, DEMO_GOAL, computeTarget(DEMO_GOAL).target);

  const { markers } = toDraftMarkers(SAMPLE_REPORT);
  const reportDay = addDays(today, -HISTORY_DAYS - 2);
  await insertReportWithFocus(deps.db, row.id, {
    reportDate: reportDay,
    source: "sample",
    markers,
    focus: selectFocus(markers).key,
    now: new Date(startOfLocalDay(addDays(reportDay, 1), tz).getTime() + 10 * 3600_000),
  });

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo--) {
    if (MISSED_DAYS_AGO.has(daysAgo)) continue;
    const date = addDays(today, -daysAgo);
    const dayStart = startOfLocalDay(date, tz).getTime();
    for (const [slotIndex, slot] of SLOTS.entries()) {
      if (slot.type === "snack" && daysAgo % 2 === 1) continue; // snacks on alternate days
      const eatenAt = new Date(dayStart + slot.hours * 3600_000);
      if (eatenAt > now) continue;
      const items = slot.menu[(daysAgo + slotIndex) % slot.menu.length]!;
      await insertMeal(
        deps.db,
        row.id,
        {
          mealType: slot.type,
          eatenAt,
          source: daysAgo % 3 === 0 ? "photo" : "text",
          wasCorrected: false,
          items: resolveConfirmedItems(items),
        },
        eatenAt,
      );
    }

    const at = (hours: number) => new Date(dayStart + hours * 3600_000);
    // Water through the day: 6–9 glasses.
    const glasses = 6 + (daysAgo % 4);
    for (let g = 0; g < glasses; g++) {
      const when = at(8 + g * 1.6);
      if (when <= now) await addWater(deps.db, row.id, 250, when);
    }
    const workout = WORKOUTS[daysAgo % 7];
    if (workout && at(7) <= now) await addExercise(deps.db, row.id, exerciseDraft(...workout), at(7));
    // Weighs in most mornings, the first day always (it's the start of the trend).
    if ((daysAgo % 3 !== 1 || daysAgo === HISTORY_DAYS) && at(7) <= now) {
      await upsertWeighIn(deps.db, row.id, { date, kg: daysAgo === HISTORY_DAYS ? DEMO_GOAL.weightKg : demoWeight(daysAgo) }, at(7));
    }
  }

  const firstDay = new Date(startOfLocalDay(addDays(today, -HISTORY_DAYS), tz).getTime() + 9 * 3600_000);
  await insertSavedMeal(deps.db, row.id, "Usual breakfast", resolveConfirmedItems(BREAKFASTS[0]!), firstDay);
  await insertSavedMeal(deps.db, row.id, "Light dinner", resolveConfirmedItems(DINNERS[0]!), firstDay);

  const seeded = (await getProfile(deps.db, row.id))!;
  await unlockMilestones(deps, seeded);
  return seeded;
}
