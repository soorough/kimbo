import type { Nutrition } from "@kimbo/shared";
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from "expo-file-system/legacy";
import { create } from "zustand";

/** A food the user typed in from a label (Cal AI's "My foods"). Kept on this phone only. */
export interface MyFood {
  id: string;
  brand: string | null;
  name: string;
  /** e.g. "1 cup", "1 plate" — what one serving is */
  servingSize: string;
  servingsPerContainer: number;
  perServing: Nutrition;
}

const FILE = `${documentDirectory}my-foods.json`;

interface MyFoodsState {
  foods: MyFood[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (food: Omit<MyFood, "id">) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function persist(foods: MyFood[]) {
  await writeAsStringAsync(FILE, JSON.stringify(foods)).catch(() => {});
}

export const useMyFoods = create<MyFoodsState>((set, get) => ({
  foods: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const foods = JSON.parse(await readAsStringAsync(FILE)) as MyFood[];
      set({ foods: Array.isArray(foods) ? foods : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  add: async (food) => {
    const foods = [{ ...food, id: `my-${Date.now()}` }, ...get().foods];
    set({ foods });
    await persist(foods);
  },
  remove: async (id) => {
    const foods = get().foods.filter((f) => f.id !== id);
    set({ foods });
    await persist(foods);
  },
}));

export function myFoodLabel(food: MyFood) {
  return food.brand ? `${food.name} · ${food.brand}` : food.name;
}
