import { create } from "zustand";

/**
 * Whether the user is scrolling a screen right now. The Ask Kimbo pill tucks into just
 * Kimbo's face while things move, and opens again once they settle.
 */
export const useScrolling = create<{ scrolling: boolean; set: (s: boolean) => void }>((set) => ({
  scrolling: false,
  set: (scrolling) => set({ scrolling }),
}));

let settle: ReturnType<typeof setTimeout> | null = null;

/** Scroll handlers for any ScrollView; "stopped" waits a beat so a flick doesn't flicker the pill. */
export const scrollHandlers = {
  onScrollBeginDrag: () => {
    if (settle) clearTimeout(settle);
    useScrolling.getState().set(true);
  },
  onMomentumScrollBegin: () => {
    if (settle) clearTimeout(settle);
  },
  onScrollEndDrag: () => {
    if (settle) clearTimeout(settle);
    settle = setTimeout(() => useScrolling.getState().set(false), 350);
  },
  onMomentumScrollEnd: () => {
    if (settle) clearTimeout(settle);
    settle = setTimeout(() => useScrolling.getState().set(false), 200);
  },
};
