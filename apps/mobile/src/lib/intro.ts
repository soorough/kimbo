import { create } from "zustand";

/** Whether the cold-start intro has finished, so screens can hold moments until they're visible. */
export const useIntro = create<{ done: boolean; finish: () => void }>((set) => ({
  done: false,
  finish: () => set({ done: true }),
}));
