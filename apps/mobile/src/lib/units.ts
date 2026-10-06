import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

/**
 * Display units only — the API always stores cm and kg.
 * Defaults follow common Indian usage: height in feet and inches, weight in kg.
 */
export type HeightUnit = "ftin" | "cm";
export type WeightUnit = "kg" | "lb";

const KEY = "kimbo.units";
const CM_PER_IN = 2.54;
const LB_PER_KG = 2.20462;

interface UnitsState {
  height: HeightUnit;
  weight: WeightUnit;
  load: () => Promise<void>;
  set: (patch: Partial<Pick<UnitsState, "height" | "weight">>) => void;
}

export const useUnits = create<UnitsState>((set, get) => ({
  height: "ftin",
  weight: "kg",
  load: async () => {
    try {
      const saved = JSON.parse((await SecureStore.getItemAsync(KEY)) ?? "{}");
      set({
        height: saved.height === "cm" ? "cm" : "ftin",
        weight: saved.weight === "lb" ? "lb" : "kg",
      });
    } catch {
      // Keep defaults if storage is unreadable.
    }
  },
  set: (patch) => {
    set(patch);
    const { height, weight } = get();
    SecureStore.setItemAsync(KEY, JSON.stringify({ height, weight })).catch(() => {});
  },
}));

export const cmToIn = (cm: number) => Math.round(cm / CM_PER_IN);
export const inToCm = (inches: number) => Math.round(inches * CM_PER_IN * 10) / 10;
export const kgToLb = (kg: number) => Math.round(kg * LB_PER_KG);
export const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 10) / 10;

/** 66 → 5′ 6″ */
export function formatFeetInches(inches: number): string {
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return unit === "lb" ? `${kgToLb(kg)} lb` : `${kg} kg`;
}
