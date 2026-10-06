import { CreateProfileRequest, GoalRequest, NameRequest } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { TARGET_BOUNDS_KCAL } from "@kimbo/shared";
import { DEFAULT_TIMEZONE } from "../domain/config.js";
import { computeTarget, isTargetInBounds } from "../domain/goal.js";
import { seedDemoProfile } from "../domain/demo.js";
import { HttpError } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import { insertProfile, saveGoal, saveName, toProfile } from "../repo/profiles.js";

export function profileRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/profiles", async (req, reply) => {
    const body = parse(CreateProfileRequest, req.body);
    const timezone = body.timezone && isValidTimezone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE;
    let row = await insertProfile(deps.db, { isDemo: body.mode === "demo", timezone, createdAt: deps.clock() });
    if (body.mode === "demo") row = await seedDemoProfile(deps, row);
    reply.code(201);
    return { profile: toProfile(row) };
  });

  app.get<{ Params: { id: string } }>("/profiles/:id", async (req) => {
    const row = await requireOwnProfile(deps, req);
    return { profile: toProfile(row) };
  });

  app.put<{ Params: { id: string } }>("/profiles/:id/goal", async (req) => {
    const row = await requireOwnProfile(deps, req);
    const body = parse(GoalRequest, req.body);
    if (body.targetOverride !== undefined && !isTargetInBounds(body.targetOverride)) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        `Daily target must be between ${TARGET_BOUNDS_KCAL.min} and ${TARGET_BOUNDS_KCAL.max} kcal`,
      );
    }
    const { target } = computeTarget(body);
    const updated = await saveGoal(deps.db, row.id, body, target);
    return { profile: toProfile(updated) };
  });

  app.put<{ Params: { id: string } }>("/profiles/:id/name", async (req) => {
    const row = await requireOwnProfile(deps, req);
    const { name } = parse(NameRequest, req.body);
    return { profile: toProfile(await saveName(deps.db, row.id, name)) };
  });
}

async function requireOwnProfile(deps: Deps, req: Parameters<typeof requireProfile>[1] & { params: { id: string } }) {
  const row = await requireProfile(deps, req);
  if (row.id !== req.params.id) throw new HttpError(404, "PROFILE_NOT_FOUND", "Profile not found");
  return row;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
