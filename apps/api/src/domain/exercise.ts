import type { ExerciseDraft, ExerciseKind, Intensity } from "@kimbo/shared";

/**
 * Energy cost in METs (Compendium of Physical Activities) by activity and intensity.
 * kcal = MET × body weight (kg) × hours. The model may name the activity; Kimbo does the maths.
 */
const MET: Record<Exclude<ExerciseKind, "manual">, Record<Intensity, number>> = {
  run: { low: 3.5, medium: 9.8, high: 23 },
  weights: { low: 3.5, medium: 5, high: 6 },
  walk: { low: 2.8, medium: 3.5, high: 5 },
  cycle: { low: 4, medium: 8, high: 10 },
  yoga: { low: 2.5, medium: 3, high: 4 },
  sport: { low: 5, medium: 7, high: 9 },
  other: { low: 3, medium: 5, high: 7 },
};

export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  run: "Run",
  weights: "Weight lifting",
  walk: "Walk",
  cycle: "Cycling",
  yoga: "Yoga",
  sport: "Sport",
  other: "Workout",
  manual: "Exercise",
};

export function burned(kind: Exclude<ExerciseKind, "manual">, intensity: Intensity, minutes: number, kg: number): number {
  return Math.max(1, Math.round(MET[kind][intensity] * kg * (minutes / 60)));
}

export function exerciseDraft(
  kind: Exclude<ExerciseKind, "manual">,
  intensity: Intensity,
  minutes: number,
  kg: number,
  label = EXERCISE_LABEL[kind],
): ExerciseDraft {
  return { kind, label, intensity, minutes, calories: burned(kind, intensity, minutes, kg) };
}

const KIND_WORDS: [RegExp, Exclude<ExerciseKind, "manual">, string | null][] = [
  [/\b(sprint\w*|ran|run\w*|jog\w*)\b/i, "run", "Run"],
  [/\b(gym|weights?|lift\w*|deadlifts?|squats?|bench)\b/i, "weights", "Weight lifting"],
  [/\b(walk\w*|stroll\w*|steps)\b/i, "walk", "Walk"],
  [/\b(cycl\w*|bik\w*|spin\w*)\b/i, "cycle", "Cycling"],
  [/\b(yoga|stretch\w*|pilates)\b/i, "yoga", "Yoga"],
  [/\b(cricket|football|badminton|tennis|basketball|swim\w*|swam|danc\w*|kabaddi|volleyball)\b/i, "sport", null],
];

/** True when a sentence is about a workout rather than food or water. */
export function looksLikeExercise(text: string): boolean {
  return KIND_WORDS.some(([re]) => re.test(text)) || /\b(workout|exercis\w*|trained|training)\b/i.test(text);
}

/** A rules-only reading of a described workout; used offline and as the model's fallback. */
export function readExerciseByRules(text: string): {
  activity: string;
  kind: Exclude<ExerciseKind, "manual">;
  intensity: Intensity;
  minutes: number | null;
} {
  const hit = KIND_WORDS.find(([re]) => re.test(text));
  const kind = hit?.[1] ?? "other";
  const word = hit ? text.match(hit[0])![0] : null;
  const activity = hit?.[2] ?? (word ? word[0]!.toUpperCase() + word.slice(1).toLowerCase() : EXERCISE_LABEL.other);
  const intensity: Intensity = /\b(hard|intense|heavy|fast|sprint\w*|tough|exhausting|failure|hiit)\b/i.test(text)
    ? "high"
    : /\b(easy|light|slow|chill|gentle|relaxed|not too tiring)\b/i.test(text)
      ? "low"
      : "medium";
  const num = text.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|m\b|hours?|hrs?|h\b)/i);
  const minutes = num
    ? Math.round(Number(num[1]) * (/^h/i.test(num[2]!) ? 60 : 1))
    : /\bhalf an hour\b/i.test(text)
      ? 30
      : /\b(an|one) hour\b/i.test(text)
        ? 60
        : null;
  return { activity, kind, intensity, minutes };
}
