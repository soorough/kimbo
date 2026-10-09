import type { ExerciseDraft } from "@kimbo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { api } from "./api";
import { useTodaySelection } from "./today-selection";

/** Saves a workout, refreshes everything that shows calories, and returns to Today. */
export function useLogExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ExerciseDraft) => api.addExercise(draft),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // A just-logged workout belongs to today, even if the user had browsed another date.
      useTodaySelection.getState().select(null);
      router.dismissTo("/(tabs)");
      await queryClient.invalidateQueries({ queryKey: ["today"] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
