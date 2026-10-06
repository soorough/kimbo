import { describe, expect, it } from "vitest";
import { AiUnavailableError } from "../src/ai/types.js";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

type Marker = { marker: string; value: number; unit: string; status: string; statusLabel: string };
const byMarker = (markers: Marker[]) => Object.fromEntries(markers.map((m) => [m.marker, m]));

async function confirm(id: string, markers: { marker: string; value: number; unit: string }[]) {
  return api.post("/reports", { reportDate: "2026-09-28", source: "manual", markers }, id);
}

describe("reading a blood report", () => {
  it("offers a sample report to try the feature", async () => {
    const id = await profile();
    const res = await api.post("/reports/extract", { sample: true }, id);
    expect(res.status).toBe(200);
    const m = byMarker(res.json.markers);
    expect(m.ldl).toMatchObject({ value: 142, unit: "mg/dL", status: "worth_watching", statusLabel: "Worth watching" });
    expect(m.hba1c).toMatchObject({ value: 5.6, unit: "%", status: "in_range" });
    expect(m.triglycerides).toMatchObject({ value: 160, unit: "mg/dL", status: "worth_watching" });
    expect(res.json.disclaimer).toMatch(/doesn't diagnose/);
  });

  it("extracts supported markers from an upload, normalising lab units and naming variants", async () => {
    const id = await profile();
    api.ctx.extractor.next = {
      reportDate: "2026-09-20",
      markers: [
        { markerName: "LDL-C (Direct)", value: 3.9, unit: "mmol/L" },
        { markerName: "Glycated Haemoglobin (HbA1c)", value: 48, unit: "mmol/mol" },
        { markerName: "Serum Triglycerides", value: 2.0, unit: "mmol/L" },
        { markerName: "HDL Cholesterol", value: 44, unit: "mg/dL" },
        { markerName: "VLDL", value: 32, unit: "mg/dL" },
        { markerName: "Haemoglobin", value: 13.5, unit: "g/dL" },
      ],
    };
    const res = await api.post("/reports/extract", { fileBase64: "JVBERi0=", mimeType: "application/pdf" }, id);
    expect(res.status).toBe(200);
    expect(res.json.reportDate).toBe("2026-09-20");
    const m = byMarker(res.json.markers);
    // 3.9 mmol/L × 38.67 = 150.8 → 151 mg/dL; 48 mmol/mol → 48/10.929 + 2.15 = 6.54 → 6.5 %; 2.0 × 88.57 = 177 mg/dL
    expect(m.ldl).toMatchObject({ value: 151, unit: "mg/dL", originalValue: 3.9, originalUnit: "mmol/L" });
    expect(m.hba1c).toMatchObject({ value: 6.5, unit: "%", status: "high" });
    expect(m.triglycerides).toMatchObject({ value: 177, unit: "mg/dL" });
    expect(res.json.ignored).toEqual(["HDL Cholesterol", "VLDL", "Haemoglobin"]);
    expect(res.json.supportedMarkers.map((s: { marker: string }) => s.marker)).toEqual(["ldl", "hba1c", "triglycerides"]);
  });

  it("returns an empty draft when nothing supported is found, so the user can enter values or use the sample", async () => {
    const id = await profile();
    api.ctx.extractor.next = { reportDate: null, markers: [{ markerName: "TSH", value: 2.1, unit: "mIU/L" }] };
    const res = await api.post("/reports/extract", { fileBase64: "aW1n", mimeType: "image/jpeg" }, id);
    expect(res.status).toBe(200);
    expect(res.json.markers).toEqual([]);
    expect(res.json.ignored).toEqual(["TSH"]);
  });

  it("returns a retryable error when extraction fails", async () => {
    const id = await profile();
    api.ctx.extractor.next = new AiUnavailableError();
    const res = await api.post("/reports/extract", { fileBase64: "aW1n", mimeType: "image/jpeg" }, id);
    expect(res.status).toBe(502);
    expect(res.json).toMatchObject({ code: "AI_UNAVAILABLE", retryable: true });
  });

  it("applies nothing until the user confirms", async () => {
    const id = await profile();
    await api.post("/reports/extract", { sample: true }, id);
    expect((await api.get("/reports", id)).json.reports).toEqual([]);
  });
});

describe("confirming a report into one food focus", () => {
  it("saves confirmed values and turns a watched LDL into a fibre focus", async () => {
    const id = await profile();
    const res = await confirm(id, [
      { marker: "ldl", value: 142, unit: "mg/dL" },
      { marker: "hba1c", value: 5.4, unit: "%" },
    ]);
    expect(res.status).toBe(201);
    expect(res.json.focus).toMatchObject({ key: "fibre_focus", title: "More fibre-rich meals" });
    expect(res.json.focus.reason).toMatch(/LDL/);
    expect(res.json.events.map((e: { type: string }) => e.type)).toEqual(["report_became_focus"]);
    expect(res.json.disclaimer).toMatch(/doctor/);
    const reports = await api.get("/reports", id);
    expect(reports.json.reports).toHaveLength(1);
    expect(reports.json.reports[0]).toMatchObject({ reportDate: "2026-09-28", source: "manual" });
  });

  it("uses the values the user corrected, not what was extracted", async () => {
    const id = await profile();
    api.ctx.extractor.next = { reportDate: null, markers: [{ markerName: "LDL", value: 180, unit: "mg/dL" }] };
    await api.post("/reports/extract", { fileBase64: "aW1n", mimeType: "image/jpeg" }, id);
    const res = await confirm(id, [{ marker: "ldl", value: 80, unit: "mg/dL" }]);
    expect(byMarker(res.json.report.markers).ldl?.status).toBe("in_range");
    expect(res.json.focus.key).toBe("balanced_plate");
  });

  it.each([
    ["HbA1c worth watching → steady carbs", [{ marker: "hba1c", value: 6.0, unit: "%" }], "steady_carbs"],
    ["triglycerides worth watching → less sugar", [{ marker: "triglycerides", value: 170, unit: "mg/dL" }], "less_sugar_refined"],
    [
      "all in range → balanced plates",
      [
        { marker: "ldl", value: 90, unit: "mg/dL" },
        { marker: "hba1c", value: 5.2, unit: "%" },
        { marker: "triglycerides", value: 110, unit: "mg/dL" },
      ],
      "balanced_plate",
    ],
    [
      "a higher marker wins over a watched one",
      [
        { marker: "ldl", value: 120, unit: "mg/dL" },
        { marker: "hba1c", value: 6.8, unit: "%" },
      ],
      "steady_carbs",
    ],
    [
      "ties go to LDL first",
      [
        { marker: "triglycerides", value: 180, unit: "mg/dL" },
        { marker: "ldl", value: 130, unit: "mg/dL" },
        { marker: "hba1c", value: 6.0, unit: "%" },
      ],
      "fibre_focus",
    ],
  ])("%s", async (_name, markers, focus) => {
    const id = await profile();
    const res = await confirm(id, markers);
    expect(res.json.focus.key).toBe(focus);
  });

  it.each([
    ["ldl", 99, "mg/dL", "in_range"],
    ["ldl", 100, "mg/dL", "worth_watching"],
    ["ldl", 160, "mg/dL", "high"],
    ["hba1c", 5.6, "%", "in_range"],
    ["hba1c", 5.7, "%", "worth_watching"],
    ["hba1c", 6.5, "%", "high"],
    ["triglycerides", 149, "mg/dL", "in_range"],
    ["triglycerides", 150, "mg/dL", "worth_watching"],
    ["triglycerides", 200, "mg/dL", "high"],
  ])("classifies %s %s %s as %s", async (marker, value, unit, status) => {
    const id = await profile();
    const res = await confirm(id, [{ marker, value, unit }]);
    expect(res.json.report.markers[0].status).toBe(status);
  });

  it("rejects units Kimbo can't convert", async () => {
    const id = await profile();
    const res = await confirm(id, [{ marker: "ldl", value: 140, unit: "g/L" }]);
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("UNSUPPORTED_UNIT");
  });

  it("needs at least one confirmed marker", async () => {
    const id = await profile();
    const res = await confirm(id, []);
    expect(res.status).toBe(400);
  });
});
