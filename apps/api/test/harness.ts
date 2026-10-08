import { afterAll, beforeEach } from "vitest";
import {
  AiUnavailableError,
  type Coach,
  type CoachGreeting,
  type CoachReply,
  type ExtractedReport,
  type MealRecognizer,
  type RecognizedItem,
  type ReportExtractor,
  type Voice,
} from "../src/ai/types.js";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db/index.js";
import { TEST_DATABASE_URL } from "./db-url.js";

/** Scripted stand-in for the AI meal recognizer. */
export class FakeRecognizer implements MealRecognizer {
  next: RecognizedItem[] | Error = [];
  lastInput: { text?: string; image?: string } | null = null;
  async fromText(text: string) {
    this.lastInput = { text };
    return this.respond();
  }
  async fromImage(image: { base64: string }) {
    this.lastInput = { image: image.base64 };
    return this.respond();
  }
  private respond() {
    if (this.next instanceof Error) throw this.next;
    return this.next;
  }
}

/** Scripted stand-in for the AI report extractor. */
export class FakeExtractor implements ReportExtractor {
  next: ExtractedReport | Error = { markers: [], reportDate: null };
  async extract() {
    if (this.next instanceof Error) throw this.next;
    return this.next;
  }
}

/** Scripted stand-in for the assistant's language model; records what it was given. */
export class FakeCoach implements Coach {
  next: CoachReply = { text: "Try dal with roti.", points: [], mood: "happy" };
  lastInput: Parameters<Coach["reply"]>[0] | null = null;
  async reply(input: Parameters<Coach["reply"]>[0]) {
    this.lastInput = input;
    return this.next;
  }
  /** null: the greeting model is "down", so Kimbo's own line is used. */
  nextGreeting: CoachGreeting | null = null;
  greetFacts: string[] = [];
  async greet(input: { facts: string }) {
    this.greetFacts.push(input.facts);
    if (!this.nextGreeting) throw new AiUnavailableError();
    return this.nextGreeting;
  }
}

/** Stand-in for ElevenLabs. */
export class FakeVoice implements Voice {
  spoken: string[] = [];
  heard = "what should I eat for dinner";
  async speak(text: string) {
    this.spoken.push(text);
    return Buffer.from("ID3-fake-mp3");
  }
  async transcribe() {
    return this.heard;
  }
}

/** Settable clock; defaults to Tue 6 Oct 2026, 13:00 IST. */
export class TestClock {
  now = new Date("2026-10-06T07:30:00Z");
  set(iso: string) {
    this.now = new Date(iso);
  }
  read = () => this.now;
}

const db = createDb(TEST_DATABASE_URL);

afterAll(async () => {
  await db.end();
});

/**
 * Builds a fresh app per test against the shared test database, which is
 * emptied before each test. Returns helpers that speak HTTP only.
 */
export function useTestApp() {
  const ctx = {} as {
    app: Awaited<ReturnType<typeof createApp>>;
    clock: TestClock;
    recognizer: FakeRecognizer;
    extractor: FakeExtractor;
    coach: FakeCoach;
    voice: FakeVoice;
  };

  beforeEach(async () => {
    await db.query(
      "TRUNCATE profiles, meals, meal_items, reports, report_markers, focus_assignments, achievements, weigh_ins CASCADE",
    );
    ctx.clock = new TestClock();
    ctx.recognizer = new FakeRecognizer();
    ctx.extractor = new FakeExtractor();
    ctx.coach = new FakeCoach();
    ctx.voice = new FakeVoice();
    ctx.app = await createApp({
      db,
      clock: ctx.clock.read,
      recognizer: ctx.recognizer,
      extractor: ctx.extractor,
      coach: ctx.coach,
      voice: ctx.voice,
    });
    return async () => {
      await ctx.app.close();
    };
  });

  async function request(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    opts: { body?: unknown; profileId?: string } = {},
  ) {
    const res = await ctx.app.inject({
      method,
      url,
      headers: opts.profileId ? { "x-profile-id": opts.profileId } : {},
      ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = res.body ? JSON.parse(res.body) : undefined;
    return { status: res.statusCode, json };
  }

  return {
    ctx,
    request,
    get: (url: string, profileId?: string) => request("GET", url, { profileId }),
    post: (url: string, body: unknown, profileId?: string) => request("POST", url, { body, profileId }),
    put: (url: string, body: unknown, profileId?: string) => request("PUT", url, { body, profileId }),
    patch: (url: string, body: unknown, profileId?: string) => request("PATCH", url, { body, profileId }),
    del: (url: string, profileId?: string) => request("DELETE", url, { profileId }),
  };
}

export const defaultGoal = {
  age: 30,
  sex: "male",
  heightCm: 175,
  weightKg: 70,
  activity: "sedentary",
  goal: "maintain",
} as const;
