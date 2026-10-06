import { randomUUID } from "node:crypto";
import type { Goal, GoalRequest, Profile } from "@kimbo/shared";
import type { Db } from "../db/index.js";
import { buildGoal } from "../domain/goal.js";

export interface ProfileRow {
  id: string;
  created_at: Date;
  is_demo: boolean;
  timezone: string;
  age: number | null;
  sex: GoalRequest["sex"] | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity: GoalRequest["activity"] | null;
  goal: GoalRequest["goal"] | null;
  computed_target: number | null;
  target_override: number | null;
  weekly_kg: number | null;
  target_weight_kg: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProfile(db: Db, id: string): Promise<ProfileRow | null> {
  if (!UUID.test(id)) return null;
  const res = await db.query<ProfileRow>("SELECT * FROM profiles WHERE id = $1", [id]);
  return res.rows[0] ?? null;
}

export async function insertProfile(
  db: Db,
  input: { isDemo: boolean; timezone: string; createdAt: Date },
): Promise<ProfileRow> {
  const res = await db.query<ProfileRow>(
    "INSERT INTO profiles (id, created_at, is_demo, timezone) VALUES ($1, $2, $3, $4) RETURNING *",
    [randomUUID(), input.createdAt, input.isDemo, input.timezone],
  );
  return res.rows[0]!;
}

export async function saveGoal(db: Db, id: string, input: GoalRequest, computedTarget: number): Promise<ProfileRow> {
  const res = await db.query<ProfileRow>(
    `UPDATE profiles SET age = $2, sex = $3, height_cm = $4, weight_kg = $5, activity = $6, goal = $7,
       computed_target = $8, target_override = $9, weekly_kg = $10, target_weight_kg = $11
     WHERE id = $1 RETURNING *`,
    [
      id,
      input.age,
      input.sex,
      input.heightCm,
      input.weightKg,
      input.activity,
      input.goal,
      computedTarget,
      input.targetOverride ?? null,
      input.weeklyKg ?? null,
      input.targetWeightKg ?? null,
    ],
  );
  return res.rows[0]!;
}

export function goalOf(row: ProfileRow): Goal | null {
  if (row.age == null || !row.sex || row.height_cm == null || row.weight_kg == null || !row.activity || !row.goal) {
    return null;
  }
  return buildGoal(
    {
      age: row.age,
      sex: row.sex,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      activity: row.activity,
      // Profiles saved before "build muscle" replaced "gain" read as building muscle.
      goal: (row.goal as string) === "gain" ? "build_muscle" : row.goal,
      weeklyKg: row.weekly_kg ?? undefined,
      targetWeightKg: row.target_weight_kg,
    },
    row.target_override,
  );
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    isDemo: row.is_demo,
    timezone: row.timezone,
    createdAt: row.created_at.toISOString(),
    goal: goalOf(row),
  };
}
