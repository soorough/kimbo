import { describe, expect, it } from "vitest";
import { defaultGoal, useTestApp } from "./harness.js";

const api = useTestApp();

async function onboarded() {
  const res = await api.post("/profiles", { mode: "fresh" });
  const id = res.json.profile.id as string;
  await api.put(`/profiles/${id}/goal`, defaultGoal, id);
  return id;
}

const item = (foodId: string, quantity: number, unit: string) => ({ kind: "catalogue", foodId, quantity, unit });
const meal = (mealType: string, items: ReturnType<typeof item>[], eatenAt?: string) => ({
  mealType,
  source: "text",
  items,
  ...(eatenAt ? { eatenAt } : {}),
});

const dalRoti = meal("lunch", [item("roti", 2, "piece"), item("dal_tadka", 1, "katori")]);
const paneerNaan = meal("dinner", [item("paneer_butter_masala", 1, "katori"), item("naan", 1, "piece")]);

async function setFocus(id: string, markers: { marker: string; value: number; unit: string }[]) {
  const res = await api.post("/reports", { reportDate: "2026-10-01", source: "manual", markers }, id);
  return res.json.focus.key as string;
}
const ldlWatch = [{ marker: "ldl", value: 142, unit: "mg/dL" }];

describe("Today", () => {
  it("shows an empty day against the goal", async () => {
    const id = await onboarded();
    const res = await api.get("/today", id);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      date: "2026-10-06",
      targets: { calories: 1980 },
      totals: { calories: 0 },
      meals: [],
      focus: null,
      focusSummary: null,
    });
  });

  it("totals the day's confirmed meals", async () => {
    const id = await onboarded();
    await api.post("/meals", meal("breakfast", [item("poha", 1, "plate")], "2026-10-06T03:00:00Z"), id);
    await api.post("/meals", dalRoti, id);
    const res = await api.get("/today", id);
    // poha 260 + roti 238 + dal 158
    expect(res.json.totals.calories).toBe(656);
    expect(res.json.meals.map((m: { mealType: string }) => m.mealType)).toEqual(["breakfast", "lunch"]);
  });

  it("shows another day on request", async () => {
    const id = await onboarded();
    await api.post("/meals", meal("dinner", [item("khichdi", 1, "katori")], "2026-10-05T14:00:00Z"), id);
    const res = await api.get("/today?date=2026-10-05", id);
    expect(res.json.meals).toHaveLength(1);
    expect((await api.get("/today", id)).json.meals).toHaveLength(0);
  });

  it("reflects edits and deletions", async () => {
    const id = await onboarded();
    const saved = await api.post("/meals", dalRoti, id);
    await api.patch(`/meals/${saved.json.meal.id}`, meal("lunch", [item("roti", 1, "piece")]), id);
    expect((await api.get("/today", id)).json.totals.calories).toBe(119);
    await api.del(`/meals/${saved.json.meal.id}`, id);
    expect((await api.get("/today", id)).json.totals.calories).toBe(0);
  });

  it("works before a goal is set", async () => {
    const res = await api.post("/profiles", { mode: "fresh" });
    const id = res.json.profile.id;
    expect((await api.get("/today", id)).json.targets).toBeNull();
  });
});

describe("connecting meals to the report focus", () => {
  it("shows how many of today's meals supported the focus, without judging the others", async () => {
    const id = await onboarded();
    await setFocus(id, ldlWatch);
    await api.post("/meals", dalRoti, id);
    await api.post("/meals", paneerNaan, id);
    const res = await api.get("/today", id);
    expect(res.json.focus).toMatchObject({ key: "fibre_focus", title: "More fibre-rich meals" });
    expect(res.json.focusSummary).toEqual({ supported: 1, total: 2 });
    const [lunch, dinner] = res.json.meals;
    expect(lunch).toMatchObject({ supportsFocus: true });
    expect(lunch.focusReason).toMatch(/fibre/i);
    expect(dinner.supportsFocus).toBe(false);
    expect(dinner.focusReason).not.toMatch(/bad|unhealthy|avoid/i);
  });

  it("acknowledges a meal that helps the focus the moment it's saved", async () => {
    const id = await onboarded();
    await setFocus(id, ldlWatch);
    const res = await api.post("/meals", dalRoti, id);
    expect(res.json.focusResult).toMatchObject({ focus: "fibre_focus", supports: true });
    expect(res.json.events).toContainEqual({ type: "meal_supported_focus", message: "That helped today's fibre focus ↑" });
  });

  it("stays quiet when a meal doesn't help the focus", async () => {
    const id = await onboarded();
    await setFocus(id, ldlWatch);
    const res = await api.post("/meals", paneerNaan, id);
    expect(res.json.focusResult).toMatchObject({ supports: false });
    expect(res.json.events.map((e: { type: string }) => e.type)).not.toContain("meal_supported_focus");
  });

  it("applies a new focus to meals already logged today", async () => {
    const id = await onboarded();
    await api.post("/meals", dalRoti, id);
    api.ctx.clock.set("2026-10-06T09:00:00Z");
    await setFocus(id, ldlWatch);
    expect((await api.get("/today", id)).json.focusSummary).toEqual({ supported: 1, total: 1 });
  });

  it("follows the latest report's focus", async () => {
    const id = await onboarded();
    await setFocus(id, ldlWatch);
    api.ctx.clock.set("2026-10-06T08:00:00Z");
    await setFocus(id, [{ marker: "hba1c", value: 6.1, unit: "%" }]);
    expect((await api.get("/today", id)).json.focus.key).toBe("steady_carbs");
  });

  it.each([
    ["steady_carbs", [{ marker: "hba1c", value: 6.1, unit: "%" }], meal("lunch", [item("white_rice", 1, "katori"), item("dal_tadka", 1, "katori")]), true],
    ["steady_carbs", [{ marker: "hba1c", value: 6.1, unit: "%" }], meal("snack", [item("masala_chai", 1, "cup"), item("biscuits", 4, "piece")]), false],
    ["less_sugar_refined", [{ marker: "triglycerides", value: 170, unit: "mg/dL" }], meal("dinner", [item("khichdi", 1, "katori"), item("curd", 1, "katori")]), true],
    ["less_sugar_refined", [{ marker: "triglycerides", value: 170, unit: "mg/dL" }], meal("snack", [item("samosa", 1, "piece")]), false],
    ["balanced_plate", [{ marker: "ldl", value: 80, unit: "mg/dL" }], meal("lunch", [item("white_rice", 1, "katori"), item("rajma", 1, "katori")]), true],
    ["balanced_plate", [{ marker: "ldl", value: 80, unit: "mg/dL" }], meal("breakfast", [item("white_bread", 2, "piece")]), false],
    ["fibre_focus", ldlWatch, meal("lunch", [item("dal_makhani", 1, "katori"), item("white_rice", 1, "katori")]), true],
  ])("%s: %#", async (focus, markers, m, supports) => {
    const id = await onboarded();
    expect(await setFocus(id, markers)).toBe(focus);
    const res = await api.post("/meals", m, id);
    expect(res.json.focusResult.supports).toBe(supports);
  });
});
