import Fastify from "fastify";
import { ZodError } from "zod";
import { AiUnavailableError, type MealRecognizer, type ReportExtractor } from "./ai/types.js";
import type { Clock } from "./clock.js";
import type { Db } from "./db/index.js";
import { HttpError } from "./errors.js";
import { profileRoutes } from "./routes/profiles.js";

export interface Deps {
  db: Db;
  clock: Clock;
  recognizer: MealRecognizer;
  extractor: ReportExtractor;
}

export async function createApp(deps: Deps, opts: { logger?: boolean } = {}) {
  // Photos and report PDFs arrive base64-encoded in JSON bodies.
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 15 * 1024 * 1024 });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; "),
        retryable: false,
        issues,
      });
    }
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ code: err.code, message: err.message, retryable: err.retryable });
    }
    if (err instanceof AiUnavailableError) {
      req.log.warn({ err }, "AI provider failed");
      return reply.code(502).send({ code: "AI_UNAVAILABLE", message: err.message, retryable: true });
    }
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({ code: "BAD_REQUEST", message: (err as Error).message, retryable: false });
    }
    req.log.error({ err }, "Unhandled error");
    return reply.code(500).send({ code: "INTERNAL", message: "Something went wrong on our side", retryable: true });
  });

  app.get("/health", async () => ({ ok: true }));
  profileRoutes(app, deps);
  return app;
}
