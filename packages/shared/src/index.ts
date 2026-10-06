import { z } from "zod";

// ---------- Common ----------

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

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

export const FoodTag = z.enum([
  "fibre_rich",
  "high_sat_fat",
  "refined_carb",
  "fried",
  "high_sugar",
  "lean_protein",
]);
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
export const GoalType = z.enum(["maintain", "lose", "gain"]);

export const CreateProfileRequest = z.object({
  mode: z.enum(["fresh", "demo"]),
  timezone: z.string().optional(),
});
export type CreateProfileRequest = z.infer<typeof CreateProfileRequest>;

export const GoalRequest = z.object({
  age: z.number().int().min(15, "Age must be 15 or over").max(100, "Age must be 100 or under"),
  sex: Sex,
  heightCm: z.number().min(100, "Height must be at least 100 cm").max(250, "Height must be at most 250 cm"),
  weightKg: z.number().min(30, "Weight must be at least 30 kg").max(300, "Weight must be at most 300 kg"),
  activity: ActivityLevel,
  goal: GoalType,
  targetOverride: z.number().int().optional(),
});
export type GoalRequest = z.infer<typeof GoalRequest>;

export const MacroTargets = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fibre: z.number(),
});
export type MacroTargets = z.infer<typeof MacroTargets>;

export const Goal = GoalRequest.omit({ targetOverride: true }).extend({
  computedTarget: z.number(),
  targetOverride: z.number().nullable(),
  effectiveTarget: z.number(),
  explanation: z.array(z.string()),
  targets: MacroTargets,
});
export type Goal = z.infer<typeof Goal>;

export const Profile = z.object({
  id: z.string(),
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
    quantity: z.number().positive().max(50),
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
});
export type TodayResponse = z.infer<typeof TodayResponse>;

// ---------- Progress ----------

export const ProgressResponse = z.object({
  weekStart: LocalDate,
  weekEnd: LocalDate,
  daysElapsed: z.number(),
  daysTracked: z.number(),
  trackedDates: z.array(LocalDate),
  streak: z.number(),
  goal: z.object({ daysMet: z.number(), daysTracked: z.number(), bandPct: z.number() }).nullable(),
  focus: z
    .object({ key: FocusKey, title: z.string(), supported: z.number(), total: z.number(), pct: z.number() })
    .nullable(),
  weekOverWeek: z.object({
    daysTracked: z.number(),
    goalDaysMet: z.number().nullable(),
    focusPct: z.number().nullable(),
  }),
  insights: z.array(z.string()),
  achievements: z.array(Achievement),
});
export type ProgressResponse = z.infer<typeof ProgressResponse>;

export const CheckinResponse = z.object({ events: z.array(KimboEvent) });
export type CheckinResponse = z.infer<typeof CheckinResponse>;
export * from "./nutrition";
