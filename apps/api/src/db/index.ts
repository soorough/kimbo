import pg from "pg";
import { SCHEMA } from "./schema.js";

export type Db = pg.Pool;

export function createDb(connectionString: string): Db {
  // Small pool: on serverless each instance holds its own; Neon's pooler fans in.
  const pool = new pg.Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 5) });
  // numeric columns come back as strings by default; Kimbo's values are small decimals.
  pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
  // date columns stay as YYYY-MM-DD strings rather than JS Dates in server-local time.
  pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
  return pool;
}

export async function migrate(db: Db): Promise<void> {
  await db.query(SCHEMA);
}

export async function withTransaction<T>(db: Db, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
