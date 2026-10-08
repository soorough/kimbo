import type { Db } from "../db/index.js";

/** Sets the day's glasses of water (replacing any earlier count). */
export async function setWater(db: Db, profileId: string, day: string, glasses: number, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO water_days (profile_id, day, glasses, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (profile_id, day) DO UPDATE SET glasses = EXCLUDED.glasses, updated_at = EXCLUDED.updated_at`,
    [profileId, day, glasses, now],
  );
}

export async function getWater(db: Db, profileId: string, day: string): Promise<number> {
  const res = await db.query<{ glasses: number }>("SELECT glasses FROM water_days WHERE profile_id = $1 AND day = $2", [
    profileId,
    day,
  ]);
  return res.rows[0]?.glasses ?? 0;
}
