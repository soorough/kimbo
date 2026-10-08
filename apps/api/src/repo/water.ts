import { randomUUID } from "node:crypto";
import type { WaterEntry } from "@kimbo/shared";
import type { Db } from "../db/index.js";

export async function addWater(db: Db, profileId: string, ml: number, at: Date): Promise<WaterEntry> {
  const id = randomUUID();
  await db.query("INSERT INTO water_logs (id, profile_id, ml, logged_at) VALUES ($1, $2, $3, $4)", [id, profileId, ml, at]);
  return { id, ml, loggedAt: at.toISOString() };
}

/** Oldest first, within [from, to). */
export async function listWater(db: Db, profileId: string, from: Date, to: Date): Promise<WaterEntry[]> {
  const res = await db.query<{ id: string; ml: number; logged_at: Date }>(
    "SELECT id, ml, logged_at FROM water_logs WHERE profile_id = $1 AND logged_at >= $2 AND logged_at < $3 ORDER BY logged_at",
    [profileId, from, to],
  );
  return res.rows.map((r) => ({ id: r.id, ml: r.ml, loggedAt: r.logged_at.toISOString() }));
}

/** True when the entry existed and belonged to this profile. */
export async function deleteWater(db: Db, profileId: string, id: string): Promise<boolean> {
  const res = await db.query("DELETE FROM water_logs WHERE id = $1 AND profile_id = $2", [id, profileId]);
  return (res.rowCount ?? 0) > 0;
}
