import type { FocusInfo, FocusKey, MarkerKey, MarkerReading, MarkerStatus } from "@kimbo/shared";
import type { ExtractedReport } from "../ai/types.js";
import { HttpError } from "../errors.js";
import { FOCUS_PRIORITY, MARKER_THRESHOLDS } from "./config.js";

export const DISCLAIMER =
  "Kimbo doesn't diagnose or treat anything. Talk to your doctor about your results.";

interface MarkerDef {
  label: string;
  canonicalUnit: string;
  decimals: number;
  /** unit (normalised spelling) → factor/function to the canonical unit */
  conversions: Record<string, (v: number) => number>;
  matches: (name: string) => boolean;
}

const MARKERS: Record<MarkerKey, MarkerDef> = {
  ldl: {
    label: "LDL cholesterol",
    canonicalUnit: "mg/dL",
    decimals: 0,
    conversions: { "mg/dl": (v) => v, "mmol/l": (v) => v * 38.67 },
    matches: (n) => /\bldl\b|ldl c|low density/.test(n) && !/\bvldl\b|ratio/.test(n),
  },
  hba1c: {
    label: "HbA1c",
    canonicalUnit: "%",
    decimals: 1,
    conversions: { "%": (v) => v, "mmol/mol": (v) => v / 10.929 + 2.15 },
    matches: (n) => /hba1c|\ba1c\b|glycated|glycosylated/.test(n),
  },
  triglycerides: {
    label: "Triglycerides",
    canonicalUnit: "mg/dL",
    decimals: 0,
    conversions: { "mg/dl": (v) => v, "mmol/l": (v) => v * 88.57 },
    matches: (n) => /triglyceride|\btgl?\b/.test(n),
  },
};

const STATUS_LABELS: Record<MarkerStatus, string> = {
  in_range: "In range",
  worth_watching: "Worth watching",
  high: "Above the typical range",
};

const SEVERITY: Record<MarkerStatus, number> = { in_range: 0, worth_watching: 1, high: 2 };

export const SUPPORTED_MARKERS = (Object.keys(MARKERS) as MarkerKey[]).map((marker) => ({
  marker,
  label: MARKERS[marker].label,
  units: Object.keys(MARKERS[marker].conversions).map((u) => displayUnit(marker, u)),
}));

/** Lab values the app shows when the user wants to try the feature without their own report. */
export const SAMPLE_REPORT: ExtractedReport = {
  reportDate: null,
  markers: [
    { markerName: "LDL Cholesterol", value: 142, unit: "mg/dL" },
    { markerName: "HbA1c", value: 5.6, unit: "%" },
    { markerName: "Triglycerides", value: 160, unit: "mg/dL" },
    { markerName: "HDL Cholesterol", value: 44, unit: "mg/dL" },
  ],
};

function normaliseUnit(unit: string): string {
  const u = unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("mgs", "mg")
    .replace("percent", "%")
    .replace(/litre|liter|ltr/, "l");
  // mg% and mg/100ml are older spellings of mg/dL.
  return u === "mg%" || u === "mg/100ml" ? "mg/dl" : u;
}

function displayUnit(marker: MarkerKey, normalised: string): string {
  if (normalised === "mg/dl") return "mg/dL";
  if (normalised === "mmol/l") return "mmol/L";
  return normalised === "%" && marker === "hba1c" ? "%" : normalised;
}

function identify(markerName: string): MarkerKey | null {
  const n = markerName
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
  return (Object.keys(MARKERS) as MarkerKey[]).find((k) => MARKERS[k].matches(n)) ?? null;
}

export function classify(marker: MarkerKey, canonicalValue: number): MarkerStatus {
  const t = MARKER_THRESHOLDS[marker];
  if (canonicalValue >= t.high) return "high";
  if (canonicalValue >= t.worthWatching) return "worth_watching";
  return "in_range";
}

/** Converts to canonical units and classifies. Returns null when the unit can't be converted. */
export function reading(marker: MarkerKey, value: number, unit: string): MarkerReading | null {
  const def = MARKERS[marker];
  const convert = def.conversions[normaliseUnit(unit)];
  if (!convert) return null;
  const factor = 10 ** def.decimals;
  const canonical = Math.round(convert(value) * factor) / factor;
  const status = classify(marker, canonical);
  return {
    marker,
    label: def.label,
    value: canonical,
    unit: def.canonicalUnit,
    originalValue: value,
    originalUnit: unit,
    status,
    statusLabel: STATUS_LABELS[status],
  };
}

/** Keeps the supported markers from an extraction (first occurrence wins) and lists what was ignored. */
export function toDraftMarkers(extracted: ExtractedReport): { markers: MarkerReading[]; ignored: string[] } {
  const markers: MarkerReading[] = [];
  const ignored: string[] = [];
  for (const m of extracted.markers) {
    const key = identify(m.markerName);
    if (!key || markers.some((r) => r.marker === key)) {
      if (!key) ignored.push(m.markerName);
      continue;
    }
    const r = reading(key, m.value, m.unit);
    // Never guess a unit: leave it out so the user enters the value themselves.
    if (r) markers.push(r);
    else ignored.push(`${m.markerName} (unit ${m.unit} not recognised)`);
  }
  return { markers, ignored };
}

export function confirmedReading(marker: MarkerKey, value: number, unit: string): MarkerReading {
  const r = reading(marker, value, unit);
  if (!r) throw new HttpError(400, "UNSUPPORTED_UNIT", `Kimbo can't read ${MARKERS[marker].label} in ${unit}`);
  return r;
}

// ---------- Focus ----------

export const FOCI: Record<FocusKey, FocusInfo> = {
  fibre_focus: {
    key: "fibre_focus",
    title: "More fibre-rich meals",
    description: "More dal, rajma, chole, sabzi, salad and fruit. Fewer butter gravies and fried snacks.",
  },
  steady_carbs: {
    key: "steady_carbs",
    title: "Steady carbs",
    description: "Have rice or roti with dal, sabzi or egg. Keep mithai and sweet chai for once in a while.",
  },
  less_sugar_refined: {
    key: "less_sugar_refined",
    title: "Less sugar & refined carbs",
    description: "Fewer sweets, sugary chai, maida and fried snacks. More dal, sabzi and whole grains.",
  },
  balanced_plate: {
    key: "balanced_plate",
    title: "Balanced plates",
    description: "Some dal, paneer, egg or chicken plus a sabzi or salad at each meal.",
  },
};

const MARKER_FOCUS: Record<MarkerKey, FocusKey> = {
  ldl: "fibre_focus",
  hba1c: "steady_carbs",
  triglycerides: "less_sugar_refined",
};

/** Exactly one focus: the most out-of-range marker, ties broken by FOCUS_PRIORITY. */
export function selectFocus(readings: MarkerReading[]): FocusInfo & { reason: string } {
  const flagged = readings
    .filter((r) => r.status !== "in_range")
    .sort(
      (a, b) =>
        SEVERITY[b.status] - SEVERITY[a.status] || FOCUS_PRIORITY.indexOf(a.marker) - FOCUS_PRIORITY.indexOf(b.marker),
    );
  const top = flagged[0];
  if (!top) {
    return {
      ...FOCI.balanced_plate,
      reason: "Your markers are all in range.",
    };
  }
  return {
    ...FOCI[MARKER_FOCUS[top.marker]],
    reason: `Your ${top.label} (${top.value} ${top.unit}) is ${top.statusLabel.toLowerCase()}.`,
  };
}
