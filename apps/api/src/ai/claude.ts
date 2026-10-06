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
 * Claude-backed adapters. Claude only names foods/portions and reads report
 * values; Kimbo's catalogue and rules decide everything else.
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

const mealTool: Anthropic.Tool = {
  name: "record_meal_items",
  description: "Record each distinct food item in the meal.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Common Indian name of the dish, e.g. 'roti', 'dal', 'aloo gobi', 'chicken curry'" },
            quantity: { type: ["number", "null"], description: "Number of units, or null if not stated/visible" },
            unit: {
              type: ["string", "null"],
              description: "One of: piece, katori, bowl, plate, glass, cup, tbsp, g — or null if unclear",
            },
            confidence: { type: "number", description: "0–1 confidence in the identification" },
          },
          required: ["name", "quantity", "unit", "confidence"],
        },
      },
    },
    required: ["items"],
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

const reportTool: Anthropic.Tool = {
  name: "record_report_values",
  description: "Record the test results printed in the lab report.",
  input_schema: {
    type: "object",
    properties: {
      reportDate: { type: ["string", "null"], description: "Sample collection or report date as YYYY-MM-DD, or null" },
      markers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            markerName: { type: "string", description: "Test name exactly as printed, e.g. 'LDL Cholesterol', 'HbA1c'" },
            value: { type: "number" },
            unit: { type: "string", description: "Unit as printed, e.g. mg/dL, mmol/L, %, mmol/mol" },
          },
          required: ["markerName", "value", "unit"],
        },
      },
    },
    required: ["reportDate", "markers"],
  },
};

const REPORT_SYSTEM = `You transcribe blood test results from lab reports.
Copy the patient's result values and units exactly as printed — never reference ranges, never interpret.
Include lipid profile and diabetes markers you find (LDL, HDL, total cholesterol, triglycerides, HbA1c, fasting glucose).
If a value is unreadable, leave it out.`;

export class ClaudeAdapters implements MealRecognizer, ReportExtractor {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  }

  async fromText(text: string): Promise<RecognizedItem[]> {
    const input = await this.callTool(MEAL_SYSTEM, mealTool, [{ type: "text", text: `Meal: ${text}` }]);
    return RecognizedItems.parse(input).items;
  }

  async fromImage(image: { base64: string; mimeType: string }): Promise<RecognizedItem[]> {
    const input = await this.callTool(MEAL_SYSTEM, mealTool, [
      { type: "image", source: { type: "base64", media_type: imageType(image.mimeType), data: image.base64 } },
      { type: "text", text: "Identify the foods on this plate with estimated portions." },
    ]);
    return RecognizedItems.parse(input).items;
  }

  async extract(file: { base64: string; mimeType: string }): Promise<ExtractedReport> {
    const source: Anthropic.ContentBlockParam =
      file.mimeType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } }
        : { type: "image", source: { type: "base64", media_type: imageType(file.mimeType), data: file.base64 } };
    const input = await this.callTool(REPORT_SYSTEM, reportTool, [source, { type: "text", text: "Record the results." }]);
    return ExtractedMarkers.parse(input);
  }

  private async callTool(system: string, tool: Anthropic.Tool, content: Anthropic.ContentBlockParam[]): Promise<unknown> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("No tool output");
      return block.input;
    } catch (err) {
      throw new AiUnavailableError(undefined, { cause: err });
    }
  }
}

function imageType(mimeType: string): ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(mimeType) ? (mimeType as ImageType) : "image/jpeg";
}
