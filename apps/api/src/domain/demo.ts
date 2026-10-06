import type { Deps } from "../app.js";
import type { ProfileRow } from "../repo/profiles.js";

export async function seedDemoProfile(_deps: Deps, row: ProfileRow): Promise<ProfileRow> {
  return row;
}
