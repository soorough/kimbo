import {
  ApiError,
  CheckinResponse,
  JourneyResponse,
  WeighInResponse,
  ConfirmMealResponse,
  ConfirmReportResponse,
  FoodSearchResponse,
  MealDraft,
  MealsResponse,
  Profile,
  ProgressResponse,
  RecentMealsResponse,
  SavedMealResponse,
  SavedMealsResponse,
  ReportDraft,
  ReportInsightsResponse,
  ReportsResponse,
  TodayResponse,
  WaterEntry,
  ExerciseDraft,
  ExerciseEntry,
  type ExerciseEstimateRequest,
  type ConfirmMealRequest,
  type ConfirmReportRequest,
  type CreateProfileRequest,
  type ExtractReportRequest,
  type GoalRequest,
  type NameRequest,
  AskResponse,
  PairingResponse,
  AssistantHomeResponse,
  type AskRequest,
  type PreferencesRequest,
  type ParseMealRequest,
  type SaveMealRequest,
} from "@kimbo/shared";
import { Platform } from "react-native";
import { z } from "zod";
import { useSession } from "./session";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function request<T extends z.ZodType>(
  schema: T,
  method: string,
  path: string,
  body?: unknown,
): Promise<z.output<T>> {
  const profileId = useSession.getState().profileId;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(profileId ? { "x-profile-id": profileId } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "Can't reach Kimbo right now. Check your connection and try again.", true);
  }
  if (res.status === 204) return undefined as z.output<T>;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiError.safeParse(json);
    if (parsed.success) {
      throw new ApiRequestError(res.status, parsed.data.code, parsed.data.message, parsed.data.retryable);
    }
    throw new ApiRequestError(res.status, "UNKNOWN", "Something went wrong. Please try again.", true);
  }
  return schema.parse(json);
}

const ProfileEnvelope = z.object({ profile: Profile });

/** Where Kimbo's spoken reply streams from; the audio player sends the profile header itself. */
export function speechSource(text: string): { uri: string; headers: Record<string, string> } {
  const profileId = useSession.getState().profileId;
  return {
    uri: `${BASE_URL}/assistant/speak?text=${encodeURIComponent(text)}`,
    headers: profileId ? { "x-profile-id": profileId } : {},
  };
}
const Empty = z.unknown();

export const api = {
  createProfile: (body: CreateProfileRequest) => request(ProfileEnvelope, "POST", "/profiles", body),
  getProfile: (id: string) => request(ProfileEnvelope, "GET", `/profiles/${id}`),
  saveGoal: (id: string, body: GoalRequest) => request(ProfileEnvelope, "PUT", `/profiles/${id}/goal`, body),
  saveName: (id: string, body: NameRequest) => request(ProfileEnvelope, "PUT", `/profiles/${id}/name`, body),
  assistantHome: () => request(AssistantHomeResponse, "GET", "/assistant"),
  ask: (body: AskRequest) => request(AskResponse, "POST", "/assistant/ask", body),
  pairing: (foodIds: string[]) => request(PairingResponse, "POST", "/assistant/pairing", { foodIds }),
  listen: (body: { audioBase64: string; mimeType: string }) =>
    request(z.object({ text: z.string() }), "POST", "/assistant/listen", body),
  savePreferences: (id: string, body: PreferencesRequest) =>
    request(ProfileEnvelope, "PUT", `/profiles/${id}/preferences`, body),

  parseMeal: (body: ParseMealRequest) => request(MealDraft, "POST", "/meals/parse", body),
  confirmMeal: (body: ConfirmMealRequest) => request(ConfirmMealResponse, "POST", "/meals", body),
  updateMeal: (id: string, body: ConfirmMealRequest) => request(ConfirmMealResponse, "PATCH", `/meals/${id}`, body),
  deleteMeal: (id: string) => request(Empty, "DELETE", `/meals/${id}`),
  meals: (date: string) => request(MealsResponse, "GET", `/meals?date=${date}`),
  recentMeals: () => request(RecentMealsResponse, "GET", "/meals/recent"),
  hideRecentMeal: (key: string) => request(Empty, "DELETE", `/meals/recent/${encodeURIComponent(key)}`),
  savedMeals: () => request(SavedMealsResponse, "GET", "/saved-meals"),
  saveMeal: (body: SaveMealRequest) => request(SavedMealResponse, "POST", "/saved-meals", body),
  renameSavedMeal: (id: string, name: string) => request(SavedMealResponse, "PATCH", `/saved-meals/${id}`, { name }),
  deleteSavedMeal: (id: string) => request(Empty, "DELETE", `/saved-meals/${id}`),
  repeatYesterday: (mealType: string) => request(ConfirmMealResponse, "POST", "/meals/repeat-yesterday", { mealType }),
  searchFoods: (q: string) => request(FoodSearchResponse, "GET", `/foods/search?q=${encodeURIComponent(q)}`),

  extractReport: (body: ExtractReportRequest) => request(ReportDraft, "POST", "/reports/extract", body),
  confirmReport: (body: ConfirmReportRequest) => request(ConfirmReportResponse, "POST", "/reports", body),
  reports: () => request(ReportsResponse, "GET", "/reports"),
  reportInsights: () => request(ReportInsightsResponse, "GET", "/reports/insights"),

  today: () => request(TodayResponse, "GET", "/today"),
  todayFor: (date: string) => request(TodayResponse, "GET", `/today?date=${date}`),
  addWater: (ml: number) => request(z.object({ entry: WaterEntry }), "POST", "/water", { ml }),
  deleteWater: (id: string) => request(Empty, "DELETE", `/water/${id}`),
  estimateExercise: (body: ExerciseEstimateRequest) =>
    request(z.object({ draft: ExerciseDraft }), "POST", "/exercise/estimate", body),
  addExercise: (draft: ExerciseDraft) => request(z.object({ entry: ExerciseEntry }), "POST", "/exercise", draft),
  deleteExercise: (id: string) => request(Empty, "DELETE", `/exercise/${id}`),
  progress: () => request(ProgressResponse, "GET", "/progress"),
  progressFor: (weekOf: string) => request(ProgressResponse, "GET", `/progress?weekOf=${weekOf}`),
  checkin: () => request(CheckinResponse, "POST", "/checkins", {}),

  journey: () => request(JourneyResponse, "GET", "/journey"),
  logWeight: (kg: number) => request(WeighInResponse, "POST", "/weights", { kg }),
};

export function errorMessage(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.";
}
