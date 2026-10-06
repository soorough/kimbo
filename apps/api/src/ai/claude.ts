import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  AiUnavailableError,
  type ExtractedReport,
  type MealRecognizer,
  type RecognizedItem,
  type ReportExtractor,
} from "./types.js";

/**
 * Claude-backed adapters using structured outputs. Claude only names
 * foods/portions and reads report values; Kimbo's catalogue and rules decide
 * everything else.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const RecognizedItems = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

/** Structured-output schema for meal recognition. */
const MEAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "confidence"],
        properties: {
          name: { type: "string", description: "Common Indian name of the dish, e.g. 'roti', 'dal', 'aloo gobi'" },
          quantity: nullable({ type: "number" }),
          unit: nullable({ type: "string", description: "piece, katori, bowl, plate, glass, cup, tbsp or g" }),
          confidence: { type: "number", description: "0–1 confidence in the identification" },
        },
      },
    },
  },
};

const MEAL_SYSTEM = `You identify foods in Indian meals for a food-logging app.
List each separate dish or component once (e.g. a thali becomes roti, rice, dal, sabzi, curd, salad).
Use everyday Indian names (roti not 'flatbread', dal not 'lentil soup').
Use Indian household portions: roti/idli/egg = piece; dal/sabzi/curd = katori; rice can be katori or plate; chai = cup.
Never estimate calories or nutrition. If there is no food, return an empty list.`;

const ExtractedMarkers = z.object({
  reportDate: z.string().nullable(),
  markers: z.array(z.object({ markerName: z.string(), value: z.number(), unit: z.string() })),
});

/** Structured-output schema for lab report transcription. */
const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reportDate", "markers"],
  properties: {
    reportDate: nullable({ type: "string", description: "Sample collection or report date as YYYY-MM-DD" }),
    markers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["markerName", "value", "unit"],
        properties: {
          markerName: { type: "string", description: "Test name exactly as printed, e.g. 'LDL Cholesterol', 'HbA1c'" },
          value: { type: "number" },
          unit: { type: "string", description: "Unit as printed, e.g. mg/dL, mmol/L, %, mmol/mol" },
        },
      },
    },
  },
};

const REPORT_SYSTEM = `You transcribe blood test results from lab reports.
Copy the patient's result values and units exactly as printed — never reference ranges, never interpret.
Include lipid profile and diabetes markers you find (LDL, HDL, total cholesterol, triglycerides, HbA1c, fasting glucose).
If a value is unreadable, leave it out.`;

export class ClaudeAdapters implements MealRecognizer, ReportExtractor {
  private client: Anthropic;
  private mealSystem: string;

  /** knownDishes: Kimbo's catalogue names, offered so Claude names dishes the way Kimbo will recognise. */
  constructor(
    apiKey: string,
    private model: string,
    knownDishes: string[] = [],
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
    this.mealSystem = knownDishes.length
      ? `${MEAL_SYSTEM}\nWhen a dish is one of these, use exactly this name: ${knownDishes.join(", ")}.\nOtherwise use its common Indian name — never force a dish into this list.`
      : MEAL_SYSTEM;
  }

  async fromText(text: string): Promise<RecognizedItem[]> {
    const input = await this.callJson(this.mealSystem, MEAL_SCHEMA, [{ type: "text", text: `Meal: ${text}` }]);
    return checked(() => RecognizedItems.parse(input).items);
  }

  async fromImage(image: { base64: string; mimeType: string }): Promise<RecognizedItem[]> {
    const input = await this.callJson(this.mealSystem, MEAL_SCHEMA, [
      { type: "image", source: { type: "base64", media_type: imageType(image.mimeType), data: image.base64 } },
      { type: "text", text: "Identify the foods on this plate with estimated portions." },
    ]);
    return checked(() => RecognizedItems.parse(input).items);
  }

  async extract(file: { base64: string; mimeType: string }): Promise<ExtractedReport> {
    const source: Anthropic.ContentBlockParam =
      file.mimeType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } }
        : { type: "image", source: { type: "base64", media_type: imageType(file.mimeType), data: file.base64 } };
    const input = await this.callJson(REPORT_SYSTEM, REPORT_SCHEMA, [
      source,
      { type: "text", text: "Record the results." },
    ]);
    return checked(() => ExtractedMarkers.parse(input));
  }

  /** One request with a JSON-schema constrained answer; any failure is a provider failure. */
  private async callJson(system: string, schema: object, content: Anthropic.ContentBlockParam[]): Promise<unknown> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system,
        output_config: { effort: "low", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
        messages: [{ role: "user", content }],
      });
      const text = res.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error(`No text output (stop_reason ${res.stop_reason})`);
      return JSON.parse(text.text);
    } catch (err) {
      throw new AiUnavailableError(undefined, { cause: err });
    }
  }
}

/** Malformed model output is a provider failure (retryable), not a client error. */
function checked<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    throw new AiUnavailableError(undefined, { cause: err });
  }
}

function imageType(mimeType: string): ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(mimeType) ? (mimeType as ImageType) : "image/jpeg";
}
