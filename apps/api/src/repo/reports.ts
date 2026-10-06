import { randomUUID } from "node:crypto";
import type { FocusKey, MarkerKey, MarkerReading, Report } from "@kimbo/shared";
import { withTransaction, type Db } from "../db/index.js";
import { reading } from "../domain/health.js";

export interface FocusAssignment {
  focus: FocusKey;
  activeFrom: Date;
}

export async function insertReportWithFocus(
  db: Db,
  profileId: string,
  input: { reportDate: string; source: Report["source"]; markers: MarkerReading[]; focus: FocusKey; now: Date },
): Promise<string> {
  const id = randomUUID();
  await withTransaction(db, async (client) => {
    await client.query("INSERT INTO reports (id, profile_id, report_date, source, created_at) VALUES ($1,$2,$3,$4,$5)", [
      id,
      profileId,
      input.reportDate,
      input.source,
      input.now,
    ]);
    for (const m of input.markers) {
      await client.query(
        `INSERT INTO report_markers (report_id, marker, value, unit, original_value, original_unit, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, m.marker, m.value, m.unit, m.originalValue, m.originalUnit, m.status],
      );
    }
    await client.query(
      "INSERT INTO focus_assignments (id, profile_id, focus, report_id, active_from) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), profileId, input.focus, id, input.now],
    );
  });
  return id;
}

export async function listReports(db: Db, profileId: string): Promise<Report[]> {
  const res = await db.query<{
    id: string;
    report_date: string;
    source: Report["source"];
    marker: MarkerKey;
    value: number;
    original_value: number;
    original_unit: string;
  }>(
    `SELECT r.id, r.report_date, r.source, m.marker, m.value, m.original_value, m.original_unit
     FROM reports r JOIN report_markers m ON m.report_id = r.id
     WHERE r.profile_id = $1 ORDER BY r.report_date DESC, r.created_at DESC, m.marker`,
    [profileId],
  );
  const reports = new Map<string, Report>();
  for (const row of res.rows) {
    let report = reports.get(row.id);
    if (!report) {
      report = { id: row.id, reportDate: row.report_date, source: row.source, markers: [] };
      reports.set(row.id, report);
    }
    // Stored values are canonical; re-derive labels/status from today's rules for display.
    const r = reading(row.marker, row.value, canonicalUnitOf(row.marker))!;
    report.markers.push({ ...r, originalValue: row.original_value, originalUnit: row.original_unit });
  }
  return [...reports.values()];
}

function canonicalUnitOf(marker: MarkerKey): string {
  return marker === "hba1c" ? "%" : "mg/dL";
}

/** Focus history, oldest first. */
export async function listFocusAssignments(db: Db, profileId: string): Promise<FocusAssignment[]> {
  const res = await db.query<{ focus: FocusKey; active_from: Date }>(
    "SELECT focus, active_from FROM focus_assignments WHERE profile_id = $1 ORDER BY active_from",
    [profileId],
  );
  return res.rows.map((r) => ({ focus: r.focus, activeFrom: r.active_from }));
}
