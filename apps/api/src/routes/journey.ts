import { WeighInRequest } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { computeJourney, journeyCalendar, onTargetStreak, weightCandidates } from "../domain/journey.js";
import { localDate } from "../domain/time.js";
import { badRequest, HttpError } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import { loadProgressInput } from "../progress-input.js";
import { unlock } from "../repo/achievements.js";
import { goalOf, type ProfileRow } from "../repo/profiles.js";
import { listWeighIns, upsertWeighIn } from "../repo/weigh-ins.js";

async function journeyFor(deps: Deps, profile: ProfileRow) {
  const goal = goalOf(profile);
  if (!goal) throw new HttpError(409, "GOAL_REQUIRED", "Set a goal first");
  const input = await loadProgressInput(deps, profile);
  const streak = onTargetStreak(input.meals, goal.effectiveTarget, input.today);
  // Demo profiles come with meals from before the profile existed, so start at whichever is earlier.
  const joined = localDate(new Date(profile.created_at), profile.timezone);
  const firstMeal = input.meals[0]?.localDate;
  const start = firstMeal && firstMeal < joined ? firstMeal : joined;
  return {
    ...computeJourney(goal, await listWeighIns(deps.db, profile.id), streak.days),
    ...journeyCalendar(input.meals, goal.effectiveTarget, start, input.today),
  };
}

export function journeyRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/journey", async (req) => {
    const profile = await requireProfile(deps, req);
    return journeyFor(deps, profile);
  });

  app.post("/weights", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    const body = parse(WeighInRequest, req.body);
    const now = deps.clock();
    const today = localDate(now, profile.timezone);
    const date = body.date ?? today;
    if (date > today) throw badRequest("VALIDATION_ERROR", "A weigh-in can't be in the future");

    const isFirst = (await listWeighIns(deps.db, profile.id)).length === 0;
    await upsertWeighIn(deps.db, profile.id, { date, kg: body.kg }, now);
    const journey = await journeyFor(deps, profile);

    const events = [];
    for (const c of weightCandidates(journey, isFirst)) {
      if (await unlock(deps.db, profile.id, c.key, c.event.type, now)) events.push(c.event);
    }
    // When several kilogram milestones unlock at once, celebrate only the latest one.
    const latestKg = events.filter((e) => e.type === "kg_progress").at(-1);
    reply.code(201);
    return { journey, events: events.filter((e) => e.type !== "kg_progress" || e === latestKg) };
  });
}
