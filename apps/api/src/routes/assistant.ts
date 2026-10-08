import {
  AskRequest,
  type AskResponse,
  type AssistantHomeResponse,
  type AssistantQuestion,
  type AssistantReply,
  type KimboMood,
} from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Deps } from "../app.js";
import {
  answer,
  factSheet,
  greeting,
  greetingFacts,
  greetingIsSafe,
  mealIdea,
  pastMealsFor,
  SAFE_MOODS,
  suggestions,
  type AssistantContext,
} from "../domain/assistant.js";
import { sumNutrition } from "../domain/catalogue.js";
import { focusForDay } from "../domain/focus-history.js";
import { mealSupportsFocus } from "../domain/focus-match.js";
import { MARKER_FOCUS } from "../domain/health.js";
import { consistencyStreak, trackedDateSet, weekStats } from "../domain/progress.js";
import { WATER_GOAL_ML } from "../domain/config.js";
import { looksLikeExercise } from "../domain/exercise.js";
import { addDays, localDate, localHour, startOfLocalDay, suggestMealType } from "../domain/time.js";
import { readWater, WATER_SIZES } from "../domain/water.js";
import { listExercise } from "../repo/exercise.js";
import { listWater } from "../repo/water.js";
import { describeExercise } from "./activity.js";
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
  const today = localDate(now, profile.timezone);
  const dayStart = startOfLocalDay(today, profile.timezone);
  const dayEnd = startOfLocalDay(addDays(today, 1), profile.timezone);
  const [input, reports, weighIns, water, workouts] = await Promise.all([
    loadProgressInput(deps, profile),
    listReports(deps.db, profile.id),
    listWeighIns(deps.db, profile.id),
    listWater(deps.db, profile.id, dayStart, dayEnd),
    listExercise(deps.db, profile.id, dayStart, dayEnd),
  ]);
  const burned = workouts.reduce((s, w) => s + w.calories, 0);
  const todays = input.meals.filter((m) => m.localDate === input.today);
  const focus = focusForDay(input.focusHistory, input.today, input.timezone);
  const goal = goalOf(profile);
  const week = weekStats(input, input.today);
  const latest = reports[0] ?? null;
  const nextMeal = nextMealType(suggestMealType(now, profile.timezone), todays.map((m) => m.mealType));
  return {
    name: profile.name,
    hour: localHour(now, profile.timezone),
    nextMeal,
    // Exercise earns back calories, so what's "left" today includes what was burned.
    targets: goal ? { ...goal.targets, calories: goal.targets.calories + burned } : null,
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
      ? {
          label: GOAL_LABEL[goal.goal],
          targetKg: goal.targetWeightKg,
          currentKg: weighIns.at(-1)?.kg ?? goal.weightKg,
          startKg: goal.weightKg,
        }
      : null,
    waterMl: water.reduce((s, w) => s + w.ml, 0),
    waterGoalMl: WATER_GOAL_ML,
    workouts: workouts.map((w) => ({ label: w.label, minutes: w.minutes, calories: w.calories })),
    streak: consistencyStreak(trackedDateSet(input.meals), input.today, input.meals[0]?.localDate ?? input.today),
    pastMeals: pastMealsFor(input.meals, nextMeal, input.today, focus),
  };
}

const GREET_TIMEOUT_MS = 2500;
const GREETING_CACHE_MAX = 1000;
/** One worded line per profile per state of the day, so opening the app again costs nothing. */
const greetings = new Map<string, AssistantReply>();

/**
 * After a meal that helped, the language model words Today's line from Kimbo's facts, so it
 * sounds like Kimbo knows them. Kimbo picks the idea and its kcal; the model's line is used
 * only when it passes the check, and Kimbo's own line stands in if the model is slow or down.
 */
async function personalGreeting(deps: Deps, profileId: string, ctx: AssistantContext): Promise<AssistantReply> {
  const rule = greeting(ctx);
  const idea = mealIdea(ctx);
  if (!deps.coach || rule.mood !== "proud" || !idea) return rule;
  const key = `${profileId}|${ctx.todayMeals.length}|${rule.text}`;
  const cached = greetings.get(key);
  if (cached) return cached;

  const facts = greetingFacts(ctx, idea);
  const worded = deps.coach
    .greet({ facts })
    .then((out): AssistantReply => {
      const reply = greetingIsSafe(out.text, idea, facts)
        ? {
            ...rule,
            mood: SAFE_MOODS.includes(out.mood as KimboMood) ? (out.mood as KimboMood) : rule.mood,
            text: out.text.trim(),
          }
        : rule;
      remember(key, reply);
      return reply;
    })
    // Unavailable: don't remember, so the next open tries again.
    .catch(() => rule);
  // Slow: show Kimbo's own line now; the worded one is remembered for the next open.
  const timeout = new Promise<AssistantReply>((resolve) => setTimeout(() => resolve(rule), GREET_TIMEOUT_MS));
  return Promise.race([worded, timeout]);
}

function remember(key: string, reply: AssistantReply) {
  if (greetings.size >= GREETING_CACHE_MAX) greetings.delete(greetings.keys().next().value!);
  greetings.set(key, reply);
}

/** The meal the clock suggests, unless it's already logged: then the next one not yet logged. */
function nextMealType(suggested: AssistantContext["nextMeal"], logged: AssistantContext["nextMeal"][]) {
  const order = ["breakfast", "lunch", "snack", "dinner"] as const;
  const from = order.indexOf(suggested);
  return order.slice(from).find((m) => !logged.includes(m)) ?? suggested;
}

/**
 * "I drank 2 glasses of water", "went for a 30 min jog": Kimbo offers to log it, with the amount
 * or calories worked out by its own rules. Nothing is saved until the user taps the action.
 */
async function chatLog(deps: Deps, profile: ProfileRow, ctx: AssistantContext, text: string): Promise<AssistantReply | null> {
  if (/\?\s*$/.test(text) && /\b(how|what|should|can|is|did)\b/i.test(text)) return null; // a question, not a log
  const water = readWater(text);
  if (water.mentioned) {
    const ml = water.ml ?? WATER_SIZES.glass;
    const after = ctx.waterMl + ml;
    return {
      mood: "happy",
      text: water.ml
        ? `${ml.toLocaleString("en-IN")} ml of water, nice.${after >= ctx.waterGoalMl ? " That gets you to today's water goal!" : ""}`
        : "How much was it? A glass is about 250 ml.",
      points: [],
      actions: [{ kind: "log_water", label: water.ml ? `Log ${ml.toLocaleString("en-IN")} ml` : "Log a glass", ml }],
    };
  }
  if (looksLikeExercise(text)) {
    const draft = await describeExercise(deps, profile, text);
    return {
      mood: "cheer",
      text: `${draft.label}${draft.minutes ? `, ${draft.minutes} min` : ""}: about ${draft.calories} kcal burned. I'll add that to today's calorie budget.`,
      points: [],
      actions: [{ kind: "log_exercise", label: "Log it", draft }],
    };
  }
  return null;
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
    const profile = await requireProfile(deps, req);
    const ctx = await contextFor(deps, profile);
    return { greeting: await personalGreeting(deps, profile.id, ctx), suggestions: suggestions(ctx) };
  });

  app.post("/assistant/ask", async (req): Promise<AskResponse> => {
    const profile = await requireProfile(deps, req);
    const body = parse(AskRequest, req.body);
    const ctx = await contextFor(deps, profile);
    if ("question" in body) return { reply: answer(body.question, ctx) };
    const logged = await chatLog(deps, profile, ctx, body.text);
    if (logged) return { reply: logged };
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
