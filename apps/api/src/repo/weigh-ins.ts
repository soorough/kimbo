import type { Db } from "../db/index.js";

export interface WeighIn {
  date: string;
  kg: number;
}

/** One weigh-in per day; a second one the same day replaces the first. */
export async function upsertWeighIn(db: Db, profileId: string, w: WeighIn, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO weigh_ins (profile_id, measured_on, kg, created_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (profile_id, measured_on) DO UPDATE SET kg = EXCLUDED.kg, created_at = EXCLUDED.created_at`,
    [profileId, w.date, w.kg, now],
  );
}

/** Oldest first. */
export async function listWeighIns(db: Db, profileId: string): Promise<WeighIn[]> {
  const res = await db.query<{ measured_on: string; kg: number }>(
    "SELECT measured_on, kg FROM weigh_ins WHERE profile_id = $1 ORDER BY measured_on",
    [profileId],
  );
  return res.rows.map((r) => ({ date: r.measured_on, kg: r.kg }));
}
