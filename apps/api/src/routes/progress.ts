import { LocalDate, type ProgressResponse } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { welcomeBackCandidate } from "../domain/achievements.js";
import { FOCI } from "../domain/health.js";
import { consistencyStreak, focusComparable, insights, trackedDateSet, weekStats } from "../domain/progress.js";
import { addDays, localDate } from "../domain/time.js";
import { parse, requireProfile } from "../http.js";
import { loadProgressInput } from "../progress-input.js";
import { listAchievements, unlock } from "../repo/achievements.js";
import { lastMealBefore } from "../repo/meals.js";

export function progressRoutes(app: FastifyInstance, deps: Deps) {
  app.get<{ Querystring: { weekOf?: string } }>("/progress", async (req): Promise<ProgressResponse> => {
    const profile = await requireProfile(deps, req);
    const input = await loadProgressInput(deps, profile);
    const weekOf = req.query.weekOf ? parse(LocalDate, req.query.weekOf) : input.today;
    const week = weekStats(input, weekOf);
    const previous = weekStats(input, addDays(week.weekStart, -1));
    const earliest = input.meals[0]?.localDate ?? input.today;

    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      daysElapsed: week.daysElapsed,
      daysTracked: week.trackedDates.length,
      trackedDates: week.trackedDates,
      streak: consistencyStreak(trackedDateSet(input.meals), input.today, earliest),
      goal:
        week.goalDaysMet === null
          ? null
          : { daysMet: week.goalDaysMet, daysTracked: week.trackedDates.length, bandPct: 10 },
      focus: week.focus ? { ...week.focus, title: FOCI[week.focus.key].title } : null,
      weekOverWeek: {
        daysTracked: week.trackedDates.length - previous.trackedDates.length,
        goalDaysMet:
          week.goalDaysMet === null || previous.goalDaysMet === null ? null : week.goalDaysMet - previous.goalDaysMet,
        focusPct: focusComparable(week, previous) ? week.focus!.pct - previous.focus!.pct : null,
      },
      insights: insights(week),
      achievements: await listAchievements(deps.db, profile.id),
    };
  });

  app.post("/checkins", async (req) => {
    const profile = await requireProfile(deps, req);
    const now = deps.clock();
    const last = await lastMealBefore(deps.db, profile.id, now);
    const c = welcomeBackCandidate(last ? localDate(last, profile.timezone) : null, localDate(now, profile.timezone));
    const events = c && (await unlock(deps.db, profile.id, c.key, c.event.type, now)) ? [c.event] : [];
    return { events };
  });
}
