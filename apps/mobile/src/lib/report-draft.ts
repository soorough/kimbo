import type { ReportDraft } from "@kimbo/shared";
import { create } from "zustand";

/** The extraction result being reviewed, plus where it came from. */
export const useReportDraft = create<{
  draft: ReportDraft | null;
  source: "upload" | "sample" | "manual";
  set: (draft: ReportDraft, source: "upload" | "sample" | "manual") => void;
}>((set) => ({
  draft: null,
  source: "manual",
  set: (draft, source) => set({ draft, source }),
}));
