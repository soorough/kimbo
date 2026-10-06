import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

const lunch = {
  mealType: "lunch",
  source: "text",
  items: [
    { kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" },
    { kind: "catalogue", foodId: "dal_tadka", quantity: 1, unit: "katori" },
  ],
};

describe("confirming a meal", () => {
  it("saves the confirmed meal with nutrition computed from the catalogue", async () => {
    const id = await profile();
    const res = await api.post("/meals", lunch, id);
    expect(res.status).toBe(201);
    expect(res.json.meal).toMatchObject({
      mealType: "lunch",
      source: "text",
      localDate: "2026-10-06",
      eatenAt: "2026-10-06T07:30:00.000Z",
      wasCorrected: false,
    });
    expect(res.json.meal.items.map((i: { name: string; nutrition: { calories: number } }) => [i.name, i.nutrition.calories])).toEqual([
      ["Roti", 238],
      ["Dal (toor/arhar)", 158],
    ]);
    expect(res.json.meal.totals.calories).toBe(396);
    expect(res.json.focusResult).toBeNull();
  });

  it("ignores nutrition values sent by the client for catalogue items", async () => {
    const id = await profile();
    const tampered = {
      ...lunch,
      items: [{ kind: "catalogue", foodId: "roti", quantity: 1, unit: "piece", nutrition: { calories: 1 } }],
    };
    const res = await api.post("/meals", tampered, id);
    expect(res.json.meal.totals.calories).toBe(119);
  });

  it("keeps the user's numbers for estimated dishes", async () => {
    const id = await profile();
    const res = await api.post(
      "/meals",
      {
        mealType: "dinner",
        source: "photo",
        items: [
          {
            kind: "estimate",
            name: "Thukpa",
            quantity: 1,
            unit: "serving",
            nutrition: { calories: 320, protein: 12, carbs: 45, fat: 9, fibre: 4, satFat: 2 },
          },
        ],
      },
      id,
    );
    expect(res.status).toBe(201);
    expect(res.json.meal.items[0]).toMatchObject({ name: "Thukpa", isEstimate: true, foodId: null });
    expect(res.json.meal.totals.calories).toBe(320);
  });

  it("thanks the user when they corrected Kimbo's suggestion", async () => {
    const id = await profile();
    const res = await api.post("/meals", { ...lunch, wasCorrected: true }, id);
    expect(res.json.events.map((e: { type: string }) => e.type)).toContain("correction_accepted");
  });

  it("logs a meal eaten earlier on its own day", async () => {
    const id = await profile();
    // 23:30 IST on 5 Oct
    const res = await api.post("/meals", { ...lunch, mealType: "dinner", eatenAt: "2026-10-05T18:00:00Z" }, id);
    expect(res.json.meal.localDate).toBe("2026-10-05");
  });

  it("rejects meals in the future", async () => {
    const id = await profile();
    const res = await api.post("/meals", { ...lunch, eatenAt: "2026-10-07T07:30:00Z" }, id);
    expect(res.status).toBe(400);
  });

  it("rejects unknown foods and portions a food doesn't come in", async () => {
    const id = await profile();
    const unknown = await api.post("/meals", { ...lunch, items: [{ kind: "catalogue", foodId: "pizza", quantity: 1, unit: "piece" }] }, id);
    expect(unknown.status).toBe(400);
    expect(unknown.json.code).toBe("UNKNOWN_FOOD");
    const badUnit = await api.post("/meals", { ...lunch, items: [{ kind: "catalogue", foodId: "roti", quantity: 1, unit: "glass" }] }, id);
    expect(badUnit.status).toBe(400);
    expect(badUnit.json.code).toBe("UNSUPPORTED_UNIT");
  });

  it("requires at least one item", async () => {
    const id = await profile();
    const res = await api.post("/meals", { ...lunch, items: [] }, id);
    expect(res.status).toBe(400);
  });
});

describe("managing logged meals", () => {
  it("lists a day's meals in the order they were eaten", async () => {
    const id = await profile();
    await api.post("/meals", { ...lunch, mealType: "lunch" }, id);
    await api.post("/meals", { ...lunch, mealType: "breakfast", eatenAt: "2026-10-06T03:00:00Z" }, id);
    await api.post("/meals", { ...lunch, mealType: "dinner", eatenAt: "2026-10-05T15:00:00Z" }, id);
    const res = await api.get("/meals?date=2026-10-06", id);
    expect(res.json.meals.map((m: { mealType: string }) => m.mealType)).toEqual(["breakfast", "lunch"]);
    const defaultDay = await api.get("/meals", id);
    expect(defaultDay.json.meals).toHaveLength(2);
  });

  it("does not save anything when parsing", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "dal", quantity: 1, unit: "katori", confidence: 0.9 }];
    await api.post("/meals/parse", { text: "dal" }, id);
    const meals = await api.get("/meals?date=2026-10-06", id);
    expect(meals.json.meals).toEqual([]);
  });

  it("persists meals across sessions", async () => {
    const id = await profile();
    await api.post("/meals", lunch, id);
    const again = await api.get("/meals?date=2026-10-06", id);
    expect(again.json.meals).toHaveLength(1);
  });

  it("edits a saved meal's items", async () => {
    const id = await profile();
    const saved = await api.post("/meals", lunch, id);
    const res = await api.patch(
      `/meals/${saved.json.meal.id}`,
      { ...lunch, items: [{ kind: "catalogue", foodId: "roti", quantity: 3, unit: "piece" }] },
      id,
    );
    expect(res.status).toBe(200);
    expect(res.json.meal.totals.calories).toBe(357);
    const list = await api.get("/meals?date=2026-10-06", id);
    expect(list.json.meals[0].totals.calories).toBe(357);
  });

  it("deletes a meal", async () => {
    const id = await profile();
    const saved = await api.post("/meals", lunch, id);
    const res = await api.del(`/meals/${saved.json.meal.id}`, id);
    expect(res.status).toBe(204);
    expect((await api.get("/meals?date=2026-10-06", id)).json.meals).toEqual([]);
  });

  it("keeps other people's meals out of reach", async () => {
    const mine = await profile();
    const theirs = await profile();
    const saved = await api.post("/meals", lunch, theirs);
    expect((await api.del(`/meals/${saved.json.meal.id}`, mine)).status).toBe(404);
    expect((await api.patch(`/meals/${saved.json.meal.id}`, lunch, mine)).status).toBe(404);
    expect((await api.get("/meals?date=2026-10-06", mine)).json.meals).toEqual([]);
  });
});
