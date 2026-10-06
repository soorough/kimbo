# Kimbo

Personal health assistant for logging Indian meals and connecting them to a blood report.
Phase 1 loop: **Report → Food focus → Log meals → Track progress**. See [SPEC.md](SPEC.md).

## Layout

| Path | What |
| --- | --- |
| `packages/shared` | Zod contracts for every request/response, shared nutrition rounding |
| `apps/api` | Fastify + Postgres API. AI sits behind `MealRecognizer` / `ReportExtractor`; nutrition, targets, focus rules and progress are deterministic |
| `apps/mobile` | Expo SDK 57 + Expo Router Android app |

## Features

**Start screen.** Two columns of feature cards (rings, weight line, week bars, streak grid, a
report-to-focus diagram) drift up behind the headline on warm charcoal, in pastel colours with a mint
accent. "See a sample week" opens a demo profile with a week of meals and a report.

**Onboarding.** Kimbo introduces itself and asks what to call you (optional; the name greets you on Today and
can be changed on the You tab). Then one question per screen; numbers are picked on rulers (no keyboard). Kimbo acts out each
question and reacts to the answer: a signpost for the goal, a cake for age, a ruler that tracks height, a
scale that reads the weight, a jog that speeds up with activity, a bullseye with the goal weight and a
stopwatch for pace. Weights go to 0.1 kg; a "build muscle" goal is always at least 2 kg above today's
weight. The pace step explains what speed costs (fast loss takes muscle; muscle can only be built at
about ¼ to ½ kg a week, so a faster gain is mostly fat) and has **Have a date in mind?**: pick a date
and Kimbo says whether it is realistic, doable with effort, hard or not realistic, and offers the
earliest realistic date or a goal weight that fits. The same check is on Edit goal. The reveal explains the calorie target and allows a custom number. The blood report is an optional
last step.

**Today.**
- Calories left and macro bars. Tapping the card opens **Today's nutrition**: calories, protein, carbs,
  fat, saturated fat and fibre against targets. Limits that are crossed show the excess past a tick
  in plum, and plain warnings name the dish behind it ("Fat is 4 g over. Mostly from Samosa"). On a
  weight-loss goal the saturated-fat warning mentions the cut.
- Goal journey (weigh-ins, kg to go, days on target) and today's food focus. The focus card opens the
  Report tab.
- Meal slots with "Same as yesterday".

**Logging a meal.** Camera, gallery, a typed sentence ("rajma chawal with salad") or the food list. Every
result opens a review screen where portions and dishes can be changed before anything is saved. The log
sheet also offers:
- **My meals**: meals saved by name ("Save to My meals" on the review screen), managed on the My meals
  screen (rename, delete).
- **Recent**: up to six distinct meals from the last 60 days, most often logged first. × hides one
  from the list without touching history; logging it again brings it back.

**Progress.**
- **Road to goal**: a contribution-style grid with one square per day since the start (nothing,
  logged, on target; weeks ahead dashed), the goal ring, current and best on-target streaks, and
  **Edit goal**, a single form with goal, weights, pace, activity and body details and a live calorie
  target.
- The week's calories against the ±10% target band, focus adherence, the weight trend, week-over-week
  gains, patterns and milestones.

**Report.** Upload a PDF or photo, photograph a printed report, type the values or try a sample. Kimbo reads
LDL, HbA1c and triglycerides, asks you to confirm them, and picks one food focus. **Insights since the
report** show how many meals helped the focus (overall and by week), the dishes that helped most, and a
retest nudge. Once a second report exists, the focus marker is compared between the two real
results. Meals are never presented as changing a blood value.

## Design decisions

**Direction: a warm Indian kitchen notebook.** Kimbo is about home food and gentle habits, so it should
feel like a well-kept recipe notebook, not a clinical dashboard or a gym tracker.

- **Colour has meaning.** Paper and ink neutrals keep long food lists calm. Curry-leaf green is for
  actions and "this helped your focus". Turmeric is reserved for celebration (milestones, streaks,
  on-target days). "Worth watching" and going over target use plum, never red: they inform without
  alarming. The start screen uses its own night palette (charcoal, pastel cards, mint accent) so
  Kimbo is the only orange on it.
- **Two typefaces, two jobs.** Fraunces (a soft serif) for moments that should feel personal: greetings,
  the target and focus reveals. Plus Jakarta Sans for anything scanned quickly: numbers, lists, labels.
  Only the six weights in use are bundled (per-weight imports; the package roots would pull in all 32).
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

## Code map

| Where | What |
| --- | --- |
| `packages/shared/src/index.ts` | Zod schemas for every request and response |
| `packages/shared/src/goal.ts` | Calorie formula, paces, macro targets and the saturated-fat limit, shared by app and API |
| `apps/api/src/routes/` | HTTP routes (see the table below) |
| `apps/api/src/domain/` | Pure logic: catalogue and meal drafts, focus rules and matching, progress and streaks, goal journey and calendar, recent meals, report insights |
| `apps/api/src/repo/` | Postgres queries; the schema is applied on startup from `src/db/schema.ts` |
| `apps/api/src/ai/` | Claude adapters for meal photos/text and report extraction, plus offline demo adapters |
| `apps/mobile/src/app/` | Screens (Expo Router): tabs, onboarding, log, review, nutrition, edit-goal, my-meals, report review |
| `apps/mobile/src/components/` | Kimbo and its onboarding scenes, the start-screen wall, charts, road-to-goal grid, report insights card, ruler picker |
| `apps/mobile/src/lib/` | API client, meal draft store, session, units, theme |

### API

Every route except `POST /profiles` takes the profile id in an `x-profile-id` header.

| Route | Purpose |
| --- | --- |
| `POST /profiles`, `GET /profiles/:id`, `PUT /profiles/:id/goal` | Create a profile (fresh or demo), read it, set the goal |
| `POST /meals/parse` | Text or photo to a meal draft (nothing saved) |
| `POST /meals`, `PATCH /meals/:id`, `DELETE /meals/:id`, `GET /meals?date=` | Save, edit, delete and list meals |
| `POST /meals/repeat-yesterday` | Copy yesterday's meal of a type |
| `GET /meals/recent`, `DELETE /meals/recent/:key` | Recent distinct meals as drafts; hide one |
| `GET/POST /saved-meals`, `PATCH/DELETE /saved-meals/:id` | My meals: list, save by name, rename, delete |
| `GET /foods/search?q=` | Search the catalogue |
| `GET /today` | Targets, totals, meals and focus for today |
| `GET /progress` | This week: per-day calories, goal days, focus adherence, insights, milestones |
| `GET /journey`, `POST /weights` | Weight journey, day-by-day calendar and best streak; log a weigh-in |
| `POST /reports/extract`, `POST /reports`, `GET /reports` | Read a report, confirm it (sets the focus), list reports |
| `GET /reports/insights` | Progress since the latest report |
| `POST /checkins` | Welcome-back check-in |

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

Tests drive the HTTP API against a real database with fake AI adapters and a settable clock
(179 tests: meals, recent and saved meals, progress, journey calendar, reports, report insights and the goal-date check).

Mobile checks: `cd apps/mobile && npx tsc --noEmit`.

## Deploy

The API runs on Railway at https://api-production-9b58.up.railway.app, built from the root
`Dockerfile` (see `railway.json`). Deploy from the repo root with `railway up`; set
`DATABASE_URL` and `ANTHROPIC_API_KEY` on the Railway service.

## APK

Cloud build (uses `EXPO_PUBLIC_API_URL` from `eas.json`):

```sh
cd apps/mobile && npx eas-cli@latest build -p android --profile preview
```

Local release build (about 32 MB):

```sh
cd apps/mobile/android
EXPO_PUBLIC_API_URL=https://api-production-9b58.up.railway.app NODE_ENV=production ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

## Tuning

All product constants (marker thresholds, focus-match criteria, goal band, streak rules) live in
`apps/api/src/domain/config.ts`. The calorie formula, paces, macro split, the saturated-fat limit
(under 10% of energy) and the goal-date check (`assessTimeline`: loss comfortable up to 0.5% of body
weight a week, realistic up to 1%) live in `packages/shared/src/goal.ts`. Recent-meal limits (60 days, six meals)
are in `apps/api/src/domain/recent-meals.ts`. Food values live in
`apps/api/src/domain/catalogue-data.ts`; bump `CATALOGUE_VERSION` when changing them.
