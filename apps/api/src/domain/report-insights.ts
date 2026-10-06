import type { FocusKey, FoodTag, Report, ReportInsights } from "@kimbo/shared";
import type { StoredMeal } from "../repo/meals.js";
import type { FocusAssignment } from "../repo/reports.js";
import { mealSupportsFocus } from "./focus-match.js";
import { FOCI, MARKER_FOCUS } from "./health.js";
import { addDays, daysBetween, localDate, weekStart } from "./time.js";

const MAX_WEEKS = 8;
const MAX_HELPERS = 3;
/** Dishes worth naming as helpers: the ones that carry a "good" tag, not every item on the plate. */
const HELPER_TAGS: FoodTag[] = ["fibre_rich", "lean_protein"];
const MAX_CUT_BACK = 4;
/** What works against each focus, in the order used to name the reason. Balanced plate: nothing flagged. */
const AGAINST: Record<FocusKey, FoodTag[]> = {
  fibre_focus: ["high_sat_fat", "fried"],
  steady_carbs: ["high_sugar", "refined_carb"],
  less_sugar_refined: ["high_sugar", "fried", "refined_carb"],
  balanced_plate: [],
};
const REASON: Partial<Record<FoodTag, string>> = {
  high_sat_fat: "high in saturated fat",
  fried: "fried",
  high_sugar: "sweet",
  refined_carb: "refined carbs",
};

export interface InsightsInput {
  /** newest first */
  reports: Report[];
  /** oldest first */
  focusHistory: FocusAssignment[];
  meals: StoredMeal[];
  today: string;
  timezone: string;
}

export function reportInsights(i: InsightsInput): ReportInsights | null {
  const latest = i.reports[0];
  const current = i.focusHistory.at(-1);
  if (!latest || !current) return null;

  const since = localDate(current.activeFrom, i.timezone);
  const judged = i.meals
    .filter((m) => m.localDate >= since && m.localDate <= i.today)
    .map((m) => ({ meal: m, supports: mealSupportsFocus(m, current.focus).supports }));
  const supported = judged.filter((j) => j.supports).length;

  const weeks: ReportInsights["weeks"] = [];
  for (let w = weekStart(since); w <= weekStart(i.today); w = addDays(w, 7)) {
    const inWeek = judged.filter((j) => weekStart(j.meal.localDate) === w);
    weeks.push({ weekStart: w, supported: inWeek.filter((j) => j.supports).length, total: inWeek.length });
  }

  const counts = new Map<string, number>();
  for (const j of judged.filter((x) => x.supports)) {
    for (const item of j.meal.items) {
      if (item.tags.some((t) => HELPER_TAGS.includes(t))) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    }
  }
  const helpers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_HELPERS)
    .map(([name]) => name);

  // Every marker worth watching counts, the one behind the focus first (it names the reason).
  const watched = latest.markers
    .filter((m) => m.status !== "in_range")
    .sort((a, b) => Number(MARKER_FOCUS[b.marker] === current.focus) - Number(MARKER_FOCUS[a.marker] === current.focus));
  const against = [...new Set(watched.flatMap((m) => AGAINST[MARKER_FOCUS[m.marker]]))];
  const flagged = new Map<string, { times: number; reason: string; tags: FoodTag[] }>();
  for (const j of judged) {
    for (const item of j.meal.items) {
      const tag = against.find((t) => item.tags.includes(t));
      if (!tag) continue;
      const seen = flagged.get(item.name);
      flagged.set(item.name, { times: (seen?.times ?? 0) + 1, reason: REASON[tag]!, tags: item.tags });
    }
  }
  const byCount = [...flagged.entries()].sort((a, b) => b[1].times - a[1].times);
  // Each marker worth watching gets its most-eaten dish first, so one marker can't crowd out another.
  const picked = new Set<string>();
  for (const m of watched) {
    const tags = AGAINST[MARKER_FOCUS[m.marker]];
    const top = byCount.find(([name, v]) => !picked.has(name) && v.tags.some((t) => tags.includes(t)));
    if (top) picked.add(top[0]);
  }
  for (const [name] of byCount) if (picked.size < MAX_CUT_BACK) picked.add(name);
  const cutBackOn = byCount
    .filter(([name]) => picked.has(name))
    .map(([name, v]) => ({ name, times: v.times, reason: v.reason }));

  const markerFor = (focus: FocusAssignment | undefined) =>
    focus ? latest.markers.find((m) => MARKER_FOCUS[m.marker] === focus.focus) : undefined;
  const marker = markerFor(current) ?? null;
  // Once a marker is back in range the focus moves on; compare the one the last focus was about.
  const compared = marker ?? markerFor(i.focusHistory.at(-2));
  const earlier = compared ? i.reports[1]?.markers.find((m) => m.marker === compared.marker) : undefined;

  return {
    reportDate: latest.reportDate,
    since,
    daysSinceReport: daysBetween(latest.reportDate, i.today),
    focus: { key: current.focus, title: FOCI[current.focus].title },
    marker,
    supported,
    total: judged.length,
    pct: judged.length ? Math.round((supported / judged.length) * 100) : 0,
    weeks: weeks.slice(-MAX_WEEKS),
    helpers,
    cutBackOn,
    cutBackFor: watched.map((m) => m.label),
    compare:
      compared && earlier
        ? {
            marker: compared.marker,
            label: compared.label,
            unit: compared.unit,
            before: { value: earlier.value, reportDate: i.reports[1]!.reportDate },
            after: { value: compared.value, reportDate: latest.reportDate },
          }
        : null,
  };
}
