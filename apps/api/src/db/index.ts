import { readFile } from "node:fs/promises";
import pg from "pg";

export type Db = pg.Pool;

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString });
  // numeric columns come back as strings by default; Kimbo's values are small decimals.
  pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
  // date columns stay as YYYY-MM-DD strings rather than JS Dates in server-local time.
  pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
  return pool;
}

export async function migrate(db: Db): Promise<void> {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await db.query(sql);
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
