import { ConfirmMealRequest, LocalDate, ParseMealRequest, type KimboEvent } from "@kimbo/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Deps } from "../app.js";
import { search } from "../domain/catalogue.js";
import { resolveConfirmedItems } from "../domain/confirm-meal.js";
import { focusForDay } from "../domain/focus-history.js";
import { mealSupportsFocus, supportedMessage } from "../domain/focus-match.js";
import { buildDraft } from "../domain/meal-draft.js";
import { addDays, localDate, startOfLocalDay, suggestMealType } from "../domain/time.js";
import { badRequest, notFound } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import { unlockMilestones } from "../progress-input.js";
import { deleteMeal, getMeal, insertMeal, listMeals, replaceMeal, toApiMeal, type MealWrite } from "../repo/meals.js";
import type { ProfileRow } from "../repo/profiles.js";
import { listFocusAssignments } from "../repo/reports.js";

/** Small grace for device clocks running slightly ahead of the server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

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

  app.post("/meals", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    const write = toMealWrite(deps, req);
    const id = await insertMeal(deps.db, profile.id, write, deps.clock());
    reply.code(201);
    return respondWithMeal(deps, profile, id, write);
  });

  app.patch<{ Params: { id: string } }>("/meals/:id", async (req) => {
    const profile = await requireProfile(deps, req);
    const existing = await getMeal(deps.db, profile.id, profile.timezone, req.params.id);
    if (!existing) throw notFound("Meal");
    const write = toMealWrite(deps, req);
    await replaceMeal(deps.db, profile.id, existing.id, write);
    return respondWithMeal(deps, profile, existing.id, write);
  });

  app.delete<{ Params: { id: string } }>("/meals/:id", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    if (!(await deleteMeal(deps.db, profile.id, req.params.id))) throw notFound("Meal");
    reply.code(204);
  });

  app.get<{ Querystring: { date?: string } }>("/meals", async (req) => {
    const profile = await requireProfile(deps, req);
    const date = req.query.date ? parse(LocalDate, req.query.date) : localDate(deps.clock(), profile.timezone);
    const meals = await listMeals(deps.db, profile.id, profile.timezone, {
      from: startOfLocalDay(date, profile.timezone),
      to: startOfLocalDay(addDays(date, 1), profile.timezone),
    });
    return { meals: meals.map(toApiMeal) };
  });
}

function toMealWrite(deps: Deps, req: FastifyRequest): MealWrite {
  const body = parse(ConfirmMealRequest, req.body);
  const now = deps.clock();
  const eatenAt = body.eatenAt ? new Date(body.eatenAt) : now;
  if (eatenAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw badRequest("VALIDATION_ERROR", "A meal can't be logged in the future");
  }
  return {
    mealType: body.mealType,
    eatenAt,
    source: body.source,
    wasCorrected: body.wasCorrected,
    items: resolveConfirmedItems(body.items),
  };
}

async function respondWithMeal(deps: Deps, profile: ProfileRow, id: string, write: MealWrite) {
  const meal = (await getMeal(deps.db, profile.id, profile.timezone, id))!;
  const focus = focusForDay(await listFocusAssignments(deps.db, profile.id), meal.localDate, profile.timezone);
  const focusResult = focus ? mealSupportsFocus(meal, focus) : null;
  const events: KimboEvent[] = [];
  if (write.wasCorrected) events.push({ type: "correction_accepted", message: "Thanks for the fix — saved just as you ate it." });
  if (focusResult?.supports) events.push({ type: "meal_supported_focus", message: supportedMessage(focusResult.focus) });
  events.push(...(await unlockMilestones(deps, profile)));
  return { meal: toApiMeal(meal), focusResult, events };
}
