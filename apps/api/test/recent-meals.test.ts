import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

const rotiDal = [
  { kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" },
  { kind: "catalogue", foodId: "dal_tadka", quantity: 1, unit: "katori" },
];
const poha = [{ kind: "catalogue", foodId: "poha", quantity: 1, unit: "plate" }];
const homeCurry = [
  {
    kind: "estimate",
    name: "Mom's curry",
    quantity: 1,
    unit: "katori",
    nutrition: { calories: 220, protein: 6, carbs: 12, fat: 15, fibre: 3, satFat: 4 },
  },
];

async function log(id: string, items: unknown[], eatenAt: string, mealType = "lunch") {
  const res = await api.post("/meals", { mealType, source: "text", eatenAt, items }, id);
  expect(res.status).toBe(201);
}

type Recent = { key: string; label: string; calories: number; timesLogged: number; draft: { items: unknown[] } };
const recent = async (id: string) => (await api.get("/meals/recent", id)).json.meals as Recent[];

describe("recent meals for quick logging", () => {
  it("is empty before anything is logged", async () => {
    expect(await recent(await profile())).toEqual([]);
  });

  it("offers each distinct meal once, most often logged first", async () => {
    const id = await profile();
    await log(id, poha, "2026-10-03T03:00:00Z", "breakfast");
    await log(id, rotiDal, "2026-10-04T07:00:00Z");
    await log(id, rotiDal, "2026-10-05T07:00:00Z");
    const meals = await recent(id);
    expect(meals.map((m) => [m.label, m.calories, m.timesLogged])).toEqual([
      ["Roti, Dal (toor/arhar)", 396, 2],
      ["Poha", expect.any(Number), 1],
    ]);
  });

  it("hands back a draft ready for the review screen", async () => {
    const id = await profile();
    await log(id, [...rotiDal, ...homeCurry], "2026-10-05T07:00:00Z");
    const [meal] = await recent(id);
    expect(meal!.draft.items).toEqual([
      expect.objectContaining({ kind: "catalogue", food: expect.objectContaining({ id: "roti" }), quantity: 2, unit: "piece" }),
      expect.objectContaining({ kind: "catalogue", food: expect.objectContaining({ id: "dal_tadka" }), quantity: 1 }),
      expect.objectContaining({ kind: "estimate", name: "Mom's curry", quantity: 1, unit: "katori" }),
    ]);
  });

  it("treats a different portion as a different meal", async () => {
    const id = await profile();
    await log(id, rotiDal, "2026-10-04T07:00:00Z");
    await log(id, [{ ...rotiDal[0], quantity: 3 }, rotiDal[1]], "2026-10-05T07:00:00Z");
    const meals = await recent(id);
    expect(meals).toHaveLength(2);
    expect(meals[0]!.calories).not.toBe(meals[1]!.calories);
  });

  it("shows at most six, newest first among equals", async () => {
    const id = await profile();
    for (let q = 1; q <= 8; q++) await log(id, [{ ...poha[0], quantity: q }], `2026-10-0${Math.min(q, 6)}T03:00:00Z`);
    const meals = await recent(id);
    expect(meals).toHaveLength(6);
    expect(meals[0]!.label).toBe("Poha");
  });

  it("forgets meals older than sixty days", async () => {
    const id = await profile();
    await log(id, poha, "2026-08-01T03:00:00Z");
    expect(await recent(id)).toEqual([]);
  });

  it("removes a meal from the list without touching history", async () => {
    const id = await profile();
    await log(id, poha, "2026-10-05T03:00:00Z");
    const [meal] = await recent(id);
    expect((await api.del(`/meals/recent/${meal!.key}`, id)).status).toBe(204);
    expect(await recent(id)).toEqual([]);
    expect((await api.get("/meals?date=2026-10-05", id)).json.meals).toHaveLength(1);
  });

  it("brings a removed meal back once it's logged again", async () => {
    const id = await profile();
    await log(id, poha, "2026-10-05T03:00:00Z");
    const [meal] = await recent(id);
    await api.del(`/meals/recent/${meal!.key}`, id);
    await log(id, poha, "2026-10-06T03:00:00Z");
    expect((await recent(id)).map((m) => m.key)).toEqual([meal!.key]);
  });

  it("keeps other people's meals out", async () => {
    const mine = await profile();
    const theirs = await profile();
    await log(theirs, poha, "2026-10-05T03:00:00Z");
    expect(await recent(mine)).toEqual([]);
  });
});
