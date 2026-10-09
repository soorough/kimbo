import type { Diet, FocusKey } from "@kimbo/shared";
import { getEntry } from "./catalogue.js";
import { eats } from "./diet.js";

/**
 * What to add to the meal being built, the way an Indian kitchen pairs dishes: a dal or
 * curry wants rice or roti, a full plate wants a side, idli wants sambar. Kimbo's rules
 * only, so the suggestion always makes sense and always matches what "Add it" adds.
 */

/** Gravies, dals and sabzis: eaten with a staple. */
const MAIN = new Set([
  "dal_tadka", "moong_dal", "masoor_dal", "chana_dal", "dal_makhani", "rajma", "chole", "sambar", "kadhi",
  "palak_paneer", "paneer_butter_masala", "matar_paneer", "kadai_paneer", "paneer_bhurji", "aloo_gobi", "bhindi",
  "baingan_bharta", "mixed_veg", "aloo_sabzi", "saag", "cabbage_sabzi", "lauki", "beans_poriyal",
  "egg_curry", "chicken_curry", "butter_chicken", "fish_curry", "mutton_curry",
]);
const STAPLE = new Set(["roti", "paratha", "naan", "bhatura", "puri", "white_rice", "brown_rice", "jeera_rice"]);
/** Complete on their own (rice and dal together, or a one-pot dish). */
const ONE_POT = new Set(["khichdi", "veg_pulao", "veg_biryani", "chicken_biryani", "curd_rice", "pav_bhaji"]);
const SIDE = new Set(["salad", "raita", "curd", "buttermilk", "sprouts", "papad", "pickle"]);
const SOUTH = new Set(["idli", "plain_dosa", "masala_dosa", "uttapam", "medu_vada"]);
const LIGHT_BREAKFAST = new Set(["poha", "upma", "oats", "dhokla", "brown_bread", "white_bread", "aloo_paratha"]);

/** The staple each main is classically eaten with, first choice first. */
const GOES_WITH: Record<string, string[]> = {
  rajma: ["white_rice", "brown_rice"],
  chole: ["roti", "bhatura"],
  sambar: ["white_rice", "idli"],
  kadhi: ["white_rice"],
  dal_tadka: ["white_rice", "roti"],
  dal_makhani: ["roti", "jeera_rice"],
  fish_curry: ["white_rice"],
  egg_curry: ["roti", "white_rice"],
};

export interface Pairing {
  foodId: string;
  text: string;
}

const lower = (id: string) => getEntry(id)!.name.toLowerCase();

export function pairFor(foodIds: string[], focus: FocusKey | null, diet: Diet | null): Pairing | null {
  const has = new Set(foodIds);
  const ok = (id: string) => !has.has(id) && !!getEntry(id) && eats(diet, id);
  const first = (ids: string[]) => ids.find(ok);
  const fibre = focus === "fibre_focus" || focus === "steady_carbs" || focus === "less_sugar_refined";
  const why = focus === "balanced_plate" ? "to balance the plate" : fibre ? "for more fibre" : "to round it out";
  const main = foodIds.find((id) => MAIN.has(id));
  const hasStaple = foodIds.some((id) => STAPLE.has(id) || ONE_POT.has(id));
  const hasSide = foodIds.some((id) => SIDE.has(id));

  if (foodIds.some((id) => SOUTH.has(id)) && !has.has("sambar") && ok("sambar"))
    return { foodId: "sambar", text: `Add a katori of sambar alongside, ${why}.` };
  if (main && !hasStaple) {
    // Steady carbs and fibre focus: brown rice over white when the dish goes with rice.
    const classic = GOES_WITH[main] ?? ["roti", "white_rice"];
    const choices = fibre ? classic.flatMap((id) => (id === "white_rice" ? ["brown_rice", id] : [id])) : classic;
    const staple = first(choices);
    if (staple) return { foodId: staple, text: `${capitalise(lower(main))} goes best with ${lower(staple)}. Add some to make it a meal.` };
  }
  if ((main || hasStaple) && !hasSide) {
    const side = first(fibre ? ["salad", "sprouts", "raita"] : ["curd", "salad", "raita"]);
    if (side) return { foodId: side, text: `Add ${lower(side)} on the side, ${why}.` };
  }
  if (foodIds.some((id) => LIGHT_BREAKFAST.has(id))) {
    const add = first(fibre ? ["sprouts", "fruit_bowl", "curd"] : ["curd", "boiled_egg", "fruit_bowl"]);
    if (add) return { foodId: add, text: `Add ${lower(add)} with it, ${why}.` };
  }
  return null;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
