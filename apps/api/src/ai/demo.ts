import { readExerciseByRules } from "../domain/exercise.js";
import type { ExerciseReader, ExtractedReport, MealRecognizer, ReadExercise, RecognizedItem, ReportExtractor } from "./types.js";

/**
 * Offline adapters for local development and demos without an AI key.
 * Text is split on commas/"and"/"with"/"+" and leading quantities are read;
 * photos and reports return a fixed sample.
 */

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  ek: 1,
  half: 0.5,
  two: 2,
  do: 2,
  three: 3,
  teen: 3,
  four: 4,
  char: 4,
  five: 5,
  six: 6,
};
const UNIT_WORDS = new Set([
  "piece",
  "pieces",
  "katori",
  "katoris",
  "vati",
  "bowl",
  "bowls",
  "plate",
  "plates",
  "glass",
  "glasses",
  "cup",
  "cups",
  "tbsp",
  "spoon",
  "spoons",
  "g",
  "gm",
  "grams",
  "slice",
  "slices",
]);

export function parseMealText(text: string): RecognizedItem[] {
  return text
    .toLowerCase()
    .split(/,|\band\b|\bwith\b|\+|\n/)
    .map((part) => part.trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0)
    .map((words) => {
      let quantity: number | null = null;
      let unit: string | null = null;
      const first = words[0]!;
      if (/^\d+(\.\d+)?$/.test(first)) quantity = Number(words.shift());
      else if (first in NUMBER_WORDS) quantity = NUMBER_WORDS[words.shift()!]!;
      if (words.length > 1 && UNIT_WORDS.has(words[0]!)) unit = words.shift()!;
      if (words[0] === "of") words.shift();
      return { name: words.join(" "), quantity, unit, confidence: 0.6 };
    })
    .filter((item) => item.name.length > 0);
}

export class DemoAdapters implements MealRecognizer, ReportExtractor, ExerciseReader {
  async readExercise(text: string): Promise<ReadExercise> {
    return readExerciseByRules(text);
  }

  async fromText(text: string): Promise<RecognizedItem[]> {
    return parseMealText(text);
  }

  async fromImage(): Promise<RecognizedItem[]> {
    // A typical North Indian thali, slightly misjudged so the review/correct flow is visible.
    return [
      { name: "roti", quantity: 2, unit: "piece", confidence: 0.9 },
      { name: "dal", quantity: 1, unit: "katori", confidence: 0.85 },
      { name: "aloo gobi", quantity: 1, unit: "katori", confidence: 0.7 },
      { name: "rice", quantity: 1, unit: "katori", confidence: 0.6 },
    ];
  }

  async extract(): Promise<ExtractedReport> {
    return {
      reportDate: null,
      markers: [
        { markerName: "LDL Cholesterol", value: 142, unit: "mg/dL" },
        { markerName: "HbA1c", value: 5.6, unit: "%" },
        { markerName: "Triglycerides", value: 160, unit: "mg/dL" },
        { markerName: "HDL Cholesterol", value: 44, unit: "mg/dL" },
      ],
    };
  }
}
