import {
  AskRequest,
  type AskResponse,
  type AssistantHomeResponse,
  type AssistantQuestion,
  type KimboMood,
} from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Deps } from "../app.js";
import { answer, factSheet, greeting, SAFE_MOODS, suggestions, type AssistantContext } from "../domain/assistant.js";
import { sumNutrition } from "../domain/catalogue.js";
import { focusForDay } from "../domain/focus-history.js";
import { mealSupportsFocus } from "../domain/focus-match.js";
import { MARKER_FOCUS } from "../domain/health.js";
import { weekStats } from "../domain/progress.js";
import { localHour, suggestMealType } from "../domain/time.js";
import { HttpError } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import { loadProgressInput } from "../progress-input.js";
import { goalOf, type ProfileRow } from "../repo/profiles.js";
import { listReports } from "../repo/reports.js";
import { listWeighIns } from "../repo/weigh-ins.js";

const GOAL_LABEL = { lose: "lose weight", maintain: "stay where I am", build_muscle: "build muscle", recomp: "build muscle, keep weight" } as const;

/** Gathers what Kimbo knows about the user. Every number is Kimbo's own (catalogue + rules). */
async function contextFor(deps: Deps, profile: ProfileRow): Promise<AssistantContext> {
  const now = deps.clock();
  const [input, reports, weighIns] = await Promise.all([
    loadProgressInput(deps, profile),
    listReports(deps.db, profile.id),
    listWeighIns(deps.db, profile.id),
  ]);
  const todays = input.meals.filter((m) => m.localDate === input.today);
  const focus = focusForDay(input.focusHistory, input.today, input.timezone);
  const goal = goalOf(profile);
  const week = weekStats(input, input.today);
  const latest = reports[0] ?? null;
  return {
    name: profile.name,
    hour: localHour(now, profile.timezone),
    nextMeal: nextMealType(suggestMealType(now, profile.timezone), todays.map((m) => m.mealType)),
    targets: goal?.targets ?? null,
    totals: sumNutrition(todays.map((m) => m.totals)),
    todayMeals: todays.map((m) => ({
      mealType: m.mealType,
      dishes: m.items.map((i) => i.name),
      supportsFocus: focus ? mealSupportsFocus(m, focus).supports : null,
    })),
    focus,
    marker: focus && latest ? (latest.markers.find((r) => MARKER_FOCUS[r.marker] === focus) ?? null) : null,
    diet: profile.diet,
    barriers: profile.barriers ?? [],
    week: {
      daysLogged: week.trackedDates.length,
      daysElapsed: week.daysElapsed,
      focusHelped: week.focus?.supported ?? 0,
      focusTotal: week.focus?.total ?? 0,
      onTargetDays: week.goalDaysMet,
    },
    goal: goal
      ? { label: GOAL_LABEL[goal.goal], targetKg: goal.targetWeightKg, currentKg: weighIns.at(-1)?.kg ?? goal.weightKg }
      : null,
  };
}

/** The meal the clock suggests, unless it's already logged: then the next one not yet logged. */
function nextMealType(suggested: AssistantContext["nextMeal"], logged: AssistantContext["nextMeal"][]) {
  const order = ["breakfast", "lunch", "snack", "dinner"] as const;
  const from = order.indexOf(suggested);
  return order.slice(from).find((m) => !logged.includes(m)) ?? suggested;
}

/** Without a language model, typed questions are matched to the closest starter answer. */
function closestQuestion(text: string): AssistantQuestion {
  const t = text.toLowerCase();
  if (/(why|focus|report|ldl|hba1c|cholesterol|sugar|triglycer|fibre|fiber)/.test(t)) return "why_focus";
  if (/(how am i|doing|week|progress|streak|on track)/.test(t)) return "how_am_i_doing";
  return "what_to_eat";
}

function isAboutEating(text: string): boolean {
  return /\b(eat|eating|ate|meal|breakfast|lunch|dinner|snack|food|dish|cook|have for|hungry)\b/i.test(text);
}

const SpeakRequest = z.object({ text: z.string().trim().min(1).max(800) });
const ListenRequest = z.object({ audioBase64: z.string().min(1), mimeType: z.string() });

export function assistantRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/assistant", async (req): Promise<AssistantHomeResponse> => {
    const ctx = await contextFor(deps, await requireProfile(deps, req));
    return { greeting: greeting(ctx), suggestions: suggestions(ctx) };
  });

  app.post("/assistant/ask", async (req): Promise<AskResponse> => {
    const profile = await requireProfile(deps, req);
    const body = parse(AskRequest, req.body);
    const ctx = await contextFor(deps, profile);
    if ("question" in body) return { reply: answer(body.question, ctx) };
    if (!deps.coach) return { reply: answer(closestQuestion(body.text), ctx) };
    const out = await deps.coach.reply({ question: body.text, facts: factSheet(ctx), history: body.history ?? [] });
    // Actions stay rule-made: logging is offered only when the question is about eating.
    const aboutFood = isAboutEating(body.text);
    return {
      reply: {
        mood: SAFE_MOODS.includes(out.mood as KimboMood) ? (out.mood as KimboMood) : "happy",
        text: out.text,
        points: out.points.slice(0, 4),
        actions: aboutFood ? answer("what_to_eat", ctx).actions : [],
      },
    };
  });

  // GET so the app's audio player can stream it directly (with the profile header).
  app.get<{ Querystring: { text?: string } }>("/assistant/speak", async (req, reply) => {
    await requireProfile(deps, req);
    if (!deps.voice) throw new HttpError(503, "VOICE_UNAVAILABLE", "Kimbo's voice isn't set up", true);
    const { text } = parse(SpeakRequest, req.query);
    const audio = await deps.voice.speak(text);
    return reply.type("audio/mpeg").send(audio);
  });

  app.post("/assistant/listen", async (req) => {
    await requireProfile(deps, req);
    if (!deps.voice) throw new HttpError(503, "VOICE_UNAVAILABLE", "Kimbo can't listen right now", true);
    const { audioBase64, mimeType } = parse(ListenRequest, req.body);
    return { text: await deps.voice.transcribe({ base64: audioBase64, mimeType }) };
  });
}
