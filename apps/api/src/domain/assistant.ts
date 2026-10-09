import type {
  AssistantAction,
  DraftItem,
  MealDraft,
  AssistantQuestion,
  AssistantReply,
  AssistantSuggestion,
  Barrier,
  Diet,
  FocusKey,
  FoodTag,
  KimboMood,
  MacroTargets,
  MarkerReading,
  MealType,
  Nutrition,
} from "@kimbo/shared";
import type { StoredMeal } from "../repo/meals.js";
import { CATALOGUE, type CatalogueEntry } from "./catalogue-data.js";
import { getEntry, nutritionFor, perUnit, sumNutrition, toFood } from "./catalogue.js";
import { GOAL_BAND_PCT } from "./config.js";
import { eats } from "./diet.js";
import { mealSupportsFocus } from "./focus-match.js";
import { FOCI } from "./health.js";
import { mealKey, RECENT_LOOKBACK_DAYS, toDraftItem } from "./recent-meals.js";
import { addDays } from "./time.js";

/** Everything Kimbo knows about the user right now. All numbers come from Kimbo's own rules. */
export interface AssistantContext {
  name: string | null;
  hour: number;
  nextMeal: MealType;
  /** false once the meal the clock suggests is logged: Today's nudge waits for the next meal time */
  mealDue: boolean;
  targets: MacroTargets | null;
  totals: Nutrition;
  todayMeals: { mealType: MealType; dishes: string[]; supportsFocus: boolean | null }[];
  focus: FocusKey | null;
  /** the reading that set the focus, if any */
  marker: MarkerReading | null;
  diet: Diet | null;
  barriers: Barrier[];
  week: { daysLogged: number; daysElapsed: number; focusHelped: number; focusTotal: number; onTargetDays: number | null };
  goal: { label: string; targetKg: number | null; currentKg: number | null; startKg: number | null } | null;
  /** days in a row with something logged */
  streak: number;
  waterMl: number;
  waterGoalMl: number;
  /** today's logged workouts; their calories are already added to targets.calories */
  workouts: { label: string; minutes: number | null; calories: number }[];
  /** distinct meals eaten before today at the next meal's time, most often first */
  pastMeals: PastMeal[];
}

/** A meal the user has already eaten at this time of day, as they logged it. */
export interface PastMeal {
  label: string;
  /** at most two dishes, for a one-glance line: "rajma + steamed rice" */
  short: string;
  kcal: number;
  times: number;
  supportsFocus: boolean | null;
  /** the meal as they last logged it, ready to log again */
  draft: MealDraft;
}

/** The user's own history for one meal slot: same dishes in the same portions count as one meal. */
export function pastMealsFor(meals: StoredMeal[], mealType: MealType, today: string, focus: FocusKey | null): PastMeal[] {
  const since = addDays(today, -RECENT_LOOKBACK_DAYS);
  const groups = new Map<string, { latest: StoredMeal; times: number }>();
  for (const m of meals) {
    if (m.mealType !== mealType || m.localDate >= today || m.localDate < since) continue;
    const key = mealKey(m);
    const g = groups.get(key);
    if (!g) groups.set(key, { latest: m, times: 1 });
    else {
      g.times++;
      if (m.eatenAt > g.latest.eatenAt) g.latest = m;
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.times - a.times || b.latest.eatenAt.localeCompare(a.latest.eatenAt))
    .map(({ latest, times }) => ({
      label: list(latest.items.map((i) => i.name.toLowerCase())),
      short: shortName(latest.items.map((i) => i.name)),
      kcal: Math.round(latest.totals.calories),
      times,
      supportsFocus: focus ? mealSupportsFocus(latest, focus).supports : null,
      draft: toDraft(latest.items.map(toDraftItem), mealType),
    }));
}

function toDraft(items: DraftItem[], mealType: MealType): MealDraft {
  return { items, totals: sumNutrition(items.map((i) => i.nutrition)), suggestedMealType: mealType };
}

/** One default serving of a catalogue dish, as a draft line. */
function catalogueLine(id: string): DraftItem[] {
  const e = getEntry(id);
  if (!e) return [];
  return [{ kind: "catalogue", food: toFood(e), heardAs: e.name, quantity: 1, unit: e.defaultUnit, nutrition: nutritionFor(e, 1, e.defaultUnit) }];
}

/** The past meal to eat again: fits what's left today, helps the focus if one does, most eaten first. */
export function suggestFromHistory(ctx: AssistantContext): PastMeal | null {
  const left = ctx.targets ? ctx.targets.calories - ctx.totals.calories : null;
  if (left !== null && left <= 0) return null;
  const fits = ctx.pastMeals.filter((m) => left === null || m.kcal <= left);
  return fits.find((m) => m.supportsFocus) ?? fits.find((m) => m.supportsFocus !== false) ?? null;
}

/** "your usual X" when it's a habit, "X again" when it happened once. */
function pastMealPhrase(m: PastMeal): string {
  return m.times > 1 ? `your usual ${m.label}` : `${m.label} again`;
}

/** "Dal (toor/arhar)" reads as "dal"; more than two dishes keep only the first two. */
function shortName(names: string[]): string {
  return names
    .slice(0, 2)
    .map((n) => n.replace(/\s*\(.*?\)/g, "").toLowerCase())
    .join(" + ");
}


export interface MealIdea {
  meal: MealType;
  name: string;
  kcal: number;
  /** times they've eaten it before; 0 when it's a catalogue suggestion */
  times: number;
  draft: MealDraft;
  /** "completes": eating it lands today inside the goal band; "fits": still under it; null: no target */
  goal: "completes" | "fits" | null;
}

function goalAfter(ctx: AssistantContext, kcal: number): MealIdea["goal"] {
  if (!ctx.targets) return null;
  const after = ctx.totals.calories + kcal;
  return after >= ctx.targets.calories * (1 - GOAL_BAND_PCT / 100) ? "completes" : "fits";
}

/** The next meal Kimbo would suggest right now, or null when the day's target is already met. */
export function mealIdea(ctx: AssistantContext): MealIdea | null {
  const left = ctx.targets ? ctx.targets.calories - ctx.totals.calories : null;
  if (left !== null && left <= 0) return null;
  const past = suggestFromHistory(ctx);
  if (past)
    return { meal: ctx.nextMeal, name: past.short, kcal: past.kcal, times: past.times, draft: past.draft, goal: goalAfter(ctx, past.kcal) };
  const dish = suggestDishes(ctx)[0];
  return dish
    ? {
        meal: ctx.nextMeal,
        name: shortName([dish.name]),
        kcal: dish.kcal,
        times: 0,
        draft: toDraft(catalogueLine(dish.id), ctx.nextMeal),
        goal: goalAfter(ctx, dish.kcal),
      }
    : null;
}

/** Just the next move, the way a friend who knows their habits would put it. */
function nextMealOffer(ctx: AssistantContext, hi: string): string {
  const meal = MEAL_WORD[ctx.nextMeal];
  const idea = mealIdea(ctx);
  if (!idea) return ctx.targets ? `You're done for today${hi}, keep ${meal} light.` : `What's for ${meal}${hi}?`;
  // One sentence, always: the dish, the meal, and whether it fits or completes today's goal.
  const goal = idea.goal === "completes" ? " completes today's goal" : idea.goal === "fits" ? " fits today's goal" : "";
  const dish =
    idea.times > 1 ? `Your usual ${idea.name}` : idea.times === 1 ? `${capitalise(idea.name)} again` : capitalise(idea.name);
  return goal ? `${dish} for ${meal}${goal}${hi}.` : `${dish} for ${meal}${hi}?`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const BARRIER_TEXT: Record<Barrier, string> = {
  busy: "busy days",
  ideas: "running out of meal ideas",
  consistency: "staying consistent",
  eating_out: "eating out",
  cravings: "cravings",
};

/**
 * What Kimbo knows about this person, for the language model to write one line that feels
 * like a friend who knows them. Every number here is Kimbo's own; the model may not add any.
 */
export function greetingFacts(ctx: AssistantContext, idea: MealIdea): string {
  const part = ctx.hour < 12 ? "morning" : ctx.hour < 17 ? "afternoon" : ctx.hour < 21 ? "evening" : "late night";
  const usual = ctx.pastMeals.filter((m) => m.times > 1).slice(0, 2);
  const kg =
    ctx.goal?.startKg != null && ctx.goal.currentKg != null
      ? Math.round((ctx.goal.currentKg - ctx.goal.startKg) * 10) / 10
      : null;
  const lines = [
    `Name: ${ctx.name ?? "not given (don't use a name)"}`,
    `Time: ${part}`,
    ctx.focus ? `Food focus: ${FOCI[ctx.focus].title.toLowerCase()}` : null,
    ctx.streak >= 2 ? `Logging streak: ${ctx.streak} days in a row` : null,
    ctx.week.focusTotal > 0 ? `This week: ${ctx.week.focusHelped} of ${ctx.week.focusTotal} meals helped the focus` : null,
    ctx.goal ? `Goal: ${ctx.goal.label}` : null,
    kg !== null && kg !== 0 ? `Weight so far: ${kg < 0 ? "down" : "up"} ${Math.abs(kg)} kg since they started` : null,
    ctx.barriers.length ? `What gets in their way: ${ctx.barriers.map((b) => BARRIER_TEXT[b]).join(", ")}` : null,
    usual.length ? `Their usual ${ctx.nextMeal}: ${usual.map((m) => m.short).join("; ")}` : null,
    `Meal idea to suggest (use exactly): ${idea.name}, for ${MEAL_WORD[idea.meal]}${idea.times > 1 ? " — their usual" : idea.times === 1 ? " — they've had it once before" : " — something new"}`,
    idea.goal === "completes"
      ? "Eating it completes today's calorie goal"
      : idea.goal === "fits"
        ? "It fits within today's calorie goal (it won't complete it)"
        : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** The model's line is used only if it is short, names the idea, adds no numbers of its own and claims "complete" only when true. */
export function greetingIsSafe(text: string, idea: MealIdea, facts: string): boolean {
  const t = text.trim();
  if (t.length < 10 || t.length > 160) return false;
  if (!t.toLowerCase().includes(idea.name.split(" + ")[0]!)) return false;
  if (/complet/i.test(t) && idea.goal !== "completes") return false;
  // Exactly one short sentence on Today, with no tacked-on extra clause.
  if (t.split(/[.!?]+(?:\s+|$)/).filter((p) => p.trim()).length > 1) return false;
  if (t.split(/\s+/).length > 14 || /,\s*and\b/i.test(t)) return false;
  const known = new Set(facts.match(/\d+(\.\d+)?/g) ?? []);
  return (t.match(/\d+(\.\d+)?/g) ?? []).every((n) => known.has(n));
}

const MEAL_WORD: Record<MealType, string> = { breakfast: "breakfast", lunch: "lunch", snack: "a snack", dinner: "dinner" };

/** Dishes that make sense at each meal, so "what to eat" never offers biryani at 7am. */
const BY_MEAL: Record<MealType, string[]> = {
  breakfast: ["poha", "upma", "idli", "oats", "sprouts", "boiled_egg", "omelette", "dhokla", "fruit_bowl", "brown_bread", "banana"],
  lunch: ["dal_tadka", "rajma", "chole", "sambar", "roti", "brown_rice", "mixed_veg", "salad", "khichdi", "palak_paneer", "chicken_curry", "fish_curry", "egg_curry", "bhindi", "curd"],
  snack: ["roasted_chana", "sprouts", "guava", "apple", "fruit_bowl", "buttermilk", "boiled_egg", "papaya"],
  dinner: ["moong_dal", "dal_tadka", "roti", "mixed_veg", "salad", "khichdi", "saag", "cabbage_sabzi", "fish_curry", "chicken_curry", "egg_curry", "palak_paneer", "sambar"],
};

/** What helps each focus, best first. */
const HELPS: Record<FocusKey, FoodTag[]> = {
  fibre_focus: ["fibre_rich"],
  steady_carbs: ["fibre_rich", "lean_protein"],
  less_sugar_refined: ["fibre_rich", "lean_protein"],
  balanced_plate: ["lean_protein", "fibre_rich"],
};
const HURTS: Record<FocusKey, FoodTag[]> = {
  fibre_focus: ["high_sat_fat", "fried"],
  steady_carbs: ["high_sugar", "refined_carb"],
  less_sugar_refined: ["high_sugar", "fried", "refined_carb"],
  balanced_plate: [],
};

function servingKcal(e: CatalogueEntry): number {
  return Math.round(perUnit(e, e.defaultUnit).calories);
}

/** Up to three dishes for the next meal: eaten by this diet, good for the focus, within what's left. */
export function suggestDishes(ctx: AssistantContext): { id: string; name: string; kcal: number }[] {
  const left = ctx.targets ? ctx.targets.calories - ctx.totals.calories : null;
  const budget = left === null ? null : Math.max(150, left * (ctx.nextMeal === "snack" ? 0.4 : 0.8));
  const helps = ctx.focus ? HELPS[ctx.focus] : [];
  const hurts = ctx.focus ? HURTS[ctx.focus] : [];
  const pool = BY_MEAL[ctx.nextMeal]
    .map((id) => CATALOGUE.find((e) => e.id === id))
    .filter((e): e is CatalogueEntry => !!e && eats(ctx.diet, e.id) && !e.tags.some((t) => hurts.includes(t)));
  const score = (e: CatalogueEntry) => (e.tags.some((t) => helps.includes(t)) ? 0 : 1);
  const picked: { id: string; name: string; kcal: number }[] = [];
  let spent = 0;
  for (const e of [...pool].sort((a, b) => score(a) - score(b))) {
    const kcal = servingKcal(e);
    if (budget !== null && spent + kcal > budget && picked.length > 0) continue;
    picked.push({ id: e.id, name: e.name, kcal });
    spent += kcal;
    if (picked.length === 3) break;
  }
  return picked;
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const logAction = (meal: MealType, draft?: MealDraft): AssistantAction => ({
  kind: "log_meal",
  label: draft ? "Log it" : `Log ${meal === "snack" ? "a snack" : meal}`,
  mealType: meal,
  ...(draft ? { draft } : {}),
});

/** The line Kimbo opens with, chosen by the time of day and what's happened so far. */
export function greeting(ctx: AssistantContext): AssistantReply {
  const hi = ctx.name ? `, ${ctx.name}` : "";
  const logged = ctx.todayMeals.length;
  const helped = ctx.todayMeals.filter((m) => m.supportsFocus).length;
  if (ctx.hour >= 22 && logged === 0) {
    return { mood: "sleepy", text: `Late one${hi}. Want to log anything quickly before bed?`, points: [], actions: [logAction(ctx.nextMeal)] };
  }
  if (helped > 0 && !ctx.mealDue) {
    const allDone = ctx.todayMeals.some((m) => m.mealType === ctx.nextMeal);
    return {
      mood: "proud",
      text: allDone
        ? `That's today's meals logged${hi}. Nice work.`
        : `Logged${hi}. I'll suggest ${MEAL_WORD[ctx.nextMeal]} when it's time.`,
      points: [],
      actions: [],
    };
  }
  if (helped > 0) {
    return {
      mood: "proud",
      text: nextMealOffer(ctx, hi),
      points: [],
      actions: [logAction(ctx.nextMeal, mealIdea(ctx)?.draft)],
    };
  }
  const part = ctx.hour < 12 ? "Good morning" : ctx.hour < 17 ? "Good afternoon" : "Good evening";
  return {
    mood: "wave",
    text: `${part}${hi}! Ask me anything about your food, your report or your week.`,
    points: [],
    actions: [],
  };
}

export function suggestions(ctx: AssistantContext): AssistantSuggestion[] {
  return [
    { question: "what_to_eat", label: `What should I eat for ${MEAL_WORD[ctx.nextMeal]}?` },
    {
      question: "why_focus",
      label: ctx.focus ? `Why ${FOCI[ctx.focus].title.toLowerCase()}?` : "What does my blood report tell me?",
    },
    { question: "how_am_i_doing", label: "How am I doing this week?" },
  ];
}

export function answer(q: AssistantQuestion, ctx: AssistantContext): AssistantReply {
  switch (q) {
    case "what_to_eat": {
      const dishes = suggestDishes(ctx);
      const left = ctx.targets ? Math.round(ctx.targets.calories - ctx.totals.calories) : null;
      const total = dishes.reduce((s, d) => s + d.kcal, 0);
      const why =
        ctx.focus && ctx.focus !== "balanced_plate"
          ? ` It's ${FOCI[ctx.focus].title.toLowerCase()}, which is your focus.`
          : "";
      const budget =
        left === null
          ? ""
          : left <= 0
            ? " You're at today's target, so keep it light."
            : ` That's about ${total.toLocaleString("en-IN")} kcal of the ${left.toLocaleString("en-IN")} you have left.`;
      const past = suggestFromHistory(ctx);
      if (past) {
        const others = dishes.filter((d) => !past.label.includes(d.name.toLowerCase())).slice(0, 2);
        return {
          mood: "happy",
          text: `For ${MEAL_WORD[ctx.nextMeal]}, ${pastMealPhrase(past)} works: about ${past.kcal} kcal${left !== null ? ` of the ${left.toLocaleString("en-IN")} you have left` : ""}.${past.supportsFocus ? " It helped your focus last time too." : ""}${others.length ? ` Or try ${list(others.map((d) => d.name.toLowerCase()))}.` : ""}`,
          points: [
            `${past.label[0]!.toUpperCase()}${past.label.slice(1)} · about ${past.kcal} kcal · eaten ${past.times === 1 ? "once" : `${past.times} times`}`,
            ...others.map((d) => `${d.name} · about ${d.kcal} kcal`),
          ],
          actions: [logAction(ctx.nextMeal, past.draft)],
        };
      }
      return {
        mood: "happy",
        text: `For ${MEAL_WORD[ctx.nextMeal]}, try ${list(dishes.map((d) => d.name.toLowerCase()))}.${why}${budget}`,
        points: dishes.map((d) => `${d.name} · about ${d.kcal} kcal`),
        actions: [logAction(ctx.nextMeal)],
      };
    }
    case "why_focus": {
      if (!ctx.focus || !ctx.marker) {
        return {
          mood: "focus",
          text: "Add your blood report and I'll read your LDL, HbA1c and triglycerides, then pick one thing for you to eat more of.",
          points: [],
          actions: [{ kind: "open", label: "Add my report", screen: "report" }],
        };
      }
      const f = FOCI[ctx.focus];
      const m = ctx.marker;
      return {
        mood: "focus",
        text: `Your ${m.label} is ${m.value} ${m.unit}, which is ${m.statusLabel.toLowerCase()}. ${f.title} is the one food habit that helps most with that.`,
        points: f.description
          .split(". ")
          .map((s) => s.replace(/\.$/, ""))
          .filter(Boolean),
        actions: [{ kind: "open", label: "See my report", screen: "report" }],
      };
    }
    case "how_am_i_doing": {
      const w = ctx.week;
      if (w.daysLogged === 0) {
        return {
          mood: "wave",
          text: "Nothing logged this week yet. One meal today gets us going!",
          points: [],
          actions: [logAction(ctx.nextMeal)],
        };
      }
      const good = w.focusTotal > 0 && w.focusHelped / w.focusTotal >= 0.5;
      const points = [
        `${w.daysLogged} of ${w.daysElapsed} days logged`,
        w.focusTotal > 0 ? `${w.focusHelped} of ${w.focusTotal} meals helped your focus` : null,
        w.onTargetDays !== null ? `${w.onTargetDays} ${w.onTargetDays === 1 ? "day" : "days"} on your calorie target` : null,
      ].filter((p): p is string => p !== null);
      return {
        mood: good ? "proud" : "happy",
        text: good
          ? `You're doing really well${ctx.name ? `, ${ctx.name}` : ""}. Most of your meals are helping your focus.`
          : "Good start. A few more fibre-rich meals this week would make a real difference.",
        points,
        actions: [{ kind: "open", label: "See my progress", screen: "progress" }],
      };
    }
  }
}

/** Plain-text facts for the language model. Every number here was worked out by Kimbo's rules. */
export function factSheet(ctx: AssistantContext): string {
  const lines = [
    `Name: ${ctx.name ?? "not given"}`,
    `Local time: ${ctx.hour}:00. Next meal: ${ctx.nextMeal}.`,
    `Diet: ${ctx.diet ?? "not given"}. Things that get in the way: ${ctx.barriers.join(", ") || "not given"}.`,
    ctx.targets
      ? `Daily target: ${ctx.targets.calories} kcal; protein ${ctx.targets.protein} g, carbs ${ctx.targets.carbs} g, fat ${ctx.targets.fat} g, fibre ${ctx.targets.fibre} g or more, saturated fat under ${ctx.targets.satFat} g.`
      : "No calorie target set yet.",
    `Eaten today: ${Math.round(ctx.totals.calories)} kcal, protein ${Math.round(ctx.totals.protein)} g, fibre ${Math.round(ctx.totals.fibre)} g.`,
    `Water today: ${ctx.waterMl} ml of a ${ctx.waterGoalMl} ml goal.`,
    ctx.workouts.length
      ? `Exercise today: ${ctx.workouts.map((w) => `${w.label}${w.minutes ? ` ${w.minutes} min` : ""} (${w.calories} kcal burned)`).join("; ")}. Burned calories are already added to the daily target above.`
      : "No exercise logged today.",
    ctx.todayMeals.length
      ? `Meals today: ${ctx.todayMeals.map((m) => `${m.mealType}: ${m.dishes.join(", ")}${m.supportsFocus ? " (helped the focus)" : ""}`).join("; ")}.`
      : "No meals logged today.",
    ctx.focus && ctx.marker
      ? `Blood report: ${ctx.marker.label} ${ctx.marker.value} ${ctx.marker.unit} (${ctx.marker.statusLabel}). Food focus: ${FOCI[ctx.focus].title} — ${FOCI[ctx.focus].description}`
      : "No blood report yet.",
    `This week: ${ctx.week.daysLogged} of ${ctx.week.daysElapsed} days logged; ${ctx.week.focusHelped} of ${ctx.week.focusTotal} meals helped the focus.`,
    ctx.goal ? `Goal: ${ctx.goal.label}${ctx.goal.targetKg ? `, target ${ctx.goal.targetKg} kg` : ""}${ctx.goal.currentKg ? `, now ${ctx.goal.currentKg} kg` : ""}.` : "",
    ctx.pastMeals.length
      ? `What they've eaten before for ${ctx.nextMeal}: ${ctx.pastMeals.slice(0, 4).map((m) => `${m.label} (~${m.kcal} kcal, ${m.times}x${m.supportsFocus ? ", helped the focus" : ""})`).join("; ")}.`
      : "",
    `Dishes Kimbo can suggest for the next meal: ${suggestDishes(ctx).map((d) => `${d.name} (~${d.kcal} kcal)`).join(", ")}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Moods the model may pick; anything else falls back to happy. */
export const SAFE_MOODS: KimboMood[] = ["happy", "proud", "focus", "thinking", "wave", "cheer"];
