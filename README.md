# Kimbo

Personal health assistant for logging Indian meals and connecting them to a blood report.
Phase 1 loop: **Report → Food focus → Log meals → Track progress**. See [SPEC.md](SPEC.md).

## Layout

| Path | What |
| --- | --- |
| `packages/shared` | Zod contracts for every request/response, shared nutrition rounding |
| `apps/api` | Fastify + Postgres API. AI sits behind `MealRecognizer` / `ReportExtractor`; nutrition, targets, focus rules and progress are deterministic |
| `apps/mobile` | Expo SDK 57 + Expo Router Android app |

## Run locally

```sh
pnpm install
createdb kimbo                       # Postgres 15+
cd apps/api && cp .env.example .env  # add ANTHROPIC_API_KEY for real photo/report AI
pnpm dev                             # API on :3000
cd ../mobile && npx expo start --android
```

Without `ANTHROPIC_API_KEY` the API uses offline demo adapters: rule-based text parsing,
a fixed thali for photos and a fixed sample report.
The Android emulator reaches the API at `10.0.2.2:3000`; set `EXPO_PUBLIC_API_URL` otherwise.

## Tests

```sh
cd apps/api && pnpm test   # needs Postgres; uses kimbo_test (TEST_DATABASE_URL to override)
```

Tests drive the HTTP API against a real database with fake AI adapters and a settable clock.

## APK

```sh
cd apps/mobile && npx eas-cli@latest build -p android --profile preview
```

Set `EXPO_PUBLIC_API_URL` in `eas.json` to the deployed API first (an HTTPS URL).

## Tuning

All product constants (calorie formula, marker thresholds, focus-match criteria, goal band,
streak rules) live in `apps/api/src/domain/config.ts`. Food values live in
`apps/api/src/domain/catalogue-data.ts`; bump `CATALOGUE_VERSION` when changing them.
