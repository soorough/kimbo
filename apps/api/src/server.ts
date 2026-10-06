import { ClaudeAdapters } from "./ai/claude.js";
import { DemoAdapters } from "./ai/demo.js";
import { createApp } from "./app.js";
import { systemClock } from "./clock.js";
import { createDb, migrate } from "./db/index.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost:5432/kimbo";
const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.KIMBO_AI_MODEL ?? "claude-opus-5-5";

const db = createDb(databaseUrl);
await migrate(db);

const ai = apiKey ? new ClaudeAdapters(apiKey, model) : new DemoAdapters();
const app = await createApp({ db, clock: systemClock, recognizer: ai, extractor: ai }, { logger: true });
if (!apiKey) app.log.warn("ANTHROPIC_API_KEY not set — using offline demo AI adapters");

await app.listen({ port, host: "0.0.0.0" });
