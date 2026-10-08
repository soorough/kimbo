import type { Diet } from "@kimbo/shared";

/**
 * What each diet leaves out, by catalogue id. Used so Kimbo never suggests a dish someone
 * doesn't eat. Jain here means no root vegetables (potato dishes); onion and garlic are a
 * cooking choice, so those dishes stay and can be made Jain-style.
 */
const MEAT_FISH = new Set([
  "chicken_biryani",
  "chicken_curry",
  "butter_chicken",
  "tandoori_chicken",
  "chicken_tikka",
  "fish_curry",
  "mutton_curry",
]);
const EGG = new Set(["boiled_egg", "omelette", "egg_curry"]);
const DAIRY = new Set([
  "palak_paneer",
  "paneer_butter_masala",
  "matar_paneer",
  "kadai_paneer",
  "paneer_bhurji",
  "paneer",
  "curd",
  "raita",
  "curd_rice",
  "kadhi",
  "dal_makhani",
  "milk",
  "sweet_lassi",
  "buttermilk",
  "kheer",
  "ghee",
  "masala_chai",
  "coffee",
  "gulab_jamun",
  "halwa",
  "butter_chicken",
]);
const ROOT_VEG = new Set(["aloo_paratha", "aloo_gobi", "aloo_sabzi", "samosa", "vada_pav", "pav_bhaji"]);

export function eats(diet: Diet | null, foodId: string): boolean {
  switch (diet) {
    case "vegetarian":
      return !MEAT_FISH.has(foodId) && !EGG.has(foodId);
    case "eggetarian":
      return !MEAT_FISH.has(foodId);
    case "vegan":
      return !MEAT_FISH.has(foodId) && !EGG.has(foodId) && !DAIRY.has(foodId);
    case "jain":
      return !MEAT_FISH.has(foodId) && !EGG.has(foodId) && !ROOT_VEG.has(foodId);
    default:
      return true;
  }
}
