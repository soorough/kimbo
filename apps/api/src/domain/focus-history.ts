import type { FocusKey } from "@kimbo/shared";
import type { FocusAssignment } from "../repo/reports.js";
import { addDays, startOfLocalDay } from "./time.js";

/**
 * The focus that applies to a calendar day: the latest one assigned before the day ends.
 * So a report confirmed at 3pm applies to that morning's meals too.
 */
export function focusForDay(history: FocusAssignment[], date: string, timezone: string): FocusKey | null {
  const dayEnd = startOfLocalDay(addDays(date, 1), timezone).getTime();
  let focus: FocusKey | null = null;
  for (const a of history) if (a.activeFrom.getTime() < dayEnd) focus = a.focus;
  return focus;
}
