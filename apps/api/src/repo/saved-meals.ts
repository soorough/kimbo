import { randomUUID } from "node:crypto";
import type { Db } from "../db/index.js";
import type { StoredItem } from "./meals.js";

export interface SavedMealRow {
  id: string;
  name: string;
  items: StoredItem[];
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function insertSavedMeal(db: Db, profileId: string, name: string, items: StoredItem[], now: Date) {
  const id = randomUUID();
  await db.query("INSERT INTO saved_meals (id, profile_id, name, items, created_at) VALUES ($1, $2, $3, $4, $5)", [
    id,
    profileId,
    name,
    JSON.stringify(items),
    now,
  ]);
  return { id, name, items };
}

export async function listSavedMeals(db: Db, profileId: string): Promise<SavedMealRow[]> {
  const res = await db.query<SavedMealRow>(
    "SELECT id, name, items FROM saved_meals WHERE profile_id = $1 ORDER BY created_at DESC, id",
    [profileId],
  );
  return res.rows;
}

export async function renameSavedMeal(db: Db, profileId: string, id: string, name: string): Promise<SavedMealRow | null> {
  if (!isUuid(id)) return null;
  const res = await db.query<SavedMealRow>(
    "UPDATE saved_meals SET name = $3 WHERE id = $1 AND profile_id = $2 RETURNING id, name, items",
    [id, profileId, name],
  );
  return res.rows[0] ?? null;
}

export async function deleteSavedMeal(db: Db, profileId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const res = await db.query("DELETE FROM saved_meals WHERE id = $1 AND profile_id = $2", [id, profileId]);
  return (res.rowCount ?? 0) > 0;
}
