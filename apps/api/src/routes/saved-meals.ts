import { RenameSavedMealRequest, SaveMealRequest, type SavedMeal } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { sumNutrition } from "../domain/catalogue.js";
import { resolveConfirmedItems } from "../domain/confirm-meal.js";
import { toDraftItem } from "../domain/recent-meals.js";
import { suggestMealType } from "../domain/time.js";
import { notFound } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import type { ProfileRow } from "../repo/profiles.js";
import { deleteSavedMeal, insertSavedMeal, listSavedMeals, renameSavedMeal, type SavedMealRow } from "../repo/saved-meals.js";

export function savedMealRoutes(app: FastifyInstance, deps: Deps) {
  const toApi = (row: SavedMealRow, profile: ProfileRow): SavedMeal => {
    const items = row.items.map(toDraftItem);
    const totals = sumNutrition(items.map((i) => i.nutrition));
    return {
      id: row.id,
      name: row.name,
      calories: Math.round(totals.calories),
      draft: { items, totals, suggestedMealType: suggestMealType(deps.clock(), profile.timezone) },
    };
  };

  app.get("/saved-meals", async (req) => {
    const profile = await requireProfile(deps, req);
    return { meals: (await listSavedMeals(deps.db, profile.id)).map((r) => toApi(r, profile)) };
  });

  app.post("/saved-meals", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    const body = parse(SaveMealRequest, req.body);
    const row = await insertSavedMeal(deps.db, profile.id, body.name, resolveConfirmedItems(body.items), deps.clock());
    reply.code(201);
    return { meal: toApi(row, profile) };
  });

  app.patch<{ Params: { id: string } }>("/saved-meals/:id", async (req) => {
    const profile = await requireProfile(deps, req);
    const { name } = parse(RenameSavedMealRequest, req.body);
    const row = await renameSavedMeal(deps.db, profile.id, req.params.id, name);
    if (!row) throw notFound("Saved meal");
    return { meal: toApi(row, profile) };
  });

  app.delete<{ Params: { id: string } }>("/saved-meals/:id", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    if (!(await deleteSavedMeal(deps.db, profile.id, req.params.id))) throw notFound("Saved meal");
    reply.code(204);
  });
}
