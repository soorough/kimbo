import { randomUUID } from "node:crypto";
import type { ExerciseDraft, ExerciseEntry, ExerciseKind, Intensity } from "@kimbo/shared";
import type { Db } from "../db/index.js";

export async function addExercise(db: Db, profileId: string, d: ExerciseDraft, at: Date): Promise<ExerciseEntry> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO exercise_logs (id, profile_id, kind, label, intensity, minutes, calories, logged_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, profileId, d.kind, d.label, d.intensity, d.minutes, d.calories, at],
  );
  return { kind: d.kind, label: d.label, intensity: d.intensity, minutes: d.minutes, calories: d.calories, id, loggedAt: at.toISOString() };
}

/** Oldest first, within [from, to). */
export async function listExercise(db: Db, profileId: string, from: Date, to: Date): Promise<ExerciseEntry[]> {
  const res = await db.query<{
    id: string;
    kind: ExerciseKind;
    label: string;
    intensity: Intensity | null;
    minutes: number | null;
    calories: number;
    logged_at: Date;
  }>(
    `SELECT id, kind, label, intensity, minutes, calories, logged_at FROM exercise_logs
     WHERE profile_id = $1 AND logged_at >= $2 AND logged_at < $3 ORDER BY logged_at`,
    [profileId, from, to],
  );
  return res.rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    intensity: r.intensity,
    minutes: r.minutes,
    calories: r.calories,
    loggedAt: r.logged_at.toISOString(),
  }));
}

export async function deleteExercise(db: Db, profileId: string, id: string): Promise<boolean> {
  const res = await db.query("DELETE FROM exercise_logs WHERE id = $1 AND profile_id = $2", [id, profileId]);
  return (res.rowCount ?? 0) > 0;
}
