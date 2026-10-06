import type { ConfirmItem } from "@kimbo/shared";
import { HttpError } from "../errors.js";
import type { StoredItem } from "../repo/meals.js";
import { getEntry, gramsPerUnit, nutritionFor } from "./catalogue.js";

const MAX_HOUSEHOLD_QUANTITY = 50;

/**
 * Turns confirmed items into stored items. Catalogue nutrition is always
 * recomputed here — the client's numbers are only trusted for estimates.
 */
export function resolveConfirmedItems(items: ConfirmItem[]): StoredItem[] {
  return items.map((item) => {
    if (item.kind === "estimate") {
      return {
        foodId: null,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        nutrition: item.nutrition,
        tags: [],
        isEstimate: true,
      };
    }
    const entry = getEntry(item.foodId);
    if (!entry) throw new HttpError(400, "UNKNOWN_FOOD", `Kimbo doesn't know the food "${item.foodId}"`);
    if (gramsPerUnit(entry, item.unit) === null) {
      throw new HttpError(400, "UNSUPPORTED_UNIT", `${entry.name} can't be logged in ${item.unit}`);
    }
    if (item.unit !== "g" && item.quantity > MAX_HOUSEHOLD_QUANTITY) {
      throw new HttpError(400, "VALIDATION_ERROR", `${item.quantity} ${item.unit} of ${entry.name} looks too many`);
    }
    return {
      foodId: entry.id,
      name: entry.name,
      quantity: item.quantity,
      unit: item.unit,
      nutrition: nutritionFor(entry, item.quantity, item.unit),
      tags: entry.tags,
      isEstimate: false,
    };
  });
}
