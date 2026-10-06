import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();
const NOW = "2026-10-06T07:30:00Z";

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

/** Files a report as if it were confirmed on `iso`. */
async function report(id: string, iso: string, markers: { marker: string; value: number; unit: string }[]) {
  api.ctx.clock.set(iso);
  const res = await api.post("/reports", { reportDate: iso.slice(0, 10), source: "manual", markers }, id);
  api.ctx.clock.set(NOW);
  expect(res.status).toBe(201);
}

const dalRoti = [
  { kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" },
  { kind: "catalogue", foodId: "dal_tadka", quantity: 1, unit: "katori" },
];
const paneerNaan = [
  { kind: "catalogue", foodId: "paneer_butter_masala", quantity: 1, unit: "katori" },
  { kind: "catalogue", foodId: "naan", quantity: 1, unit: "piece" },
];
const rajmaRice = [
  { kind: "catalogue", foodId: "rajma", quantity: 1, unit: "katori" },
  { kind: "catalogue", foodId: "white_rice", quantity: 1, unit: "katori" },
];

async function log(id: string, date: string, items: unknown[]) {
  const res = await api.post("/meals", { mealType: "lunch", source: "text", eatenAt: `${date}T07:00:00Z`, items }, id);
  expect(res.status).toBe(201);
}

const insights = async (id: string) => (await api.get("/reports/insights", id)).json.insights;
const LDL_HIGH = [{ marker: "ldl", value: 142, unit: "mg/dL" }];

describe("report insights", () => {
  it("has nothing to show before a report", async () => {
    expect(await insights(await profile())).toBeNull();
  });

  it("counts the meals that helped the focus since the report, and only since then", async () => {
    const id = await profile();
    await log(id, "2026-09-20", dalRoti); // before the report: ignored
    await report(id, "2026-09-28T08:00:00Z", LDL_HIGH);
    await log(id, "2026-09-29", dalRoti);
    await log(id, "2026-10-01", rajmaRice);
    await log(id, "2026-10-02", paneerNaan);
    expect(await insights(id)).toMatchObject({
      reportDate: "2026-09-28",
      since: "2026-09-28",
      focus: { key: "fibre_focus", title: "More fibre-rich meals" },
      marker: { marker: "ldl", value: 142, status: "worth_watching" },
      supported: 2,
      total: 3,
      pct: 67,
    });
  });

  it("names the dishes that most often helped", async () => {
    const id = await profile();
    await report(id, "2026-09-28T08:00:00Z", LDL_HIGH);
    await log(id, "2026-09-29", dalRoti);
    await log(id, "2026-09-30", dalRoti);
    await log(id, "2026-10-01", rajmaRice);
    expect((await insights(id)).helpers).toEqual(["Dal (toor/arhar)", "Rajma"]);
  });

  it("tracks the share of helpful meals week by week", async () => {
    const id = await profile();
    await report(id, "2026-09-22T08:00:00Z", LDL_HIGH);
    await log(id, "2026-09-23", paneerNaan); // week of 21 Sep: 0 of 1
    await log(id, "2026-09-29", dalRoti); // week of 28 Sep: 1 of 2
    await log(id, "2026-09-30", paneerNaan);
    await log(id, "2026-10-05", dalRoti); // week of 5 Oct: 1 of 1
    expect((await insights(id)).weeks).toEqual([
      { weekStart: "2026-09-21", supported: 0, total: 1 },
      { weekStart: "2026-09-28", supported: 1, total: 2 },
      { weekStart: "2026-10-05", supported: 1, total: 1 },
    ]);
  });

  it("compares the focus marker across reports only when there are two", async () => {
    const id = await profile();
    await report(id, "2026-08-01T08:00:00Z", LDL_HIGH);
    expect((await insights(id)).compare).toBeNull();
    await report(id, "2026-09-28T08:00:00Z", [{ marker: "ldl", value: 128, unit: "mg/dL" }]);
    expect((await insights(id)).compare).toEqual({
      marker: "ldl",
      label: "LDL cholesterol",
      unit: "mg/dL",
      before: { value: 142, reportDate: "2026-08-01" },
      after: { value: 128, reportDate: "2026-09-28" },
    });
  });

  it("still shows the before and after once the marker is back in range", async () => {
    const id = await profile();
    await report(id, "2026-08-01T08:00:00Z", LDL_HIGH);
    await report(id, "2026-09-28T08:00:00Z", [{ marker: "ldl", value: 95, unit: "mg/dL" }]);
    const res = await insights(id);
    expect(res.focus.key).toBe("balanced_plate");
    expect(res.compare).toMatchObject({ marker: "ldl", before: { value: 142 }, after: { value: 95 } });
  });

  it("lists the dishes worth eating less often for a high LDL, from what was actually eaten", async () => {
    const id = await profile();
    await report(id, "2026-09-28T08:00:00Z", LDL_HIGH);
    await log(id, "2026-09-29", paneerNaan);
    await log(id, "2026-09-30", paneerNaan);
    await log(id, "2026-10-01", [{ kind: "catalogue", foodId: "samosa", quantity: 1, unit: "piece" }]);
    await log(id, "2026-10-02", dalRoti);
    // naan is a refined carb, which matters for blood sugar, not LDL
    expect((await insights(id)).cutBackOn).toEqual([
      { name: "Paneer butter masala", times: 2, reason: "high in saturated fat" },
      { name: "Samosa", times: 1, reason: "fried" },
    ]);
  });

  it("picks sweets and refined carbs when HbA1c is the one worth watching", async () => {
    const id = await profile();
    await report(id, "2026-09-28T08:00:00Z", [{ marker: "hba1c", value: 6.1, unit: "%" }]);
    const gulabJamun = [{ kind: "catalogue", foodId: "gulab_jamun", quantity: 2, unit: "piece" }];
    await log(id, "2026-09-29", gulabJamun);
    await log(id, "2026-09-30", gulabJamun);
    await log(id, "2026-10-01", paneerNaan);
    expect((await insights(id)).cutBackOn).toEqual([
      { name: "Gulab jamun", times: 2, reason: "sweet" },
      { name: "Naan", times: 1, reason: "refined carbs" },
    ]);
  });

  it("covers every marker worth watching, not only the one behind the focus", async () => {
    const id = await profile();
    await report(id, "2026-09-28T08:00:00Z", [
      { marker: "ldl", value: 142, unit: "mg/dL" },
      { marker: "triglycerides", value: 200, unit: "mg/dL" },
    ]);
    await log(id, "2026-09-29", [{ kind: "catalogue", foodId: "naan", quantity: 1, unit: "piece" }]);
    await log(id, "2026-09-30", paneerNaan);
    const res = await insights(id);
    // triglycerides at 200 are further out of range, so they set the focus and lead the list
    expect(res.cutBackFor).toEqual(["Triglycerides", "LDL cholesterol"]);
    expect(res.cutBackOn).toEqual([
      { name: "Naan", times: 2, reason: "refined carbs" },
      { name: "Paneer butter masala", times: 1, reason: "high in saturated fat" },
    ]);
  });

  it("has nothing to cut back on when the markers are in range", async () => {
    const id = await profile();
    await report(id, "2026-09-28T08:00:00Z", [{ marker: "ldl", value: 90, unit: "mg/dL" }]);
    await log(id, "2026-09-29", paneerNaan);
    expect((await insights(id)).cutBackOn).toEqual([]);
  });

  it("breaks helping meals down by meal of the day, by day, and as a timeline", async () => {
    const id = await profile();
    await report(id, "2026-09-28T08:00:00Z", LDL_HIGH);
    const at = (date: string, mealType: string, items: unknown[], hour: string) =>
      api.post("/meals", { mealType, source: "text", eatenAt: `${date}T${hour}:00:00Z`, items }, id);
    await at("2026-09-29", "lunch", dalRoti, "07"); // helps
    await at("2026-09-29", "dinner", paneerNaan, "14"); // doesn't
    await at("2026-09-30", "lunch", rajmaRice, "07"); // helps
    await at("2026-10-01", "dinner", paneerNaan, "14"); // doesn't
    const res = await insights(id);
    expect(res.byMealType).toEqual([
      { mealType: "lunch", supported: 2, total: 2 },
      { mealType: "dinner", supported: 0, total: 2 },
    ]);
    expect(res.days).toEqual({ helped: 2, logged: 3 });
    expect(res.timeline.map((t: { supports: boolean }) => t.supports)).toEqual([true, false, true, false]);
    // fibre: dal-roti 12.2 + paneer-naan 3.4 + rajma-rice 9.1 + paneer-naan 3.4 over 3 days
    expect(res.avgFibreG).toBeGreaterThan(0);
  });

  it("says how long it has been since the report", async () => {
    const id = await profile();
    await report(id, "2026-08-20T08:00:00Z", LDL_HIGH);
    expect((await insights(id)).daysSinceReport).toBe(47);
  });
});
