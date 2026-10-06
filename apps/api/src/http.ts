import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Deps } from "./app.js";
import { HttpError } from "./errors.js";
import { getProfile, type ProfileRow } from "./repo/profiles.js";

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  return schema.parse(data);
}

/** Resolves the anonymous device profile from the x-profile-id header. */
export async function requireProfile(deps: Deps, req: FastifyRequest): Promise<ProfileRow> {
  const id = req.headers["x-profile-id"];
  if (typeof id !== "string" || id.length === 0) {
    throw new HttpError(401, "PROFILE_REQUIRED", "Missing x-profile-id header");
  }
  const profile = await getProfile(deps.db, id);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Profile not found");
  return profile;
}
