import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();

describe("demo profile for reviewers", () => {
  it("arrives ready: goal set, a week of meals, a sample report, a focus and milestones", async () => {
    const res = await api.post("/profiles", { mode: "demo" });
    expect(res.status).toBe(201);
    const { profile } = res.json;
    expect(profile.isDemo).toBe(true);
    expect(profile.goal.effectiveTarget).toBeGreaterThan(1200);
    expect(profile.goal.targetWeightKg).toBe(59);

    const journey = await api.get("/journey", profile.id);
    expect(journey.json).toMatchObject({ startKg: 64, targetKg: 59, pct: 0 });

    const today = await api.get("/today", profile.id);
    expect(today.json.focus.key).toBe("fibre_focus");
    expect(today.json.meals.length).toBeGreaterThanOrEqual(1);
    expect(today.json.focusSummary.total).toBe(today.json.meals.length);

    const progress = await api.get("/progress?weekOf=2026-10-02", profile.id);
    expect(progress.json.daysTracked).toBeGreaterThanOrEqual(4);
    const current = await api.get("/progress", profile.id);
    expect(current.json.streak).toBeGreaterThanOrEqual(4);
    expect(current.json.focus.total).toBeGreaterThan(0);
    expect(current.json.achievements.map((a: { type: string }) => a.type)).toContain("first_3_days");

    const reports = await api.get("/reports", profile.id);
    expect(reports.json.reports).toHaveLength(1);
    expect(reports.json.reports[0].source).toBe("sample");
  });

  it("dates its history relative to today", async () => {
    api.ctx.clock.set("2027-03-15T07:30:00Z");
    const { json } = await api.post("/profiles", { mode: "demo" });
    const yesterday = await api.get("/today?date=2027-03-14", json.profile.id);
    expect(yesterday.json.meals.length).toBeGreaterThanOrEqual(2);
  });

  it("only seeds meals that have already happened today", async () => {
    api.ctx.clock.set("2026-10-06T01:00:00Z"); // 06:30 IST, before breakfast
    const { json } = await api.post("/profiles", { mode: "demo" });
    expect((await api.get("/today", json.profile.id)).json.meals).toEqual([]);
  });

  it("keeps each demo separate, and a fresh start empty", async () => {
    const demo = (await api.post("/profiles", { mode: "demo" })).json.profile.id;
    const fresh = (await api.post("/profiles", { mode: "fresh" })).json.profile.id;
    expect((await api.get("/today", fresh)).json.meals).toEqual([]);
    expect((await api.get("/reports", fresh)).json.reports).toEqual([]);
    expect((await api.get("/today", demo)).json.meals.length).toBeGreaterThan(0);
  });
});

describe("same as yesterday", () => {
  it("repeats yesterday's meal of that type in one tap", async () => {
    const id = (await api.post("/profiles", { mode: "fresh" })).json.profile.id;
    await api.post(
      "/meals",
      {
        mealType: "breakfast",
        source: "text",
        eatenAt: "2026-10-05T03:00:00Z",
        items: [{ kind: "catalogue", foodId: "poha", quantity: 1, unit: "plate" }],
      },
      id,
    );
    const res = await api.post("/meals/repeat-yesterday", { mealType: "breakfast" }, id);
    expect(res.status).toBe(201);
    expect(res.json.meal).toMatchObject({ mealType: "breakfast", source: "repeat", localDate: "2026-10-06" });
    expect(res.json.meal.items[0]).toMatchObject({ foodId: "poha", quantity: 1, unit: "plate" });
  });

  it("explains when there's nothing to repeat", async () => {
    const id = (await api.post("/profiles", { mode: "fresh" })).json.profile.id;
    const res = await api.post("/meals/repeat-yesterday", { mealType: "dinner" }, id);
    expect(res.status).toBe(404);
    expect(res.json.code).toBe("NOTHING_TO_REPEAT");
  });
});
