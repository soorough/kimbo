import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { AiUnavailableError, type Coach, type ExerciseReader, type MealRecognizer, type ReportExtractor, type Voice } from "./ai/types.js";
import type { Clock } from "./clock.js";
import type { Db } from "./db/index.js";
import { HttpError } from "./errors.js";
import { assistantRoutes } from "./routes/assistant.js";
import { activityRoutes } from "./routes/activity.js";
import { journeyRoutes } from "./routes/journey.js";
import { mealRoutes } from "./routes/meals.js";
import { profileRoutes } from "./routes/profiles.js";
import { progressRoutes } from "./routes/progress.js";
import { reportRoutes } from "./routes/reports.js";
import { savedMealRoutes } from "./routes/saved-meals.js";
import { todayRoutes } from "./routes/today.js";

export interface Deps {
  db: Db;
  clock: Clock;
  recognizer: MealRecognizer;
  extractor: ReportExtractor;
  /** answers typed questions from the user's facts; without it they map to the starter answers */
  coach?: Coach;
  /** reads described workouts; calories always come from Kimbo's rules */
  exerciseReader: ExerciseReader;
  /** Kimbo's spoken voice and listening; optional */
  voice?: Voice;
}

export async function createApp(deps: Deps, opts: { logger?: boolean } = {}) {
  // Photos and report PDFs arrive base64-encoded in JSON bodies.
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 15 * 1024 * 1024 });

  // One generous global cap per IP, tightened per-route for the paid AI endpoints.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: 60_000,
    errorResponseBuilder: () => ({
      code: "RATE_LIMITED",
      message: "Too many requests. Please slow down and try again.",
      retryable: true,
    }),
  });

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
  mealRoutes(app, deps);
  savedMealRoutes(app, deps);
  reportRoutes(app, deps);
  todayRoutes(app, deps);
  activityRoutes(app, deps);
  progressRoutes(app, deps);
  journeyRoutes(app, deps);
  assistantRoutes(app, deps);
  return app;
}
