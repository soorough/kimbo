import { describe, expect, it } from "vitest";
import { defaultGoal, useTestApp } from "./harness.js";

const api = useTestApp();

// "Now" for these tests: Fri 9 Oct 2026, 13:00 IST. The week runs Mon 5 – Sun 11 Oct.
const NOW = "2026-10-09T07:30:00Z";

async function onboarded() {
  api.ctx.clock.set("2026-09-01T07:30:00Z");
  const res = await api.post("/profiles", { mode: "fresh" });
  const id = res.json.profile.id as string;
  await api.put(`/profiles/${id}/goal`, defaultGoal, id); // 1980 kcal
  api.ctx.clock.set(NOW);
  return id;
}

/** 13:00 IST on the given date. */
const at = (date: string) => `${date}T07:30:00Z`;

const dalRoti = [
  { kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" },
  { kind: "catalogue", foodId: "dal_tadka", quantity: 1, unit: "katori" },
];
const paneerNaan = [
  { kind: "catalogue", foodId: "paneer_butter_masala", quantity: 1, unit: "katori" },
  { kind: "catalogue", foodId: "naan", quantity: 1, unit: "piece" },
];
const kcal = (calories: number) => [
  {
    kind: "estimate",
    name: "Home meal",
    quantity: 1,
    unit: "serving",
    nutrition: { calories, protein: 0, carbs: 0, fat: 0, fibre: 0, satFat: 0 },
  },
];

async function log(id: string, date: string, items: unknown[] = dalRoti) {
  const res = await api.post("/meals", { mealType: "lunch", source: "text", items, eatenAt: at(date) }, id);
  expect(res.status).toBe(201);
  return res.json;
}

async function setFocusAt(id: string, iso: string, markers: { marker: string; value: number; unit: string }[]) {
  api.ctx.clock.set(iso);
  await api.post("/reports", { reportDate: iso.slice(0, 10), source: "manual", markers }, id);
  api.ctx.clock.set(NOW);
}
const LDL = [{ marker: "ldl", value: 142, unit: "mg/dL" }];
const HBA1C = [{ marker: "hba1c", value: 6.1, unit: "%" }];

describe("weekly progress", () => {
  it("counts the days tracked so far this week", async () => {
    const id = await onboarded();
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09"]) await log(id, d);
    await log(id, "2026-10-09"); // two meals on one day still count once
    const res = await api.get("/progress", id);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      weekStart: "2026-10-05",
      weekEnd: "2026-10-11",
      daysElapsed: 5,
      daysTracked: 4,
      trackedDates: ["2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09"],
    });
  });

  it("keeps the consistency streak through a single missed day", async () => {
    const id = await onboarded();
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09"]) await log(id, d);
    expect((await api.get("/progress", id)).json.streak).toBe(4);
  });

  it("ends the streak after two missed days in a row", async () => {
    const id = await onboarded();
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-09"]) await log(id, d);
    expect((await api.get("/progress", id)).json.streak).toBe(1);
  });

  it("doesn't count today as missed before the user has logged", async () => {
    const id = await onboarded();
    for (const d of ["2026-10-06", "2026-10-07", "2026-10-08"]) await log(id, d);
    expect((await api.get("/progress", id)).json.streak).toBe(3);
  });

  it("counts goal days within ±10% of target", async () => {
    const id = await onboarded();
    await log(id, "2026-10-05", kcal(1782)); // -10%
    await log(id, "2026-10-06", kcal(2178)); // +10%
    await log(id, "2026-10-07", kcal(1781));
    await log(id, "2026-10-08", kcal(2179));
    expect((await api.get("/progress", id)).json.goal).toEqual({ daysMet: 2, daysTracked: 4, bandPct: 10 });
  });

  it("doesn't count today against the goal while the day is still going", async () => {
    const id = await onboarded();
    await log(id, "2026-10-08", kcal(1980));
    await log(id, "2026-10-09", kcal(900)); // today, half-way through
    expect((await api.get("/progress", id)).json.goal).toEqual({ daysMet: 1, daysTracked: 1, bandPct: 10 });
    await log(id, "2026-10-09", kcal(1000)); // today reaches the band
    expect((await api.get("/progress", id)).json.goal).toEqual({ daysMet: 2, daysTracked: 2, bandPct: 10 });
  });

  it("only compares with last week once there was a last week", async () => {
    const id = await onboarded();
    await log(id, "2026-10-08");
    expect((await api.get("/progress", id)).json.weekOverWeek).toEqual({
      daysTracked: null,
      goalDaysMet: null,
      focusPct: null,
    });
  });

  it("measures focus adherence across the week's meals", async () => {
    const id = await onboarded();
    await setFocusAt(id, "2026-10-01T07:30:00Z", LDL);
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) await log(id, d, dalRoti);
    await log(id, "2026-10-08", paneerNaan);
    expect((await api.get("/progress", id)).json.focus).toEqual({
      key: "fibre_focus",
      title: "More fibre-rich meals",
      supported: 3,
      total: 4,
      pct: 75,
    });
  });

  it("judges each day's meals by the focus that applied that day", async () => {
    const id = await onboarded();
    await setFocusAt(id, "2026-10-01T07:30:00Z", LDL);
    await log(id, "2026-10-05", paneerNaan); // fibre focus: not supporting
    await setFocusAt(id, "2026-10-07T07:30:00Z", HBA1C);
    await log(id, "2026-10-08", paneerNaan); // steady carbs: protein-paired, supporting
    expect((await api.get("/progress", id)).json.focus).toMatchObject({
      key: "steady_carbs",
      supported: 1,
      total: 2,
      pct: 50,
    });
  });

  it("compares the week with the one before", async () => {
    const id = await onboarded();
    await setFocusAt(id, "2026-09-20T07:30:00Z", LDL);
    for (const d of ["2026-09-29", "2026-09-30", "2026-10-01"])
      await log(id, d, d === "2026-09-29" ? dalRoti : paneerNaan); // 33%
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) await log(id, d, dalRoti); // 100%
    const res = await api.get("/progress", id);
    expect(res.json.weekOverWeek).toEqual({ daysTracked: 1, goalDaysMet: 0, focusPct: 67 });
  });

  it("leaves focus comparison out until both weeks have enough meals", async () => {
    const id = await onboarded();
    await setFocusAt(id, "2026-09-20T07:30:00Z", LDL);
    await log(id, "2026-09-29");
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) await log(id, d);
    expect((await api.get("/progress", id)).json.weekOverWeek.focusPct).toBeNull();
  });

  it("shows an earlier week on request", async () => {
    const id = await onboarded();
    for (const d of ["2026-09-29", "2026-10-01"]) await log(id, d);
    const res = await api.get("/progress?weekOf=2026-10-01", id);
    expect(res.json).toMatchObject({ weekStart: "2026-09-28", daysElapsed: 7, daysTracked: 2 });
  });

  it("stays in step with edits to the log", async () => {
    const id = await onboarded();
    await log(id, "2026-10-05");
    const saved = await log(id, "2026-10-06");
    await api.del(`/meals/${saved.meal.id}`, id);
    expect((await api.get("/progress", id)).json.daysTracked).toBe(1);
  });

  it("points out which meals most often support the focus", async () => {
    const id = await onboarded();
    await setFocusAt(id, "2026-10-01T07:30:00Z", LDL);
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) {
      await api.post("/meals", { mealType: "lunch", source: "text", items: dalRoti, eatenAt: at(d) }, id);
      await api.post(
        "/meals",
        { mealType: "dinner", source: "text", items: paneerNaan, eatenAt: `${d}T15:00:00Z` },
        id,
      );
    }
    expect((await api.get("/progress", id)).json.insights).toContain("Your lunches most often support your focus.");
  });
});

describe("achievements", () => {
  const types = (events: { type: string }[]) => events.map((e) => e.type);

  it("celebrates the first 3 days tracked, once", async () => {
    const id = await onboarded();
    expect(types((await log(id, "2026-10-05")).events)).not.toContain("first_3_days");
    expect(types((await log(id, "2026-10-06")).events)).not.toContain("first_3_days");
    expect(types((await log(id, "2026-10-07")).events)).toContain("first_3_days");
    expect(types((await log(id, "2026-10-07")).events)).not.toContain("first_3_days");
    const progress = await api.get("/progress", id);
    expect(progress.json.achievements.map((a: { type: string }) => a.type)).toEqual(["first_3_days"]);
  });

  it("celebrates a first full week of tracking", async () => {
    const id = await onboarded();
    for (const d of ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) {
      expect(types((await log(id, d)).events)).not.toContain("first_full_week");
    }
    expect(types((await log(id, "2026-10-09")).events)).toContain("first_full_week");
  });

  it("celebrates tracking more days than last week", async () => {
    const id = await onboarded();
    await log(id, "2026-09-29");
    await log(id, "2026-09-30");
    expect(types((await log(id, "2026-10-05")).events)).not.toContain("consistency_improved");
    expect(types((await log(id, "2026-10-06")).events)).not.toContain("consistency_improved");
    expect(types((await log(id, "2026-10-07")).events)).toContain("consistency_improved");
    expect(types((await log(id, "2026-10-08")).events)).not.toContain("consistency_improved");
  });

  it("celebrates better focus adherence than last week", async () => {
    const id = await onboarded();
    await setFocusAt(id, "2026-09-20T07:30:00Z", LDL);
    await log(id, "2026-09-29", dalRoti);
    await log(id, "2026-09-30", paneerNaan);
    await log(id, "2026-10-01", paneerNaan);
    await log(id, "2026-10-05", dalRoti);
    await log(id, "2026-10-06", dalRoti);
    const third = await log(id, "2026-10-07", dalRoti);
    expect(types(third.events)).toContain("focus_improved");
    expect(types(third.events)).toContain("meal_supported_focus");
  });

  it("welcomes the user back after a break, without mentioning what was missed", async () => {
    const id = await onboarded();
    await log(id, "2026-10-05");
    const res = await api.post("/checkins", {}, id);
    expect(res.status).toBe(200);
    expect(res.json.events).toHaveLength(1);
    expect(res.json.events[0].type).toBe("welcome_back");
    expect(res.json.events[0].message).not.toMatch(/streak|miss|lost/i);
    expect((await api.post("/checkins", {}, id)).json.events).toEqual([]);
  });

  it("doesn't welcome back an active user", async () => {
    const id = await onboarded();
    await log(id, "2026-10-08");
    expect((await api.post("/checkins", {}, id)).json.events).toEqual([]);
  });
});
