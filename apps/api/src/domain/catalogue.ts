import type { Food, Nutrition, Unit, UnitOption } from "@kimbo/shared";
import { CATALOGUE, type CatalogueEntry } from "./catalogue-data.js";

export { CATALOGUE_VERSION } from "./catalogue-data.js";

const UNIT_LABELS: Record<Unit, string> = {
  piece: "piece",
  katori: "katori",
  bowl: "bowl",
  plate: "plate",
  glass: "glass",
  cup: "cup",
  tbsp: "tbsp",
  g: "grams",
};

/** Free-form unit words (from AI or users) → Kimbo units. */
const UNIT_ALIASES: Record<string, Unit> = {
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", no: "piece", nos: "piece", whole: "piece",
  slice: "piece", slices: "piece", serving: "piece", servings: "piece",
  katori: "katori", katoris: "katori", vati: "katori", vatis: "katori", "small bowl": "katori", "small bowls": "katori",
  bowl: "bowl", bowls: "bowl", "large bowl": "bowl", "big bowl": "bowl",
  plate: "plate", plates: "plate", thali: "plate",
  glass: "glass", glasses: "glass",
  cup: "cup", cups: "cup", mug: "cup", mugs: "cup",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", spoon: "tbsp", spoons: "tbsp", chamach: "tbsp",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", ml: "g",
};

const byId = new Map(CATALOGUE.map((e) => [e.id, e]));

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("es") && !word.endsWith("ies")) return word.slice(0, -1);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const exactIndex = new Map<string, CatalogueEntry>();
for (const entry of CATALOGUE) {
  for (const alias of [entry.name, ...entry.aliases]) exactIndex.set(normalise(alias), entry);
}

function containsPhrase(haystack: string[], needle: string[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Resolves a free-form dish name to a catalogue entry, or null when Kimbo doesn't know it. */
export function match(name: string): CatalogueEntry | null {
  const norm = normalise(name);
  const words = norm.split(" ").filter(Boolean);
  const singularWords = words.map(singular);
  const exact = exactIndex.get(norm) ?? exactIndex.get(singularWords.join(" "));
  if (exact) return exact;

  // Otherwise pick the longest alias that appears as a whole phrase in the name.
  let best: { entry: CatalogueEntry; length: number } | null = null;
  for (const [alias, entry] of exactIndex) {
    const aliasWords = alias.split(" ");
    if (containsPhrase(words, aliasWords) || containsPhrase(singularWords, aliasWords)) {
      if (!best || alias.length > best.length) best = { entry, length: alias.length };
    }
  }
  return best?.entry ?? null;
}

export function getEntry(id: string): CatalogueEntry | null {
  return byId.get(id) ?? null;
}

export function gramsPerUnit(entry: CatalogueEntry, unit: Unit): number | null {
  if (unit === "g") return 1;
  return entry.units[unit] ?? null;
}

/** Maps a free-form unit to one this food supports, defaulting to the food's usual portion. */
export function resolveUnit(entry: CatalogueEntry, rawUnit: string | null): Unit {
  if (rawUnit) {
    const norm = normalise(rawUnit);
    const unit = UNIT_ALIASES[norm];
    if (unit && gramsPerUnit(entry, unit) !== null) return unit;
    // "3 rotis" — the unit is the dish itself, i.e. pieces.
    if (match(norm) === entry && gramsPerUnit(entry, "piece") !== null) return "piece";
  }
  return entry.defaultUnit;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function roundNutrition(n: Nutrition): Nutrition {
  return {
    calories: Math.round(n.calories),
    protein: round1(n.protein),
    carbs: round1(n.carbs),
    fat: round1(n.fat),
    fibre: round1(n.fibre),
    satFat: round1(n.satFat),
  };
}

/** Nutrition for one unit of a food, rounded — the basis every other figure is derived from. */
export function perUnit(entry: CatalogueEntry, unit: Unit): Nutrition {
  const grams = gramsPerUnit(entry, unit);
  if (grams === null) throw new Error(`${entry.id} has no ${unit} portion`);
  const [calories, protein, carbs, fat, fibre, satFat] = entry.per100.map((v) => (v * grams) / 100) as [
    number, number, number, number, number, number,
  ];
  return roundNutrition({ calories, protein, carbs, fat, fibre, satFat });
}

/**
 * quantity × per-unit nutrition. The app recomputes this the same way while the
 * user edits, so the review sheet and the saved meal always agree.
 */
export function scale(unitNutrition: Nutrition, quantity: number): Nutrition {
  return roundNutrition({
    calories: unitNutrition.calories * quantity,
    protein: unitNutrition.protein * quantity,
    carbs: unitNutrition.carbs * quantity,
    fat: unitNutrition.fat * quantity,
    fibre: unitNutrition.fibre * quantity,
    satFat: unitNutrition.satFat * quantity,
  });
}

export function nutritionFor(entry: CatalogueEntry, quantity: number, unit: Unit): Nutrition {
  return scale(perUnit(entry, unit), quantity);
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  return roundNutrition(
    items.reduce(
      (acc, n) => ({
        calories: acc.calories + n.calories,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
        fibre: acc.fibre + n.fibre,
        satFat: acc.satFat + n.satFat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, satFat: 0 },
    ),
  );
}

export function toFood(entry: CatalogueEntry): Food {
  const units = [...(Object.keys(entry.units) as Unit[]), "g" as const];
  const options: UnitOption[] = units.map((unit) => ({
    unit,
    label: unit === "g" ? UNIT_LABELS.g : `${UNIT_LABELS[unit]} (~${gramsPerUnit(entry, unit)} g)`,
    perUnit: perUnit(entry, unit),
  }));
  return { id: entry.id, name: entry.name, defaultUnit: entry.defaultUnit, units: options, tags: entry.tags };
}

export function search(query: string, limit = 25): Food[] {
  const q = normalise(query);
  if (!q) return CATALOGUE.map(toFood).sort((a, b) => a.name.localeCompare(b.name));
  const scored: { entry: CatalogueEntry; score: number }[] = [];
  for (const entry of CATALOGUE) {
    let score = 0;
    for (const alias of [entry.name, ...entry.aliases].map(normalise)) {
      if (alias === q) score = Math.max(score, 3);
      else if (alias.startsWith(q)) score = Math.max(score, 2);
      else if (alias.includes(q)) score = Math.max(score, 1);
    }
    if (score > 0) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((s) => toFood(s.entry));
}
