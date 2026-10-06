import { z } from "zod";
import { isWeightGoal, PACES } from "./goal";

// ---------- Common ----------

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export const LocalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Not a real calendar date");

export const Nutrition = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fibre: z.number().nonnegative(),
  satFat: z.number().nonnegative(),
});
export type Nutrition = z.infer<typeof Nutrition>;

export const Unit = z.enum(["piece", "katori", "bowl", "plate", "glass", "cup", "tbsp", "g"]);
export type Unit = z.infer<typeof Unit>;

export const FoodTag = z.enum(["fibre_rich", "high_sat_fat", "refined_carb", "fried", "high_sugar", "lean_protein"]);
export type FoodTag = z.infer<typeof FoodTag>;

// ---------- Achievements / events ----------

export const KimboEventType = z.enum([
  "first_3_days",
  "first_full_week",
  "consistency_improved",
  "focus_improved",
  "welcome_back",
  "meal_supported_focus",
  "report_became_focus",
  "correction_accepted",
  "first_weigh_in",
  "kg_progress",
  "halfway_to_goal",
  "goal_reached",
  "on_target_3",
  "on_target_7",
]);
export type KimboEventType = z.infer<typeof KimboEventType>;

export const KimboEvent = z.object({
  type: KimboEventType,
  message: z.string(),
});
export type KimboEvent = z.infer<typeof KimboEvent>;

export const Achievement = z.object({
  key: z.string(),
  type: KimboEventType,
  title: z.string(),
  unlockedAt: z.string(),
});
export type Achievement = z.infer<typeof Achievement>;

// ---------- Profile & goal ----------

export const Sex = z.enum(["male", "female", "other"]);
export const ActivityLevel = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export type ActivityLevel = z.infer<typeof ActivityLevel>;
export const GoalType = z.enum(["lose", "maintain", "build_muscle", "recomp"]);

export const CreateProfileRequest = z.object({
  mode: z.enum(["fresh", "demo"]),
  timezone: z.string().optional(),
});
export type CreateProfileRequest = z.infer<typeof CreateProfileRequest>;

const GoalFields = z.object({
  age: z.number().int().min(15, "Age must be 15 or over").max(100, "Age must be 100 or under"),
  sex: Sex,
  heightCm: z.number().min(100, "Height must be at least 100 cm").max(250, "Height must be at most 250 cm"),
  weightKg: z.number().min(30, "Weight must be at least 30 kg").max(300, "Weight must be at most 300 kg"),
  activity: ActivityLevel,
  goal: GoalType,
  /** kg per week; one of PACES[goal]. Ignored for maintain. */
  weeklyKg: z.number().optional(),
  targetWeightKg: z.number().min(30).max(300).optional(),
  targetOverride: z.number().int().optional(),
});

export const GoalRequest = GoalFields.superRefine((g, ctx) => {
  if (isWeightGoal(g.goal) && g.weeklyKg !== undefined && !PACES[g.goal].includes(g.weeklyKg)) {
    ctx.addIssue({
      code: "custom",
      path: ["weeklyKg"],
      message: `Pick ${PACES[g.goal].join(", ")} kg a week`,
    });
  }
  if (g.targetWeightKg !== undefined) {
    if (g.goal === "lose" && g.targetWeightKg >= g.weightKg) {
      ctx.addIssue({ code: "custom", path: ["targetWeightKg"], message: "Goal weight should be below your current weight" });
    }
    if (g.goal === "build_muscle" && g.targetWeightKg <= g.weightKg) {
      ctx.addIssue({ code: "custom", path: ["targetWeightKg"], message: "Goal weight should be above your current weight" });
    }
  }
});
export type GoalRequest = z.infer<typeof GoalRequest>;

export const MacroTargets = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fibre: z.number(),
  /** upper limit in grams */
  satFat: z.number(),
});
export type MacroTargets = z.infer<typeof MacroTargets>;

export const Goal = GoalFields.omit({ targetOverride: true, weeklyKg: true, targetWeightKg: true }).extend({
  weeklyKg: z.number(),
  targetWeightKg: z.number().nullable(),
  computedTarget: z.number(),
  targetOverride: z.number().nullable(),
  effectiveTarget: z.number(),
  explanation: z.array(z.string()),
  /** The same calculation as numbers, for visual display. kgPerWeek is an approximate pace. */
  breakdown: z.object({
    bmr: z.number(),
    activityFactor: z.number(),
    maintenance: z.number(),
    adjustment: z.number(),
    kgPerWeek: z.number(),
    weeksToGoal: z.number().nullable(),
  }),
  targets: MacroTargets,
});
export type Goal = z.infer<typeof Goal>;

/** First name, or null to stop using one. Blank counts as null. */
export const NameRequest = z.object({
  name: z
    .string()
    .trim()
    .max(30, "Keep it under 30 characters")
    .nullable()
    .transform((n) => n || null),
});
export type NameRequest = z.infer<typeof NameRequest>;

export const Profile = z.object({
  id: z.string(),
  name: z.string().nullable(),
  isDemo: z.boolean(),
  timezone: z.string(),
  createdAt: z.string(),
  goal: Goal.nullable(),
});
export type Profile = z.infer<typeof Profile>;

// ---------- Foods ----------

export const UnitOption = z.object({
  unit: Unit,
  label: z.string(),
  perUnit: Nutrition,
});
export type UnitOption = z.infer<typeof UnitOption>;

export const Food = z.object({
  id: z.string(),
  name: z.string(),
  defaultUnit: Unit,
  units: z.array(UnitOption),
  tags: z.array(FoodTag),
});
export type Food = z.infer<typeof Food>;

export const FoodSearchResponse = z.object({ foods: z.array(Food) });

// ---------- Meals ----------

export const MealType = z.enum(["breakfast", "lunch", "snack", "dinner"]);
export type MealType = z.infer<typeof MealType>;
export const MealSource = z.enum(["photo", "text", "voice", "manual", "repeat"]);
export type MealSource = z.infer<typeof MealSource>;

export const ParseMealRequest = z.union([
  z.object({ text: z.string().trim().min(1, "Describe your meal") }),
  z.object({ imageBase64: z.string().min(1), mimeType: z.string() }),
]);
export type ParseMealRequest = z.infer<typeof ParseMealRequest>;

export const DraftItem = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("catalogue"),
    food: Food,
    heardAs: z.string(),
    quantity: z.number().positive(),
    unit: Unit,
    nutrition: Nutrition,
  }),
  z.object({
    kind: z.literal("estimate"),
    heardAs: z.string(),
    name: z.string(),
    quantity: z.number().positive(),
    unit: z.string(),
    nutrition: Nutrition,
  }),
]);
export type DraftItem = z.infer<typeof DraftItem>;

export const MealDraft = z.object({
  items: z.array(DraftItem),
  totals: Nutrition,
  suggestedMealType: MealType,
});
export type MealDraft = z.infer<typeof MealDraft>;

export const ConfirmItem = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("catalogue"),
    foodId: z.string(),
    // Household units are capped server-side at 50; grams can go higher.
    quantity: z.number().positive().max(2000),
    unit: Unit,
  }),
  z.object({
    kind: z.literal("estimate"),
    name: z.string().trim().min(1),
    quantity: z.number().positive().max(50),
    unit: z.string().min(1),
    nutrition: Nutrition,
  }),
]);
export type ConfirmItem = z.infer<typeof ConfirmItem>;

export const ConfirmMealRequest = z.object({
  mealType: MealType,
  eatenAt: z.iso.datetime({ offset: true }).optional(),
  source: MealSource,
  wasCorrected: z.boolean().default(false),
  items: z.array(ConfirmItem).min(1, "Add at least one item"),
});
export type ConfirmMealRequest = z.input<typeof ConfirmMealRequest>;

export const MealItem = z.object({
  id: z.string(),
  foodId: z.string().nullable(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  nutrition: Nutrition,
  isEstimate: z.boolean(),
});
export type MealItem = z.infer<typeof MealItem>;

export const Meal = z.object({
  id: z.string(),
  mealType: MealType,
  eatenAt: z.string(),
  localDate: LocalDate,
  source: MealSource,
  wasCorrected: z.boolean(),
  items: z.array(MealItem),
  totals: Nutrition,
});
export type Meal = z.infer<typeof Meal>;

export const FocusKey = z.enum(["fibre_focus", "steady_carbs", "less_sugar_refined", "balanced_plate"]);
export type FocusKey = z.infer<typeof FocusKey>;

export const FocusInfo = z.object({
  key: FocusKey,
  title: z.string(),
  description: z.string(),
});
export type FocusInfo = z.infer<typeof FocusInfo>;

export const FocusResult = z.object({
  focus: FocusKey,
  supports: z.boolean(),
  reason: z.string(),
});
export type FocusResult = z.infer<typeof FocusResult>;

export const ConfirmMealResponse = z.object({
  meal: Meal,
  focusResult: FocusResult.nullable(),
  events: z.array(KimboEvent),
});
export type ConfirmMealResponse = z.infer<typeof ConfirmMealResponse>;

export const MealsResponse = z.object({ meals: z.array(Meal) });

/** A meal logged before, offered as one-tap quick add; `draft` opens straight in review. */
export const RecentMeal = z.object({
  key: z.string(),
  label: z.string(),
  calories: z.number(),
  timesLogged: z.number(),
  draft: MealDraft,
});
export type RecentMeal = z.infer<typeof RecentMeal>;
export const RecentMealsResponse = z.object({ meals: z.array(RecentMeal) });

const SavedMealName = z.string().trim().min(1, "Give the meal a name").max(40, "Keep the name under 40 characters");
export const SaveMealRequest = z.object({
  name: SavedMealName,
  items: z.array(ConfirmItem).min(1, "Add at least one item"),
});
export type SaveMealRequest = z.input<typeof SaveMealRequest>;
export const RenameSavedMealRequest = z.object({ name: SavedMealName });

/** A meal the user named and kept in "My meals"; `draft` opens straight in review. */
export const SavedMeal = z.object({ id: z.string(), name: z.string(), calories: z.number(), draft: MealDraft });
export type SavedMeal = z.infer<typeof SavedMeal>;
export const SavedMealResponse = z.object({ meal: SavedMeal });
export const SavedMealsResponse = z.object({ meals: z.array(SavedMeal) });

export const RepeatYesterdayRequest = z.object({ mealType: MealType });

// ---------- Reports ----------

export const MarkerKey = z.enum(["ldl", "hba1c", "triglycerides"]);
export type MarkerKey = z.infer<typeof MarkerKey>;
export const MarkerStatus = z.enum(["in_range", "worth_watching", "high"]);
export type MarkerStatus = z.infer<typeof MarkerStatus>;
export const ReportSource = z.enum(["upload", "sample", "manual"]);

export const ExtractReportRequest = z.union([
  z.object({ sample: z.literal(true) }),
  z.object({ fileBase64: z.string().min(1), mimeType: z.string() }),
]);
export type ExtractReportRequest = z.infer<typeof ExtractReportRequest>;

export const MarkerReading = z.object({
  marker: MarkerKey,
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  originalValue: z.number(),
  originalUnit: z.string(),
  status: MarkerStatus,
  statusLabel: z.string(),
});
export type MarkerReading = z.infer<typeof MarkerReading>;

export const SupportedMarker = z.object({ marker: MarkerKey, label: z.string(), units: z.array(z.string()) });

export const ReportDraft = z.object({
  markers: z.array(MarkerReading),
  reportDate: LocalDate.nullable(),
  ignored: z.array(z.string()),
  supportedMarkers: z.array(SupportedMarker),
  disclaimer: z.string(),
});
export type ReportDraft = z.infer<typeof ReportDraft>;

export const ConfirmReportRequest = z.object({
  reportDate: LocalDate,
  source: ReportSource,
  markers: z
    .array(z.object({ marker: MarkerKey, value: z.number().positive(), unit: z.string() }))
    .min(1, "Confirm at least one marker"),
});
export type ConfirmReportRequest = z.infer<typeof ConfirmReportRequest>;

export const Report = z.object({
  id: z.string(),
  reportDate: LocalDate,
  source: ReportSource,
  markers: z.array(MarkerReading),
});
export type Report = z.infer<typeof Report>;

export const FocusWithReason = FocusInfo.extend({ reason: z.string() });

export const ConfirmReportResponse = z.object({
  report: Report,
  focus: FocusWithReason,
  events: z.array(KimboEvent),
  disclaimer: z.string(),
});
export type ConfirmReportResponse = z.infer<typeof ConfirmReportResponse>;

export const ReportsResponse = z.object({ reports: z.array(Report) });

/**
 * What changed since the latest report. Meal counts describe behaviour only; marker
 * values are compared only when two real reports exist.
 */
export const ReportInsights = z.object({
  reportDate: LocalDate,
  since: LocalDate,
  daysSinceReport: z.number(),
  focus: z.object({ key: FocusKey, title: z.string() }),
  /** the reading that set the focus; null for a balanced plate */
  marker: MarkerReading.nullable(),
  supported: z.number(),
  total: z.number(),
  pct: z.number(),
  weeks: z.array(z.object({ weekStart: LocalDate, supported: z.number(), total: z.number() })),
  helpers: z.array(z.string()),
  /** dishes eaten since the report that work against the focus, most frequent first */
  cutBackOn: z.array(z.object({ name: z.string(), times: z.number(), reason: z.string() })),
  /** labels of the markers worth watching that the list is for */
  cutBackFor: z.array(z.string()),
  byMealType: z.array(z.object({ mealType: MealType, supported: z.number(), total: z.number() })),
  /** days with at least one helping meal, out of days with any meal logged */
  days: z.object({ helped: z.number(), logged: z.number() }),
  /** meals since the report in order, most recent last (capped) */
  timeline: z.array(z.object({ date: LocalDate, mealType: MealType, supports: z.boolean() })),
  avgFibreG: z.number(),
  compare: z
    .object({
      marker: MarkerKey,
      label: z.string(),
      unit: z.string(),
      before: z.object({ value: z.number(), reportDate: LocalDate }),
      after: z.object({ value: z.number(), reportDate: LocalDate }),
    })
    .nullable(),
});
export type ReportInsights = z.infer<typeof ReportInsights>;
export const ReportInsightsResponse = z.object({ insights: ReportInsights.nullable() });

// ---------- Today ----------

export const TodayMeal = Meal.extend({
  supportsFocus: z.boolean().nullable(),
  focusReason: z.string().nullable(),
});
export type TodayMeal = z.infer<typeof TodayMeal>;

export const TodayResponse = z.object({
  date: LocalDate,
  targets: MacroTargets.nullable(),
  totals: Nutrition,
  meals: z.array(TodayMeal),
  focus: FocusInfo.nullable(),
  focusSummary: z.object({ supported: z.number(), total: z.number() }).nullable(),
  /** Meal types logged yesterday, i.e. what "same as yesterday" can repeat. */
  repeatableMealTypes: z.array(MealType),
});
export type TodayResponse = z.infer<typeof TodayResponse>;

// ---------- Progress ----------

export const ProgressResponse = z.object({
  weekStart: LocalDate,
  weekEnd: LocalDate,
  daysElapsed: z.number(),
  daysTracked: z.number(),
  trackedDates: z.array(LocalDate),
  /** Mon–Sun kcal: 0 for a past day with nothing logged, null for days still ahead */
  days: z.array(z.object({ date: LocalDate, calories: z.number().nullable() })),
  streak: z.number(),
  goal: z
    .object({ daysMet: z.number(), daysTracked: z.number(), bandPct: z.number(), targetCalories: z.number() })
    .nullable(),
  focus: z
    .object({ key: FocusKey, title: z.string(), supported: z.number(), total: z.number(), pct: z.number() })
    .nullable(),
  weekOverWeek: z.object({
    daysTracked: z.number().nullable(),
    goalDaysMet: z.number().nullable(),
    focusPct: z.number().nullable(),
  }),
  insights: z.array(z.string()),
  achievements: z.array(Achievement),
});
export type ProgressResponse = z.infer<typeof ProgressResponse>;

// ---------- Goal journey ----------

export const WeighInRequest = z.object({
  kg: z.number().min(30, "Weight must be at least 30 kg").max(300, "Weight must be at most 300 kg"),
  date: LocalDate.optional(),
});
export type WeighInRequest = z.infer<typeof WeighInRequest>;

export const JourneyResponse = z.object({
  goal: GoalType,
  startKg: z.number(),
  currentKg: z.number(),
  targetKg: z.number().nullable(),
  kgToGo: z.number().nullable(),
  /** 0–100 progress from start to goal weight */
  pct: z.number().nullable(),
  weeklyKg: z.number(),
  lastWeighIn: LocalDate.nullable(),
  /** consecutive days within the calorie band (today counts only once it's on target) */
  onTargetStreak: z.number(),
  history: z.array(z.object({ date: LocalDate, kg: z.number() })),
  /** one entry per day from the first logged day (or joining) to today */
  calendar: z.array(z.object({ date: LocalDate, status: z.enum(["empty", "logged", "on_target"]) })),
  bestOnTargetStreak: z.number(),
});
export type JourneyResponse = z.infer<typeof JourneyResponse>;

export const WeighInResponse = z.object({ journey: JourneyResponse, events: z.array(KimboEvent) });
export type WeighInResponse = z.infer<typeof WeighInResponse>;

export const CheckinResponse = z.object({ events: z.array(KimboEvent) });
export type CheckinResponse = z.infer<typeof CheckinResponse>;
export * from "./nutrition";
export * from "./goal";
