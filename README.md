# Kimbo

Personal health assistant for logging Indian meals and connecting them to a blood report.
Phase 1 loop: **Report → Food focus → Log meals → Track progress**. See [SPEC.md](SPEC.md).

## Layout

| Path | What |
| --- | --- |
| `packages/shared` | Zod contracts for every request/response, shared nutrition rounding |
| `apps/api` | Fastify + Postgres API. AI sits behind `MealRecognizer` / `ReportExtractor`; nutrition, targets, focus rules and progress are deterministic |
| `apps/mobile` | Expo SDK 57 + Expo Router Android app |

## Design decisions

**Direction: a warm Indian kitchen notebook.** Kimbo is about home food and gentle habits, so it should
feel like a well-kept recipe notebook, not a clinical dashboard or a gym tracker.

- **Colour has meaning.** Paper and ink neutrals keep long food lists calm. Curry-leaf green is for
  actions and "this helped your focus". Turmeric is reserved for celebration (milestones, streaks).
  "Worth watching" and going over target use plum, never red: they inform without alarming.
- **Two typefaces, two jobs.** Fraunces (a soft serif) for moments that should feel personal: greetings,
  the target and focus reveals. Plus Jakarta Sans for anything scanned quickly: numbers, lists, labels.
  Only the five weights in use are bundled.
- **Bottom sheets for short tasks.** Logging a meal, picking a food and editing a portion slide up over
  the current screen, so you never lose your place. Full screens are kept for decisions with consequences
  (reviewing a meal, confirming report values).
- **One primary action per screen**, in a sticky footer within thumb reach. The most frequent action
  (log a meal) is the raised centre of the tab bar.
- **Empty states are starting points.** An empty meal slot is a one-tap "Add lunch", with "Same as
  yesterday" built in when there is something to repeat.
- **No guilt.** No red, no "streak lost", no judging single meals. A missed day doesn't break the streak,
  only gains are compared with last week, and badges show how to earn them, not what you failed at.
- **Delight is tied to progress.** Kimbo (an SVG character) reacts to what just happened, and its sprout
  grows a leaf for every meal that helps the focus. Milestones get a short confetti moment; everything
  else is a passing toast with a light haptic, never a blocking dialog.

### Voice

Kimbo talks like a friend who cooks at home, not a wellness brand. Every string in the app and API follows:

1. **Name the food and the number.** "2 roti + dal, 396 kcal", never "a great meal".
2. **No slogans or filler** ("journey", "wins", "habit", "gentle", "perfection").
3. **No em-dashes.** One idea per sentence.
4. **Kitchen words as people say them:** roti, katori, sabzi, thali, chai.
5. **Health text gives the number and what Kimbo does with it,** never what it means medically.
6. **Buttons name the outcome** ("Use these values", "Save lunch"); they are text-only, with no icons.

### Accessibility

Every text/background pair in `apps/mobile/src/lib/theme.ts` meets WCAG AA (4.5:1 for text, 3:1 for
control borders and graphics). Number inputs in onboarding are rulers with screen-reader increment/decrement.

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
