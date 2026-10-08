import type { ExerciseDraft } from "@kimbo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { api } from "./api";

/** Saves a workout, refreshes everything that shows calories, and returns to Today. */
export function useLogExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ExerciseDraft) => api.addExercise(draft),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.dismissTo("/(tabs)");
      await queryClient.invalidateQueries();
    },
  });
}
