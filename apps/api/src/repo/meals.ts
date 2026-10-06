import { randomUUID } from "node:crypto";
import type { FoodTag, Meal, MealSource, MealType, Nutrition } from "@kimbo/shared";
import type { PoolClient } from "pg";
import { withTransaction, type Db } from "../db/index.js";
import { CATALOGUE_VERSION, sumNutrition } from "../domain/catalogue.js";
import { localDate } from "../domain/time.js";

export interface StoredItem {
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
  tags: FoodTag[];
  isEstimate: boolean;
}

/** A meal as the domain sees it: API shape plus the food tags snapshotted at save time. */
export interface StoredMeal extends Omit<Meal, "items"> {
  items: (StoredItem & { id: string })[];
}

export interface MealWrite {
  mealType: MealType;
  eatenAt: Date;
  source: MealSource;
  wasCorrected: boolean;
  items: StoredItem[];
}

interface Row {
  id: string;
  meal_type: MealType;
  eaten_at: Date;
  source: MealSource;
  was_corrected: boolean;
  item_id: string;
  catalogue_item_id: string | null;
  display_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sat_fat: number;
  tags: FoodTag[];
  is_estimate: boolean;
}

const SELECT = `
  SELECT m.id, m.meal_type, m.eaten_at, m.source, m.was_corrected,
         i.id AS item_id, i.catalogue_item_id, i.display_name, i.quantity, i.unit,
         i.calories, i.protein, i.carbs, i.fat, i.fibre, i.sat_fat, i.tags, i.is_estimate
  FROM meals m JOIN meal_items i ON i.meal_id = m.id`;

function group(rows: Row[], timezone: string): StoredMeal[] {
  const meals = new Map<string, StoredMeal>();
  for (const r of rows) {
    let meal = meals.get(r.id);
    if (!meal) {
      meal = {
        id: r.id,
        mealType: r.meal_type,
        eatenAt: r.eaten_at.toISOString(),
        localDate: localDate(r.eaten_at, timezone),
        source: r.source,
        wasCorrected: r.was_corrected,
        items: [],
        totals: sumNutrition([]),
      };
      meals.set(r.id, meal);
    }
    meal.items.push({
      id: r.item_id,
      foodId: r.catalogue_item_id,
      name: r.display_name,
      quantity: r.quantity,
      unit: r.unit,
      nutrition: {
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fibre: r.fibre,
        satFat: r.sat_fat,
      },
      tags: r.tags,
      isEstimate: r.is_estimate,
    });
  }
  for (const meal of meals.values()) meal.totals = sumNutrition(meal.items.map((i) => i.nutrition));
  return [...meals.values()];
}

export async function listMeals(
  db: Db,
  profileId: string,
  timezone: string,
  range: { from: Date; to: Date },
): Promise<StoredMeal[]> {
  const res = await db.query<Row>(
    `${SELECT} WHERE m.profile_id = $1 AND m.eaten_at >= $2 AND m.eaten_at < $3 ORDER BY m.eaten_at, m.created_at, m.id, i.position`,
    [profileId, range.from, range.to],
  );
  return group(res.rows, timezone);
}

export async function getMeal(db: Db, profileId: string, timezone: string, mealId: string): Promise<StoredMeal | null> {
  if (!/^[0-9a-f-]{36}$/i.test(mealId)) return null;
  const res = await db.query<Row>(`${SELECT} WHERE m.profile_id = $1 AND m.id = $2 ORDER BY i.position`, [
    profileId,
    mealId,
  ]);
  return group(res.rows, timezone)[0] ?? null;
}

/** The most recent meal strictly before an instant, if any. */
export async function lastMealBefore(db: Db, profileId: string, before: Date): Promise<Date | null> {
  const res = await db.query<{ eaten_at: Date }>(
    "SELECT eaten_at FROM meals WHERE profile_id = $1 AND eaten_at < $2 ORDER BY eaten_at DESC LIMIT 1",
    [profileId, before],
  );
  return res.rows[0]?.eaten_at ?? null;
}

async function insertItems(client: PoolClient, mealId: string, items: StoredItem[]) {
  for (const [position, item] of items.entries()) {
    await client.query(
      `INSERT INTO meal_items (id, meal_id, position, catalogue_item_id, display_name, quantity, unit,
         calories, protein, carbs, fat, fibre, sat_fat, tags, is_estimate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        randomUUID(),
        mealId,
        position,
        item.foodId,
        item.name,
        item.quantity,
        item.unit,
        item.nutrition.calories,
        item.nutrition.protein,
        item.nutrition.carbs,
        item.nutrition.fat,
        item.nutrition.fibre,
        item.nutrition.satFat,
        item.tags,
        item.isEstimate,
      ],
    );
  }
}

export async function insertMeal(db: Db, profileId: string, meal: MealWrite, now: Date): Promise<string> {
  const id = randomUUID();
  await withTransaction(db, async (client) => {
    await client.query(
      `INSERT INTO meals (id, profile_id, meal_type, eaten_at, source, was_corrected, catalogue_version, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, profileId, meal.mealType, meal.eatenAt, meal.source, meal.wasCorrected, CATALOGUE_VERSION, now],
    );
    await insertItems(client, id, meal.items);
  });
  return id;
}

export async function replaceMeal(db: Db, profileId: string, mealId: string, meal: MealWrite): Promise<void> {
  await withTransaction(db, async (client) => {
    await client.query(
      `UPDATE meals SET meal_type = $3, eaten_at = $4, source = $5, was_corrected = was_corrected OR $6, catalogue_version = $7
       WHERE id = $1 AND profile_id = $2`,
      [mealId, profileId, meal.mealType, meal.eatenAt, meal.source, meal.wasCorrected, CATALOGUE_VERSION],
    );
    await client.query("DELETE FROM meal_items WHERE meal_id = $1", [mealId]);
    await insertItems(client, mealId, meal.items);
  });
}

export async function deleteMeal(db: Db, profileId: string, mealId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(mealId)) return false;
  const res = await db.query("DELETE FROM meals WHERE id = $1 AND profile_id = $2", [mealId, profileId]);
  return (res.rowCount ?? 0) > 0;
}

export function toApiMeal(meal: StoredMeal): Meal {
  return { ...meal, items: meal.items.map(({ tags: _tags, ...item }) => item) };
}
