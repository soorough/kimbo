import { describe, expect, it } from "vitest";
import { AiUnavailableError } from "../src/ai/types.js";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

describe("parsing a meal into a reviewable draft", () => {
  it("turns '2 roti, one katori dal and aloo gobi' into catalogue items with deterministic nutrition", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [
      { name: "roti", quantity: 2, unit: "piece", confidence: 0.95 },
      { name: "dal", quantity: 1, unit: "katori", confidence: 0.9 },
      { name: "aloo gobi", quantity: null, unit: null, confidence: 0.8 },
    ];

    const res = await api.post("/meals/parse", { text: "2 roti, one katori dal and aloo gobi" }, id);

    expect(res.status).toBe(200);
    expect(api.ctx.recognizer.lastInput).toEqual({ text: "2 roti, one katori dal and aloo gobi" });
    const items = res.json.items;
    expect(items.map((i: { kind: string; food: { id: string }; quantity: number; unit: string }) => [i.kind, i.food.id, i.quantity, i.unit])).toEqual([
      ["catalogue", "roti", 2, "piece"],
      ["catalogue", "dal_tadka", 1, "katori"],
      ["catalogue", "aloo_gobi", 1, "katori"],
    ]);
    // roti 119 kcal/piece, dal 158 kcal/katori, aloo gobi 143 kcal/katori
    expect(items.map((i: { nutrition: { calories: number } }) => i.nutrition.calories)).toEqual([238, 158, 143]);
    expect(res.json.totals.calories).toBe(539);
  });

  it("gives the same numbers every time for the same meal", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "rajma", quantity: 1, unit: "katori", confidence: 0.9 }];
    const a = await api.post("/meals/parse", { text: "rajma" }, id);
    const b = await api.post("/meals/parse", { text: "rajma" }, id);
    expect(a.json.totals).toEqual(b.json.totals);
  });

  it("understands Hinglish names, spelling variants and plurals", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [
      { name: "Chawal", quantity: 1, unit: "katori", confidence: 0.9 },
      { name: "daal", quantity: 1, unit: "katoris", confidence: 0.9 },
      { name: "dahi", quantity: 1, unit: "bowl", confidence: 0.9 },
      { name: "rotis", quantity: 3, unit: "rotis", confidence: 0.9 },
      { name: "chana masala", quantity: 1, unit: "vati", confidence: 0.9 },
    ];
    const res = await api.post("/meals/parse", { text: "chawal daal dahi 3 rotis chana masala" }, id);
    expect(res.json.items.map((i: { food: { id: string }; unit: string; quantity: number }) => [i.food.id, i.unit, i.quantity])).toEqual([
      ["white_rice", "katori", 1],
      ["dal_tadka", "katori", 1],
      ["curd", "bowl", 1],
      ["roti", "piece", 3],
      ["chole", "katori", 1],
    ]);
  });

  it("matches a dish described with extra words to the closest catalogue dish", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "homemade aloo gobi sabzi", quantity: 1, unit: null, confidence: 0.7 }];
    const res = await api.post("/meals/parse", { text: "homemade aloo gobi sabzi" }, id);
    expect(res.json.items[0].food.id).toBe("aloo_gobi");
  });

  it("falls back to a portion the dish supports when the unit doesn't fit", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "roti", quantity: 2, unit: "glass", confidence: 0.6 }];
    const res = await api.post("/meals/parse", { text: "2 roti" }, id);
    expect(res.json.items[0]).toMatchObject({ unit: "piece", quantity: 2 });
  });

  it("marks dishes outside the dataset as editable estimates", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [
      { name: "roti", quantity: 1, unit: "piece", confidence: 0.9 },
      { name: "thukpa", quantity: 1, unit: "bowl", confidence: 0.6 },
    ];
    const res = await api.post("/meals/parse", { text: "roti and thukpa" }, id);
    expect(res.json.items[1]).toMatchObject({ kind: "estimate", name: "Thukpa", heardAs: "thukpa", quantity: 1 });
    expect(res.json.items[1].nutrition.calories).toBeGreaterThan(0);
  });

  it("estimates unknown dishes per the portion named, not per plate", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [
      { name: "kuzhi paniyaram", quantity: 6, unit: "piece", confidence: 0.7 },
      { name: "kuzhambu", quantity: 1, unit: "katori", confidence: 0.7 },
    ];
    const res = await api.post("/meals/parse", { text: "6 paniyaram and kuzhambu" }, id);
    expect(res.json.items[0]).toMatchObject({ kind: "estimate", quantity: 6, unit: "piece" });
    expect(res.json.items[0].nutrition.calories).toBe(600);
    expect(res.json.items[1]).toMatchObject({ kind: "estimate", quantity: 1, unit: "katori" });
    expect(res.json.items[1].nutrition.calories).toBe(200);
  });

  it.each([
    ["momos", "momos"],
    ["pav bhaji", "pav_bhaji"],
    ["veg fried rice", "fried_rice"],
    ["chowmein", "chowmein"],
    ["vada pav", "vada_pav"],
  ])("knows everyday dishes like %s", async (name, foodId) => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name, quantity: null, unit: null, confidence: 0.9 }];
    const res = await api.post("/meals/parse", { text: name }, id);
    expect(res.json.items[0].food?.id).toBe(foodId);
  });

  it("sends photos to the recognizer", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "idli", quantity: 3, unit: "piece", confidence: 0.85 }];
    const res = await api.post("/meals/parse", { imageBase64: "aGVsbG8=", mimeType: "image/jpeg" }, id);
    expect(api.ctx.recognizer.lastInput).toEqual({ image: "aGVsbG8=" });
    expect(res.json.items[0]).toMatchObject({ kind: "catalogue", quantity: 3, unit: "piece" });
    expect(res.json.items[0].food.id).toBe("idli");
  });

  it("suggests the meal type from the user's local time", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "poha", quantity: 1, unit: "plate", confidence: 0.9 }];
    api.ctx.clock.set("2026-10-06T02:30:00Z"); // 08:00 IST
    expect((await api.post("/meals/parse", { text: "poha" }, id)).json.suggestedMealType).toBe("breakfast");
    api.ctx.clock.set("2026-10-06T07:30:00Z"); // 13:00 IST
    expect((await api.post("/meals/parse", { text: "poha" }, id)).json.suggestedMealType).toBe("lunch");
    api.ctx.clock.set("2026-10-06T11:30:00Z"); // 17:00 IST
    expect((await api.post("/meals/parse", { text: "poha" }, id)).json.suggestedMealType).toBe("snack");
    api.ctx.clock.set("2026-10-06T15:30:00Z"); // 21:00 IST
    expect((await api.post("/meals/parse", { text: "poha" }, id)).json.suggestedMealType).toBe("dinner");
  });

  it("returns a retryable error when the recognizer is unavailable", async () => {
    const id = await profile();
    api.ctx.recognizer.next = new AiUnavailableError();
    const res = await api.post("/meals/parse", { text: "dal chawal" }, id);
    expect(res.status).toBe(502);
    expect(res.json).toMatchObject({ code: "AI_UNAVAILABLE", retryable: true });
  });

  it("rejects an empty description", async () => {
    const id = await profile();
    const res = await api.post("/meals/parse", { text: "   " }, id);
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("VALIDATION_ERROR");
  });
});

describe("searching the food list", () => {
  it("finds foods by name or alias with per-portion nutrition for live editing", async () => {
    const id = await profile();
    const res = await api.get("/foods/search?q=dahi", id);
    expect(res.status).toBe(200);
    const curd = res.json.foods[0];
    expect(curd).toMatchObject({ id: "curd", name: "Curd (dahi)", defaultUnit: "katori" });
    expect(curd.units.find((u: { unit: string }) => u.unit === "katori").perUnit.calories).toBe(90);
  });

  it("ranks exact matches first", async () => {
    const id = await profile();
    const res = await api.get("/foods/search?q=dal", id);
    expect(res.json.foods[0].id).toBe("dal_tadka");
    expect(res.json.foods.map((f: { id: string }) => f.id)).toEqual(expect.arrayContaining(["dal_makhani", "moong_dal"]));
  });

  it("lists the whole catalogue for browsing when the query is empty", async () => {
    const id = await profile();
    const res = await api.get("/foods/search?q=", id);
    expect(res.json.foods.length).toBeGreaterThanOrEqual(60);
  });
});
