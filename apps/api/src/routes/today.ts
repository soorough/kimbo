import { LocalDate, type TodayResponse } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { sumNutrition } from "../domain/catalogue.js";
import { WATER_GOAL_ML } from "../domain/config.js";
import { focusForDay } from "../domain/focus-history.js";
import { mealSupportsFocus } from "../domain/focus-match.js";
import { FOCI } from "../domain/health.js";
import { healthScore } from "../domain/health-score.js";
import { addDays, localDate, startOfLocalDay } from "../domain/time.js";
import { parse, requireProfile } from "../http.js";
import { listMeals, toApiMeal } from "../repo/meals.js";
import { goalOf } from "../repo/profiles.js";
import { listFocusAssignments } from "../repo/reports.js";
import { listExercise } from "../repo/exercise.js";
import { listWater } from "../repo/water.js";

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

export function todayRoutes(app: FastifyInstance, deps: Deps) {
  app.get<{ Querystring: { date?: string } }>("/today", async (req): Promise<TodayResponse> => {
    const profile = await requireProfile(deps, req);
    const tz = profile.timezone;
    const date = req.query.date ? parse(LocalDate, req.query.date) : localDate(deps.clock(), tz);
    const dayStart = startOfLocalDay(date, tz);
    const dayEnd = startOfLocalDay(addDays(date, 1), tz);
    const [meals, yesterdayMeals, history, water, exercise] = await Promise.all([
      listMeals(deps.db, profile.id, tz, {
        from: startOfLocalDay(date, tz),
        to: startOfLocalDay(addDays(date, 1), tz),
      }),
      listMeals(deps.db, profile.id, tz, {
        from: startOfLocalDay(addDays(date, -1), tz),
        to: startOfLocalDay(date, tz),
      }),
      listFocusAssignments(deps.db, profile.id),
      listWater(deps.db, profile.id, dayStart, dayEnd),
      listExercise(deps.db, profile.id, dayStart, dayEnd),
    ]);
    const focus = focusForDay(history, date, tz);
    const todayMeals = meals.map((meal) => {
      const match = focus ? mealSupportsFocus(meal, focus) : null;
      return { ...toApiMeal(meal), supportsFocus: match?.supports ?? null, focusReason: match?.reason ?? null };
    });
    return {
      date,
      targets: goalOf(profile)?.targets ?? null,
      totals: sumNutrition(meals.map((m) => m.totals)),
      meals: todayMeals,
      focus: focus ? FOCI[focus] : null,
      focusSummary: focus
        ? { supported: todayMeals.filter((m) => m.supportsFocus).length, total: todayMeals.length }
        : null,
      repeatableMealTypes: MEAL_ORDER.filter((t) => yesterdayMeals.some((m) => m.mealType === t)),
      water: { ml: water.reduce((s, w) => s + w.ml, 0), goalMl: WATER_GOAL_ML, entries: water },
      exercise: { burned: exercise.reduce((s, e) => s + e.calories, 0), entries: exercise },
      healthScore: healthScore(meals, goalOf(profile)?.targets ?? null, profile.diet),
    };
  });
}
