import type { Achievement, KimboEventType } from "@kimbo/shared";
import type { Db } from "../db/index.js";
import { ACHIEVEMENT_TITLES } from "../domain/achievements.js";

/** Records an achievement; returns true only the first time this key is unlocked. */
export async function unlock(db: Db, profileId: string, key: string, type: KimboEventType, at: Date): Promise<boolean> {
  const res = await db.query(
    `INSERT INTO achievements (profile_id, achievement_key, achievement_type, unlocked_at)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [profileId, key, type, at],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listAchievements(db: Db, profileId: string): Promise<Achievement[]> {
  const res = await db.query<{ achievement_key: string; achievement_type: KimboEventType; unlocked_at: Date }>(
    "SELECT achievement_key, achievement_type, unlocked_at FROM achievements WHERE profile_id = $1 ORDER BY unlocked_at, achievement_key",
    [profileId],
  );
  return res.rows.map((r) => ({
    key: r.achievement_key,
    type: r.achievement_type,
    title: ACHIEVEMENT_TITLES[r.achievement_type],
    unlockedAt: r.unlocked_at.toISOString(),
  }));
}
