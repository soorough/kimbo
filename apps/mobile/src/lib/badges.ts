import type { KimboEventType } from "@kimbo/shared";
import type { IconName } from "@/components/Icon";

/** Habit badges from Kimbo's achievements; every one is visible from day one so people know what's worth showing up for. */
export const HABIT_BADGES: { type: KimboEventType; icon: IconName; title: string; how: string }[] = [
  { type: "first_3_days", icon: "star", title: "First 3 days", how: "Log meals on 3 days" },
  { type: "first_full_week", icon: "calendar", title: "Full week", how: "Log 7 days in a row" },
  { type: "consistency_improved", icon: "trending-up", title: "Steadier week", how: "Log more days than last week" },
  { type: "focus_improved", icon: "target", title: "Focus up", how: "More meals help than last week" },
  { type: "welcome_back", icon: "heart", title: "Came back", how: "Return after a break" },
  { type: "first_weigh_in", icon: "activity", title: "First weigh-in", how: "Log your weight once" },
  { type: "on_target_3", icon: "sun", title: "3 on target", how: "3 days in a row on your kcal target" },
  { type: "on_target_7", icon: "award", title: "Week on target", how: "7 days in a row on target" },
  { type: "kg_progress", icon: "trending-down", title: "Kilogram closer", how: "Move 1 kg toward your goal" },
  { type: "halfway_to_goal", icon: "flag", title: "Halfway", how: "Get halfway to your goal weight" },
  { type: "goal_reached", icon: "check-circle", title: "Goal reached", how: "Reach your goal weight" },
];

/** Streak badges: days in a row with a meal logged. */
export const STREAK_BADGES = [
  { days: 3, title: "Warming up" },
  { days: 7, title: "Full week" },
  { days: 14, title: "Two weeks strong" },
  { days: 30, title: "Monthly regular" },
  { days: 100, title: "Centurion" },
  { days: 365, title: "Year of thalis" },
] as const;

/** Meal badges: meals logged, ever. */
export const MEAL_BADGES = [
  { meals: 5, title: "First bites" },
  { meals: 50, title: "Katori collector" },
  { meals: 500, title: "Thali master" },
] as const;
