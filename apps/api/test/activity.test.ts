import { describe, expect, it } from "vitest";
import { defaultGoal, useTestApp } from "./harness.js";

const api = useTestApp();

async function onboarded() {
  const res = await api.post("/profiles", { mode: "fresh" });
  const id = res.json.profile.id as string;
  await api.put(`/profiles/${id}/goal`, defaultGoal, id);
  return id;
}

describe("Water", () => {
  it("logs each pour as its own entry, totals the day in ml and deletes one", async () => {
    const id = await onboarded();
    expect((await api.get("/today", id)).json.water).toEqual({ ml: 0, goalMl: 2000, entries: [] });

    const glass = await api.post("/water", { ml: 250 }, id);
    expect(glass.status).toBe(201);
    await api.post("/water", { ml: 500 }, id);
    const today = (await api.get("/today", id)).json.water;
    expect(today.ml).toBe(750);
    expect(today.entries.map((e: { ml: number }) => e.ml)).toEqual([250, 500]);

    expect((await api.del(`/water/${glass.json.entry.id}`, id)).status).toBe(204);
    expect((await api.get("/today", id)).json.water.ml).toBe(500);
    expect((await api.del(`/water/${glass.json.entry.id}`, id)).status).toBe(404);
  });

  it("rejects empty or huge pours", async () => {
    const id = await onboarded();
    expect((await api.post("/water", { ml: 0 }, id)).status).toBe(400);
    expect((await api.post("/water", { ml: 6000 }, id)).status).toBe(400);
  });
});

describe("Exercise", () => {
  it("prices a run from intensity, minutes and body weight, and saves nothing until logged", async () => {
    const id = await onboarded();
    const kg = defaultGoal.weightKg;
    const est = await api.post("/exercise/estimate", { kind: "run", intensity: "medium", minutes: 15 }, id);
    expect(est.json.draft).toEqual({ kind: "run", label: "Run", intensity: "medium", minutes: 15, calories: Math.round(9.8 * kg * 0.25) });
    expect((await api.get("/today", id)).json.exercise).toEqual({ burned: 0, entries: [] });
  });

  it("reads a described workout, but the calories always come from Kimbo's table", async () => {
    const id = await onboarded();
    api.ctx.exerciseReader.next = { activity: "Badminton", kind: "sport", intensity: "high", minutes: 40 };
    const est = await api.post("/exercise/estimate", { text: "played badminton for 40 mins, pretty intense" }, id);
    expect(est.json.draft).toMatchObject({ kind: "sport", label: "Badminton", minutes: 40, calories: Math.round(9 * defaultGoal.weightKg * (40 / 60)) });
  });

  it("logs a workout (edited calories allowed), adds it to the day and deletes it", async () => {
    const id = await onboarded();
    const res = await api.post("/exercise", { kind: "manual", label: "Exercise", intensity: null, minutes: null, calories: 180 }, id);
    expect(res.status).toBe(201);
    await api.post("/exercise", { kind: "run", label: "Run", intensity: "low", minutes: 20, calories: 75 }, id);
    const ex = (await api.get("/today", id)).json.exercise;
    expect(ex.burned).toBe(255);
    expect(ex.entries).toHaveLength(2);
    expect((await api.del(`/exercise/${res.json.entry.id}`, id)).status).toBe(204);
    expect((await api.get("/today", id)).json.exercise.burned).toBe(75);
  });
});

describe("Logging from Ask Kimbo", () => {
  const ask = (id: string, text: string) => api.post("/assistant/ask", { text }, id);

  it("offers to log water it hears, worked out in ml", async () => {
    const id = await onboarded();
    const res = await ask(id, "just drank 2 glasses of water");
    expect(res.json.reply.actions).toEqual([{ kind: "log_water", label: "Log 500 ml", ml: 500 }]);
    expect((await ask(id, "had a bottle of water")).json.reply.actions[0].ml).toBe(500);
    expect((await ask(id, "1.5 litres of water today")).json.reply.actions[0].ml).toBe(1500);
  });

  it("offers to log a workout with rule-made calories, and burned calories raise what's left", async () => {
    const id = await onboarded();
    const res = await ask(id, "went for a 30 min jog");
    const [action] = res.json.reply.actions;
    expect(action).toMatchObject({ kind: "log_exercise", label: "Log it", draft: { kind: "run", minutes: 30 } });
    expect(res.json.reply.text).toMatch(new RegExp(`about ${action.draft.calories} kcal burned`));

    await api.post("/exercise", action.draft, id);
    await api.post("/water", { ml: 750 }, id);
    await ask(id, "how much water have I had?");
    const facts = api.ctx.coach.lastInput!.facts;
    expect(facts).toMatch(/Water today: 750 ml of a 2000 ml goal/);
    expect(facts).toMatch(new RegExp(`Run 30 min \\(${action.draft.calories} kcal burned\\)`));
  });
});
