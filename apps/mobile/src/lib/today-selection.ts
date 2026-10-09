import { create } from "zustand";

/** Keeps the selected Today date available to flows that return to the log. */
export const useTodaySelection = create<{ date: string | null; select: (date: string | null) => void }>((set) => ({
  date: null,
  select: (date) => set({ date }),
}));
