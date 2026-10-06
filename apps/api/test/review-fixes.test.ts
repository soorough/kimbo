import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

describe("gram portions", () => {
  it("prices grams precisely and lets them be saved", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "rice", quantity: 200, unit: "g", confidence: 0.9 }];
    const draft = await api.post("/meals/parse", { text: "200 g rice" }, id);
    // steamed rice per 100 g: 130 kcal, 2.7 g protein, 28 g carbs
    expect(draft.json.items[0].nutrition).toMatchObject({ calories: 260, protein: 5.4, carbs: 56 });
    const saved = await api.post(
      "/meals",
      { mealType: "lunch", source: "text", items: [{ kind: "catalogue", foodId: "white_rice", quantity: 200, unit: "g" }] },
      id,
    );
    expect(saved.status).toBe(201);
    expect(saved.json.meal.totals.calories).toBe(260);
  });

  it("still rejects implausible piece counts", async () => {
    const id = await profile();
    const res = await api.post(
      "/meals",
      { mealType: "lunch", source: "text", items: [{ kind: "catalogue", foodId: "roti", quantity: 200, unit: "piece" }] },
      id,
    );
    expect(res.status).toBe(400);
  });
});

describe("dish matching stays honest", () => {
  it.each(["green tea", "rice paper rolls"])("treats '%s' as an estimate rather than a near miss", async (name) => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name, quantity: 1, unit: null, confidence: 0.8 }];
    const res = await api.post("/meals/parse", { text: name }, id);
    expect(res.json.items[0].kind).toBe("estimate");
  });

  it("still matches a known dish with harmless extra words", async () => {
    const id = await profile();
    api.ctx.recognizer.next = [{ name: "homemade plain dal", quantity: 1, unit: null, confidence: 0.8 }];
    const res = await api.post("/meals/parse", { text: "homemade plain dal" }, id);
    expect(res.json.items[0].food.id).toBe("dal_tadka");
  });
});

describe("report units", () => {
  it("understands common unit spellings", async () => {
    const id = await profile();
    api.ctx.extractor.next = {
      reportDate: null,
      markers: [
        { markerName: "LDL", value: 3.5, unit: "mmol/litre" },
        { markerName: "Triglycerides", value: 160, unit: "mg%" },
      ],
    };
    const res = await api.post("/reports/extract", { fileBase64: "aW1n", mimeType: "image/jpeg" }, id);
    const ldl = res.json.markers.find((m: { marker: string }) => m.marker === "ldl");
    expect(ldl).toMatchObject({ value: 135, unit: "mg/dL" });
    expect(res.json.markers.find((m: { marker: string }) => m.marker === "triglycerides").value).toBe(160);
  });

  it("never guesses a unit it can't convert", async () => {
    const id = await profile();
    api.ctx.extractor.next = { reportDate: null, markers: [{ markerName: "LDL Cholesterol", value: 1.4, unit: "g/L" }] };
    const res = await api.post("/reports/extract", { fileBase64: "aW1n", mimeType: "image/jpeg" }, id);
    expect(res.json.markers).toEqual([]);
    expect(res.json.ignored).toEqual(["LDL Cholesterol (unit g/L not recognised)"]);
  });
});

describe("edits keep history honest", () => {
  it("keeps a corrected meal marked as corrected after a later edit", async () => {
    const id = await profile();
    const items = [{ kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" }];
    const saved = await api.post("/meals", { mealType: "lunch", source: "photo", wasCorrected: true, items }, id);
    const edited = await api.patch(`/meals/${saved.json.meal.id}`, { mealType: "lunch", source: "photo", items }, id);
    expect(edited.json.meal.wasCorrected).toBe(true);
  });
});

describe("date validation", () => {
  it("rejects impossible calendar dates as bad input", async () => {
    const id = await profile();
    expect((await api.get("/today?date=2026-13-01", id)).status).toBe(400);
    const report = await api.post(
      "/reports",
      { reportDate: "2026-02-31", source: "manual", markers: [{ marker: "ldl", value: 120, unit: "mg/dL" }] },
      id,
    );
    expect(report.status).toBe(400);
  });
});

describe("photo size", () => {
  it("rejects oversized photos with a non-retryable message", async () => {
    const id = await profile();
    const res = await api.post("/meals/parse", { imageBase64: "A".repeat(7_000_001), mimeType: "image/jpeg" }, id);
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ code: "IMAGE_TOO_LARGE", retryable: false });
  });
});
