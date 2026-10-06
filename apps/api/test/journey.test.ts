import { describe, expect, it } from "vitest";
import { defaultGoal, useTestApp } from "./harness.js";

const api = useTestApp();

/** 70 kg, sedentary male → 1978.5 maintenance; losing 0.5 kg a week → 1430 kcal target. */
async function losing(targetWeightKg = 65) {
  const res = await api.post("/profiles", { mode: "fresh" });
  const id = res.json.profile.id as string;
  await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "lose", weeklyKg: 0.5, targetWeightKg }, id);
  return id;
}

const weigh = (id: string, kg: number, date?: string) => api.post("/weights", { kg, ...(date ? { date } : {}) }, id);
const types = (events: { type: string }[]) => events.map((e) => e.type);

describe("goal journey", () => {
  it("starts at the weight given in onboarding", async () => {
    const id = await losing();
    const res = await api.get("/journey", id);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      goal: "lose",
      startKg: 70,
      currentKg: 70,
      targetKg: 65,
      kgToGo: 5,
      pct: 0,
      weeklyKg: 0.5,
      lastWeighIn: null,
      onTargetStreak: 0,
    });
  });

  it("moves toward the goal with each weigh-in", async () => {
    const id = await losing();
    const first = await weigh(id, 68.8, "2026-10-06");
    expect(first.status).toBe(201);
    expect(first.json.journey).toMatchObject({ currentKg: 68.8, kgToGo: 3.8, pct: 24, lastWeighIn: "2026-10-06" });
    expect(types(first.json.events)).toContain("first_weigh_in");
  });

  it("celebrates each whole kilogram once", async () => {
    const id = await losing();
    expect(types((await weigh(id, 69.4)).json.events)).not.toContain("kg_progress");
    const oneDown = await weigh(id, 68.9);
    expect(oneDown.json.events).toContainEqual({ type: "kg_progress", message: "1 kg down. 4 to go." });
    // Bouncing back up and down again doesn't repeat the same kilogram.
    await weigh(id, 69.2);
    expect(types((await weigh(id, 68.7)).json.events)).not.toContain("kg_progress");
  });

  it("marks halfway and the goal itself", async () => {
    const id = await losing();
    expect(types((await weigh(id, 67.5)).json.events)).toContain("halfway_to_goal");
    const done = await weigh(id, 64.9);
    expect(types(done.json.events)).toContain("goal_reached");
    expect(done.json.journey).toMatchObject({ kgToGo: 0, pct: 100 });
  });

  it("counts gains when building muscle", async () => {
    const res = await api.post("/profiles", { mode: "fresh" });
    const id = res.json.profile.id as string;
    await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "build_muscle", targetWeightKg: 74 }, id);
    const up = await weigh(id, 71.1);
    expect(up.json.journey).toMatchObject({ kgToGo: 2.9, pct: 28 });
    expect(up.json.events).toContainEqual({ type: "kg_progress", message: "1 kg up. 3 to go." });
  });

  it("keeps one weigh-in per day", async () => {
    const id = await losing();
    await weigh(id, 69, "2026-10-06");
    await weigh(id, 68.6, "2026-10-06");
    const res = await api.get("/journey", id);
    expect(res.json.currentKg).toBe(68.6);
    expect(res.json.history).toEqual([{ date: "2026-10-06", kg: 68.6 }]);
  });

  it("rejects impossible weights and future dates", async () => {
    const id = await losing();
    expect((await weigh(id, 10)).status).toBe(400);
    expect((await weigh(id, 68, "2026-10-09")).status).toBe(400);
  });

  it("has no distance to go when maintaining", async () => {
    const res = await api.post("/profiles", { mode: "fresh" });
    const id = res.json.profile.id as string;
    await api.put(`/profiles/${id}/goal`, defaultGoal, id);
    expect((await api.get("/journey", id)).json).toMatchObject({ goal: "maintain", targetKg: null, kgToGo: null, pct: null });
  });
});

describe("on-target streak", () => {
  // Target 1430 kcal: a day counts when it lands within ±10% (1287–1573).
  const meal = (calories: number, eatenAt: string) => ({
    mealType: "lunch",
    source: "manual",
    eatenAt,
    items: [
      {
        kind: "estimate",
        name: "Home meal",
        quantity: 1,
        unit: "serving",
        nutrition: { calories, protein: 0, carbs: 0, fat: 0, fibre: 0, satFat: 0 },
      },
    ],
  });

  it("counts days in a row on target and celebrates 3", async () => {
    const id = await losing();
    api.ctx.clock.set("2026-10-08T15:00:00Z");
    await api.post("/meals", meal(1400, "2026-10-06T07:30:00Z"), id);
    const second = await api.post("/meals", meal(1450, "2026-10-07T07:30:00Z"), id);
    expect(types(second.json.events)).not.toContain("on_target_3");
    const third = await api.post("/meals", meal(1500, "2026-10-08T07:30:00Z"), id);
    expect(types(third.json.events)).toContain("on_target_3");
    expect((await api.get("/journey", id)).json.onTargetStreak).toBe(3);
  });

  it("doesn't count today as off target while it's still going", async () => {
    const id = await losing();
    api.ctx.clock.set("2026-10-08T08:00:00Z");
    await api.post("/meals", meal(1400, "2026-10-07T07:30:00Z"), id);
    await api.post("/meals", meal(600, "2026-10-08T03:00:00Z"), id); // breakfast so far today
    expect((await api.get("/journey", id)).json.onTargetStreak).toBe(1);
  });

  it("starts over after a day off target", async () => {
    const id = await losing();
    api.ctx.clock.set("2026-10-08T15:00:00Z");
    await api.post("/meals", meal(1400, "2026-10-05T07:30:00Z"), id);
    await api.post("/meals", meal(2500, "2026-10-06T07:30:00Z"), id);
    await api.post("/meals", meal(1400, "2026-10-07T07:30:00Z"), id);
    expect((await api.get("/journey", id)).json.onTargetStreak).toBe(1);
  });
});
