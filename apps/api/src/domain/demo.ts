import type { ConfirmItem, MealType } from "@kimbo/shared";
import type { Deps } from "../app.js";
import { unlockMilestones } from "../progress-input.js";
import { insertMeal } from "../repo/meals.js";
import { getProfile, saveGoal, type ProfileRow } from "../repo/profiles.js";
import { insertReportWithFocus } from "../repo/reports.js";
import { resolveConfirmedItems } from "./confirm-meal.js";
import { computeTarget } from "./goal.js";
import { SAMPLE_REPORT, selectFocus, toDraftMarkers } from "./health.js";
import { addDays, localDate, startOfLocalDay } from "./time.js";

/**
 * Seeds a demo profile so a reviewer sees the whole loop at once: a goal, a
 * sample report and its focus, ~a week of realistic meals (with one missed
 * day, to show the streak forgiving it) and the milestones that history earns.
 * Everything is dated relative to "now".
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
const MISSED_DAYS_AGO = new Set([4]);
const HISTORY_DAYS = 7;

export async function seedDemoProfile(deps: Deps, row: ProfileRow): Promise<ProfileRow> {
  const now = deps.clock();
  const tz = row.timezone;
  const today = localDate(now, tz);

  await saveGoal(deps.db, row.id, DEMO_GOAL, computeTarget(DEMO_GOAL).target);

  const { markers } = toDraftMarkers(SAMPLE_REPORT);
  const reportDay = addDays(today, -HISTORY_DAYS - 3);
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
  }

  const seeded = (await getProfile(deps.db, row.id))!;
  await unlockMilestones(deps, seeded);
  return seeded;
}
