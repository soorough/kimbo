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

  it("says how long it has been since the report", async () => {
    const id = await profile();
    await report(id, "2026-08-20T08:00:00Z", LDL_HIGH);
    expect((await insights(id)).daysSinceReport).toBe(47);
  });
});
