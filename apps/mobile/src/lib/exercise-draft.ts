import type { ExerciseDraft } from "@kimbo/shared";
import { create } from "zustand";

/** The workout being logged, passed from the picker screens to the "burned" summary. */
export const useExerciseDraft = create<{ draft: ExerciseDraft | null; set: (d: ExerciseDraft | null) => void }>((set) => ({
  draft: null,
  set: (draft) => set({ draft }),
}));
