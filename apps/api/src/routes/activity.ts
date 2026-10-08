import { ExerciseDraft, ExerciseEstimateRequest, WaterRequest } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { DEFAULT_WEIGHT_KG } from "../domain/config.js";
import { exerciseDraft, readExerciseByRules } from "../domain/exercise.js";
import { badRequest, notFound } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import { addExercise, deleteExercise } from "../repo/exercise.js";
import { goalOf, type ProfileRow } from "../repo/profiles.js";
import { addWater, deleteWater } from "../repo/water.js";
import { listWeighIns } from "../repo/weigh-ins.js";

/** Latest weigh-in, else the goal's starting weight, else a sensible default. */
export async function bodyWeight(deps: Deps, profile: ProfileRow): Promise<number> {
  const w = await listWeighIns(deps.db, profile.id);
  return w.at(-1)?.kg ?? goalOf(profile)?.weightKg ?? DEFAULT_WEIGHT_KG;
}

/** Reads a described workout (model first, rules if it's unavailable) and prices it with Kimbo's MET table. */
export async function describeExercise(deps: Deps, profile: ProfileRow, text: string): Promise<ExerciseDraft> {
  const read = await deps.exerciseReader.readExercise(text).catch(() => readExerciseByRules(text));
  // Without a duration, half an hour is the honest middle; the user can edit the calories.
  return exerciseDraft(read.kind, read.intensity, read.minutes ?? 30, await bodyWeight(deps, profile), read.activity);
}

function when(deps: Deps, iso: string | undefined): Date {
  const now = deps.clock();
  const at = iso ? new Date(iso) : now;
  if (at.getTime() > now.getTime() + 60_000) throw badRequest("VALIDATION_ERROR", "That's in the future");
  return at;
}

export function activityRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/water", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    const body = parse(WaterRequest, req.body);
    reply.code(201);
    return { entry: await addWater(deps.db, profile.id, body.ml, when(deps, body.loggedAt)) };
  });

  app.delete<{ Params: { id: string } }>("/water/:id", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    if (!(await deleteWater(deps.db, profile.id, req.params.id))) throw notFound("Water entry");
    reply.code(204);
  });

  /** Nothing is saved here: it returns a draft the user confirms (and may edit) before logging. */
  app.post("/exercise/estimate", async (req) => {
    const profile = await requireProfile(deps, req);
    const body = parse(ExerciseEstimateRequest, req.body);
    if ("text" in body) return { draft: await describeExercise(deps, profile, body.text) };
    return { draft: exerciseDraft(body.kind, body.intensity, body.minutes, await bodyWeight(deps, profile)) };
  });

  app.post("/exercise", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    const body = parse(ExerciseDraft, req.body);
    reply.code(201);
    return { entry: await addExercise(deps.db, profile.id, body, when(deps, body.loggedAt)) };
  });

  app.delete<{ Params: { id: string } }>("/exercise/:id", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    if (!(await deleteExercise(deps.db, profile.id, req.params.id))) throw notFound("Workout");
    reply.code(204);
  });
}
