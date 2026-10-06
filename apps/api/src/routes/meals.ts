import { ParseMealRequest } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { search } from "../domain/catalogue.js";
import { buildDraft } from "../domain/meal-draft.js";
import { suggestMealType } from "../domain/time.js";
import { parse, requireProfile } from "../http.js";

export function mealRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/meals/parse", async (req) => {
    const profile = await requireProfile(deps, req);
    const body = parse(ParseMealRequest, req.body);
    const candidates =
      "text" in body
        ? await deps.recognizer.fromText(body.text)
        : await deps.recognizer.fromImage({ base64: body.imageBase64, mimeType: body.mimeType });
    return buildDraft(candidates, suggestMealType(deps.clock(), profile.timezone));
  });

  app.get<{ Querystring: { q?: string } }>("/foods/search", async (req) => {
    await requireProfile(deps, req);
    return { foods: search(req.query.q ?? "") };
  });
}
