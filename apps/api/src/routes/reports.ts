import { ConfirmReportRequest, ExtractReportRequest, type ReportDraft } from "@kimbo/shared";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../app.js";
import { confirmedReading, DISCLAIMER, SAMPLE_REPORT, selectFocus, SUPPORTED_MARKERS, toDraftMarkers } from "../domain/health.js";
import { badRequest } from "../errors.js";
import { parse, requireProfile } from "../http.js";
import { insertReportWithFocus, listReports } from "../repo/reports.js";

export function reportRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/reports/extract", async (req): Promise<ReportDraft> => {
    await requireProfile(deps, req);
    const body = parse(ExtractReportRequest, req.body);
    const extracted =
      "sample" in body ? SAMPLE_REPORT : await deps.extractor.extract({ base64: body.fileBase64, mimeType: body.mimeType });
    const { markers, ignored } = toDraftMarkers(extracted);
    const reportDate = extracted.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.reportDate) ? extracted.reportDate : null;
    return { markers, reportDate, ignored, supportedMarkers: SUPPORTED_MARKERS, disclaimer: DISCLAIMER };
  });

  app.post("/reports", async (req, reply) => {
    const profile = await requireProfile(deps, req);
    const body = parse(ConfirmReportRequest, req.body);
    if (new Set(body.markers.map((m) => m.marker)).size !== body.markers.length) {
      throw badRequest("VALIDATION_ERROR", "Each marker can only be confirmed once per report");
    }
    const markers = body.markers.map((m) => confirmedReading(m.marker, m.value, m.unit));
    const focus = selectFocus(markers);
    const id = await insertReportWithFocus(deps.db, profile.id, {
      reportDate: body.reportDate,
      source: body.source,
      markers,
      focus: focus.key,
      now: deps.clock(),
    });
    reply.code(201);
    return {
      report: { id, reportDate: body.reportDate, source: body.source, markers },
      focus,
      events: [{ type: "report_became_focus", message: `Your report is now today's focus: ${focus.title}.` }],
      disclaimer: DISCLAIMER,
    };
  });

  app.get("/reports", async (req) => {
    const profile = await requireProfile(deps, req);
    return { reports: await listReports(deps.db, profile.id) };
  });
}
