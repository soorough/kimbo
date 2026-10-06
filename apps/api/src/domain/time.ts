import type { MealType } from "@kimbo/shared";
import { MEAL_TYPE_HOURS } from "./config.js";

/** YYYY-MM-DD of an instant in the given IANA timezone. */
export function localDate(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

export function localHour(instant: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(instant);
  return Number(hour);
}

/** Calendar arithmetic on YYYY-MM-DD strings. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

/** The UTC instant at which a local calendar date starts in a timezone. */
export function startOfLocalDay(date: string, timezone: string): Date {
  // Guess midnight UTC, then correct by the zone's offset at that moment (twice, for DST edges).
  let guess = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 2; i++) {
    const offsetMs = zoneOffsetMs(guess, timezone);
    guess = new Date(Date.parse(`${date}T00:00:00Z`) - offsetMs);
  }
  return guess;
}

function zoneOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function suggestMealType(instant: Date, timezone: string): MealType {
  const hour = localHour(instant, timezone);
  if (hour < MEAL_TYPE_HOURS.breakfastBefore) return "breakfast";
  if (hour < MEAL_TYPE_HOURS.lunchBefore) return "lunch";
  if (hour < MEAL_TYPE_HOURS.snackBefore) return "snack";
  return "dinner";
}
