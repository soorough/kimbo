---
title: Kimbo — Phase 1 Spec
status: ready-for-agent
date: 2026-10-06
source: Kimbo — Phase 1 Product Plan (Oct 6, 2026)
---
# Kimbo — Phase 1 Spec

## Problem Statement

People in India who want to eat better for their health face two compounding frustrations:

1. **Logging is tedious.** A normal Indian meal — "2 roti, one katori dal and aloo gobi" — is several items, each with a household portion (roti, katori, bowl, piece) that generic food trackers dmaon't understand. Logging one meal means multiple searches, portion guesses and conversions to grams, so people quit after a few days.
2. **Progress is hard to feel.** Health improvements (a better LDL or HbA1c) take months. Day to day there is no signal that today's food choices mattered, so motivation fades before results arrive.
3. **Blood reports don't connect to daily life.** A user may receive a report showing high LDL or borderline HbA1c, but nothing translates those numbers into "what should I pay attention to at lunch today?"

Existing apps either become dense dashboards that judge every meal as good or bad, or they punish missed days with broken streaks — both of which create guilt and drive people away.

## Solution

Kimbo is an Android app (Phase 1, no login) built around one repeatable loop:

**Report → Food focus → Log meals → Track progress**

- The user completes a short onboarding and gets an estimated daily calorie target with a plain explanation of how it was derived, which they can adjust.
- The user logs a meal by **photo** or **text** (voice if time allows). Kimbo's AI identifies the food items and household portions, then opens a **review sheet**. Nothing is saved until the user confirms; they can change portions, remove wrong items or add missed ones. Calories and macros come from a small, deterministic Indian-food dataset, so the same meal always gives the same numbers.
- The user can upload a blood-report PDF/photo (or use a sample). Kimbo extracts a small supported set of markers (LDL, HbA1c, triglycerides), the user confirms the values, and predefined rules map them to **one food focus** (e.g. "More fibre-rich meals").
- The **Today** screen answers: How am I doing (calories/macros vs goal)? What did I eat? What should I pay attention to (the focus, and how many of today's meals supported it)?
- The **Progress** screen makes consistency visible: days tracked this week, a forgiving consistency streak, weekly goal completion, focus adherence and week-over-week changes.
- A lightweight **Kimbo mascot** reacts to meaningful moments (analysing a meal, accepting a correction, a meal supporting the focus, milestones, returning after a break) without becoming a separate points system or ever shaming the user.
- A seeded **demo profile** lets a reviewer see the whole idea instantly; a **fresh start** path tests onboarding and persistence.

AI assists with recognition and extraction; deterministic code owns nutrition values, targets, focus rules, meal-to-focus matching and progress. Kimbo never diagnoses or gives treatment advice.

## User Stories

### Onboarding & goal

1. As a new user, I want to open Kimbo without creating an account, so that I can try it immediately.
2. As a new user, I want to enter my age, sex, height and weight, so that Kimbo can estimate my energy needs.
3. As a new user, I want to choose my activity level from a few clearly described options, so that my target reflects how active I am.
4. As a new user, I want to choose whether I want to maintain, lose or gain weight, so that my calorie target matches my goal.
5. As a new user, I want to see my estimated daily calorie target, so that I know what I'm aiming for.
6. As a new user, I want a short, plain-language explanation of how the target was calculated, so that I trust the number.
7. As a new user, I want to adjust the suggested calorie target before continuing, so that I stay in control of my goal.
8. As a new user, I want sensible bounds on the target I can set, so that I don't accidentally set an unsafe or nonsensical value.
9. As a new user, I want invalid inputs (e.g. height of 0, age of 200) to be caught with a clear message, so that I can correct them.
10. As a new user, I want to choose between "Start fresh" and "Explore with sample data", so that I can either use Kimbo for real or understand it quickly.
11. As a returning user, I want Kimbo to remember my profile and goal after closing and reopening the app, so that I don't redo onboarding.
12. As a user, I want to edit my profile and calorie target later, so that I can update them as my weight or goals change.
13. As a demo user, I want to switch from sample data to a fresh start, so that I can begin tracking my own meals.

### Logging a meal — text

14. As a user, I want to type a meal in natural language like "2 roti, one katori dal and aloo gobi", so that logging is as fast as describing it.
15. As a user, I want Kimbo to understand Indian household portions (roti, katori, bowl, piece, plate, glass, cup), so that I don't have to convert to grams.
16. As a user, I want Kimbo to understand Hinglish and common spelling variations (e.g. "chawal", "daal", "dahi"), so that I can type the way I speak.
17. As a user, I want a sensible default portion when I don't specify one, so that "dal and rice" still gives a reasonable result.
18. As a user, I want to see a loading state while Kimbo analyses my meal, so that I know it's working.

### Logging a meal — photo

19. As a user, I want to take a photo of my plate, so that I can log without typing.
20. As a user, I want to pick a photo from my gallery, so that I can log a meal I photographed earlier.
21. As a user, I want Kimbo to identify the separate items on a thali or plate, so that a multi-item meal is logged in one go.
22. As a user, I want Kimbo to estimate portions from the photo, so that I only need to correct rather than enter from scratch.
23. As a user, I want a clear message if the photo couldn't be analysed (blurry, not food, network error), so that I can retry or switch to text.

### Logging a meal — voice (should ship)

24. As a user, I want to speak my meal, so that I can log hands-free.
25. As a user, I want to see the transcription before it's parsed, so that I can fix misheard words.

### Review & confirmation

26. As a user, I want every AI result to open in a review sheet rather than saving automatically, so that nothing wrong enters my log.
27. As a user, I want to see each identified item with its quantity and unit, so that I can check what Kimbo understood.
28. As a user, I want to change the quantity of an item with simple steppers, so that correcting portions is quick.
29. As a user, I want to change an item's unit (e.g. katori → bowl), so that the portion matches what I ate.
30. As a user, I want to remove an item Kimbo got wrong, so that my log stays accurate.
31. As a user, I want to swap a wrongly identified item for the correct one by searching the food list, so that I don't have to delete and re-add.
32. As a user, I want to add an item Kimbo missed, so that the meal is complete.
33. As a user, I want calories and macros to update live as I edit, so that I see the effect of my corrections.
34. As a user, I want to see the meal's estimated calories, protein, carbs, fat and fibre before confirming, so that I understand its contribution.
35. As a user, I want items Kimbo doesn't recognise in its dataset to appear as an editable estimate, clearly marked as such, so that I can still log unusual dishes.
36. As a user, I want to set the meal type (breakfast, lunch, snack, dinner) — prefilled from the time of day — so that my day is organised.
37. As a user, I want to set the meal time, so that I can log a meal I ate earlier.
38. As a user, I want to cancel the review without saving, so that I can abandon an incorrect log.
39. As a user, I want to confirm and save the meal with one tap, so that the final step is effortless.
40. As a user, I want Kimbo to acknowledge my correction ("Thanks — got it"), so that fixing AI mistakes feels collaborative rather than annoying.
41. As a user, I want to log a meal manually from the food list if AI is unavailable, so that I'm never blocked from logging.

### Managing logged meals

42. As a user, I want to see today's meals on the home screen, so that I know what I've eaten.
43. As a user, I want to open a logged meal and edit its items, so that I can fix mistakes after saving.
44. As a user, I want to delete a logged meal, so that accidental logs don't distort my day.
45. As a user, I want to log "Same as yesterday?" for a meal type (should ship), so that repeated meals take one tap.
46. As a user, I want my meals to persist across app restarts, so that my history is never lost.

### Today

47. As a user, I want to see calories consumed vs my target for today, so that I know how I'm doing.
48. As a user, I want to see protein, carbs and fat vs simple targets, so that I understand my meal balance.
49. As a user, I want going over my target to be shown neutrally (no red alarms or scolding), so that I don't feel judged.
50. As a user with a confirmed report, I want to see my current food focus on Today, so that I know what to pay attention to.
51. As a user, I want to see "2 of your 3 meals today supported this focus", so that I can see patterns without meals being labelled good or bad.
52. As a user, I want to see which meals supported the focus, so that I learn what works.
53. As a user without a report, I want Today to show a gentle prompt to add one, so that I discover the focus feature.
54. As a user with no meals logged today, I want a friendly empty state with a quick log action, so that starting the day is easy.

### Health report

55. As a user, I want to upload a blood-report PDF, so that Kimbo can read my results.
56. As a user, I want to upload a photo of a printed report, so that paper reports work too.
57. As a user, I want to use a sample report, so that I can try the feature without my own data.
58. As a user, I want to see a loading state while the report is read, so that I know extraction is in progress.
59. As a user, I want Kimbo to extract LDL, HbA1c and triglycerides with their values and units, so that I don't type them.
60. As a user, I want to review each extracted value before Kimbo uses it, so that a misread number doesn't drive my focus.
61. As a user, I want to edit an extracted value or unit, so that I can correct mistakes.
62. As a user, I want to enter a supported marker manually if it wasn't found, so that I can still use the feature.
63. As a user, I want to be told which markers Kimbo supports and that others are ignored, so that I'm not confused by missing values.
64. As a user, I want common unit variants (e.g. mg/dL vs mmol/L for LDL/triglycerides, % vs mmol/mol for HbA1c) handled, so that reports from different labs work.
65. As a user, I want the report date captured, so that later reports can be compared.
66. As a user, I want a clear message when nothing could be extracted, so that I can retry, use manual entry or the sample.
67. As a user, after confirming values, I want to see one simple food focus with a short reason, so that my report becomes actionable.
68. As a user, I want marker status shown in plain words ("worth watching", "in range") rather than diagnoses, so that I'm informed without being alarmed.
69. As a user, I want a visible disclaimer that Kimbo doesn't diagnose or give treatment advice, so that I know to consult a doctor.
70. As a user whose markers are all in range, I want a sensible general focus (e.g. balanced plates), so that the loop still works.
71. As a user, I want Kimbo to mark the moment my report becomes a daily focus, so that the connection feels meaningful.
72. As a user, I want to add a second report later (should ship) and see a simple trend per marker, so that I can see change over time.

### Progress

73. As a user, I want to see how many days I tracked this week (e.g. 5 / 7), so that I see my consistency.
74. As a user, I want a consistency streak that counts days with at least one confirmed meal, so that showing up is rewarded.
75. As a user, I want missing a single day not to wipe out my progress, so that I don't feel punished.
76. As a user, I want to see weekly goal completion (days within a reasonable band of my calorie target), so that I see goal progress without needing perfection.
77. As a user, I want to see focus adherence for the week (e.g. "Fibre focus: 72% — 11 of 15 meals supported it"), so that I see the effect of my report.
78. As a user, I want simple week-over-week comparisons ("+2 days tracked vs last week"), so that improvement is visible.
79. As a user, I want to see consistency milestones I've reached, so that I feel a sense of achievement.
80. As a user, I want progress numbers to always match my logged meals exactly, so that I trust them.
81. As a user, I want 1–2 simple habit insights (should ship, e.g. "Your breakfasts most often support your focus"), so that I learn from my patterns.

### Delight & mascot

82. As a user, I want Kimbo to show a small animated state while analysing a meal, so that waiting feels pleasant.
83. As a user, after confirming a meal that supports my focus, I want a small acknowledgement like "That helped today's fibre focus ↑", so that I feel my choice mattered.
84. As a user, I want a subtle haptic with achievement moments, so that they feel tangible without interrupting me.
85. As a user, I want to be celebrated for my first 3 days tracked, first full week, improved weekly consistency and improved focus adherence, so that consistency feels rewarding.
86. As a returning user after a break, I want a warm welcome back rather than a broken-streak message, so that I'm encouraged to restart.
87. As a user, I want each achievement to be celebrated only once, so that it stays meaningful.
88. As a user, I want mascot reactions to never block my flow, so that logging stays fast.

### Demo / reviewer

89. As a reviewer, I want a demo profile with a week of meals, a sample report, a derived focus and some milestones, so that I understand the full product in a minute.
90. As a reviewer, I want the demo data dated relative to today, so that Today and Progress always look populated.
91. As a reviewer, I want to complete the full journey on a fresh profile (goal → photo meal → correct → save → sample report → focus → Today → Progress), so that I can verify the real flows.
92. As a reviewer, I want to install a working Android APK, so that I can test on a real device.

### Reliability & trust

93. As a user, I want clear error states with retry for every network or AI failure, so that I'm never stuck.
94. As a user, I want a manual fallback for every AI-powered step, so that the app works even when AI doesn't.
95. As a user, I want the same meal to always produce the same nutrition numbers, so that I trust the data.
96. As a user, I want my data stored only against my device's anonymous profile, so that I don't need an account.
97. As a developer, I want AI provider keys to live only on the backend, so that they're never extractable from the APK.
98. As a developer, I want AI providers behind small interfaces, so that models can be swapped without touching product logic.

## Implementation Decisions

### Architecture

- **Client:** Expo + Expo Router + TypeScript, shipped as an Android APK (EAS build). TanStack Query for server state; Zustand/local state only for transient UI (review-sheet draft, onboarding steps).
- **Backend:** Node.js + TypeScript HTTP API, PostgreSQL. All AI calls happen server-side.
- **Shared contracts:** a shared package of Zod schemas defines every request/response body, used by the backend for validation and by the client for typing and parsing.
- **Identity without login:** on first launch the client generates an anonymous device profile ID (stored in secure storage) and sends it on every request. All data is scoped to that profile. Demo mode creates a separate seeded profile.

### Modules

1. **AI adapters (behind interfaces)** — the only code that knows about model providers:
   - `MealRecognizer` — `fromText(text)` and `fromImage(image)` → list of candidate items `{ name, quantity, unit, confidence }`. Output is free-form names, not nutrition.
   - `ReportExtractor` — `extract(file)` → list of `{ markerName, value, unit, reportDate? }` raw candidates.
   - `Transcriber` (should ship) — `transcribe(audio)` → text.
   - Each has a fake implementation for tests and local demo.
2. **Food catalogue** — deterministic, versioned Indian-food dataset (~60–100 items/dishes: roti, rice, dal, rajma, chole, paneer dishes, common sabzis, curd, poha, idli, dosa, eggs, common chicken dishes, etc.). Each entry: canonical ID, display name, aliases (Hinglish/spelling variants), per-unit nutrition for supported household units (calories, protein, carbs, fat, fibre, saturated fat), default unit, and **food tags** used by focus rules (e.g. `fibre_rich`, `high_sat_fat`, `refined_carb`, `fried`, `high_sugar`, `lean_protein`). Interface: `match(name) → catalogue item | unknown`, `nutritionFor(itemId, quantity, unit)`, `search(query)`.
3. **Meal resolution** — takes recognizer candidates and resolves each against the catalogue into a **meal draft**: matched items get deterministic nutrition; unmatched items become `estimate` items with an editable default and an `isEstimate` flag. The draft is returned to the client; **nothing is persisted at this stage.**
4. **Goal calculator** — deterministic calorie target: Mifflin–St Jeor BMR × activity multiplier, adjusted by goal (maintain 0, lose −500, gain +300 kcal, all constants in one place), clamped to safe bounds (e.g. 1200–4000). Also returns a human-readable explanation of the steps and default macro targets. User overrides are stored separately from the computed value.
5. **Health rules** — deterministic:
   - Marker normalisation (unit conversion to canonical units: LDL & TG mg/dL, HbA1c %).
   - Status per marker from fixed thresholds (`in_range` / `worth_watching` / `high`), worded non-diagnostically.
   - Focus selection: a fixed priority-ordered rule table maps confirmed marker statuses to **exactly one** focus. Phase 1 foci: `fibre_focus` (LDL), `steady_carbs` (HbA1c), `less_sugar_refined` (triglycerides), `balanced_plate` (default when all in range). Each focus defines which food tags count as supporting / working against it and its user-facing copy.
6. **Focus matching** — `mealSupportsFocus(meal, focus) → { supports: boolean, reason }` from food tags and meal nutrition (e.g. fibre ≥ threshold or ≥1 `fibre_rich` item with no dominant `high_sat_fat`). Pure and deterministic.
7. **Progress engine** — pure functions over confirmed meals, profile and focus history for a given "today" (in the user's timezone):
   - Days tracked this week (a day counts when it has ≥1 confirmed meal).
   - **Consistency streak** — forgiving: one missed day within a rolling window does not reset it (exact rule: streak counts tracked days, tolerating a single-day gap; two consecutive missed days end it). Shown as consistency, never as "streak lost".
   - Weekly goal completion — tracked days with calories within ±10% of target.
   - Focus adherence — supporting meals / total meals this week.
   - Week-over-week deltas.
   - Habit insights (should ship).
8. **Achievements** — deterministic evaluation after each meal confirm / report confirm / app open returns newly-unlocked achievement events (`first_3_days`, `first_full_week`, `consistency_improved`, `focus_improved`, `welcome_back`, plus contextual events `meal_supported_focus`, `report_became_focus`, `correction_accepted`). Unlocked achievements are persisted so each fires once. The client maps events to mascot states/haptics.
9. **Demo seeder** — generates a demo profile with ~7 days of meals dated relative to now, a sample report with confirmed values, a derived focus and pre-unlocked milestones. Idempotent per profile.
10. **HTTP API** — thin layer wiring the above to Postgres.

### API contracts (shape, not final paths)

- `POST /profiles` — create anonymous profile (fresh or demo).
- `PUT /profiles/:id/goal` — body: biometrics, activity, goal, optional override → returns computed target, explanation, effective target.
- `POST /meals/parse` — body: `{ text }` or image upload (or audio, should ship) → **meal draft** (items with catalogue match, quantity, unit, nutrition, `isEstimate`, totals). No side effects.
- `POST /meals` — body: confirmed meal (items with catalogue IDs or estimate values, quantities, units, meal type, eatenAt, `wasCorrected`). Server **recomputes** nutrition from the catalogue (client-sent nutrition is never trusted for matched items) → saved meal + `focusResult` + achievement events.
- `PATCH /meals/:id`, `DELETE /meals/:id`; `GET /meals?date=`; `POST /meals/repeat-yesterday` (should ship).
- `GET /foods/search?q=` — catalogue search for add/swap.
- `POST /reports/extract` — PDF/image upload or `{ sample: true }` → **report draft** of supported markers with normalised values. No side effects.
- `POST /reports` — confirmed marker values + report date → saved report, marker statuses, selected focus, achievement events.
- `GET /today?date=` — totals vs target, meals with per-meal `supportsFocus`, current focus and "X of Y meals supported".
- `GET /progress?weekOf=` — all progress-engine outputs + unlocked achievements.

All errors use a consistent shape `{ code, message, retryable }`; AI failures return a retryable code so the client can offer retry or manual fallback.

### Schema (Postgres)

- `profiles` — id, created_at, is_demo, timezone, biometrics, activity, goal, computed_target, target_override.
- `meals` — id, profile_id, meal_type, eaten_at, source (`photo`/`text`/`voice`/`manual`/`repeat`), was_corrected, catalogue_version.
- `meal_items` — id, meal_id, catalogue_item_id (nullable for estimates), display_name, quantity, unit, nutrition snapshot (calories, protein, carbs, fat, fibre, sat_fat), is_estimate.
- `reports` — id, profile_id, report_date, source (`upload`/`sample`/`manual`), created_at.
- `report_markers` — report_id, marker (`ldl`/`hba1c`/`triglycerides`), value, unit (canonical), status.
- `focus_assignments` — profile_id, focus, report_id, active_from (focus history allows correct historical adherence).
- `achievements` — profile_id, achievement_key, unlocked_at (unique per profile+key).
- Raw uploaded images/PDFs are not retained after extraction in Phase 1.

### Key product rules

- AI output never writes to the database directly; every persisted value passes through a user confirmation request.
- Nutrition is snapshotted on meal items at save time so catalogue updates don't silently change history.
- Copy is non-judgemental throughout: no "bad meal", no red over-target warnings, no "streak lost".
- Report screens always show the non-diagnostic disclaimer.

## Testing Decisions

- **One seam: the backend HTTP API.** Tests drive the real Node API over HTTP against a real (test) Postgres, with the AI adapters swapped for fakes that return scripted recognizer/extractor output. Assertions are made only on HTTP responses (and follow-up GETs), never on internal functions or table rows.
- **What makes a good test here:** it describes a user-visible behaviour through the public API ("after confirming a high-fibre meal with an LDL focus, Today shows 1 of 1 meals supported and the confirm response includes a `meal_supported_focus` event"). Tests should survive refactors of the goal calculator, rules table or progress engine internals.
- **Time is injectable**: the API accepts a test clock (e.g. via a test-only config) so streaks, weeks and relative demo data are deterministic.
- **Coverage through the seam:**
  - Onboarding: target calculation for representative profiles, explanation present, override respected, bounds/validation errors.
  - Meal parse: fake recognizer output resolves to catalogue items with expected nutrition; unknown items become estimates; aliases/Hinglish resolve; parse has no side effects (subsequent `GET /today` unchanged).
  - Meal confirm: server recomputes nutrition ignoring tampered client values; edits and deletes reflect in Today and Progress.
  - Reports: extraction draft normalises units; nothing applies until confirm; each marker status/focus rule in the table, including priority when multiple markers are out of range and the all-in-range default.
  - Focus matching: supporting vs non-supporting meals reflected in Today counts and weekly adherence.
  - Progress: days tracked, forgiving streak (single gap tolerated, double gap ends), goal completion band edges, week-over-week deltas, focus history across a focus change.
  - Achievements: each fires once and only once; welcome-back after inactivity.
  - Demo seed: demo profile returns populated Today and Progress relative to the test clock.
  - Failure modes: recognizer/extractor errors return the retryable error shape.
- **Not tested via automation in Phase 1:** client UI and mascot animations — verified manually against the success-criteria journey on the APK.
- **Prior art:** none — Kimbo is a new project. Establish the API test harness (app factory + test DB reset + fake AI adapters + test clock) as the first piece of work so every subsequent feature lands with tests through the same seam.

## Out of Scope

- Login/accounts, cross-device sync, full offline sync.
- Web/desktop clients.
- Community/chat.
- Exercise, water, sleep, wearables.
- Barcode scanning.
- Large badge/points system.
- A complete Indian-food database (Phase 1 is a focused catalogue with an estimate fallback).
- Broad medical-report interpretation beyond LDL, HbA1c and triglycerides; any diagnosis or treatment advice.
- AI-generated nutrition values, targets, focus rules or progress numbers.
- iOS release (Expo keeps it possible, but only the Android APK is a deliverable).

## Further Notes

- **Success journey (acceptance):** Open Kimbo → set a goal → photograph an Indian meal → correct the AI result → save → upload/confirm a sample blood report → receive one food focus → see today's meals relative to that focus → see progress build over time.
- **Signature moment:** Report focus → log meal → Kimbo acknowledges the contribution → progress visibly improves. Prioritise polish here over breadth.
- **Must vs should:** voice logging, "Same as yesterday?", habit insights, second-report trend and extra mascot states are should-ship; build them only after the must-ship loop is complete and tested.
- **Thresholds and constants** (calorie adjustments, marker thresholds, focus-match criteria, goal-completion band, streak tolerance) should each live in a single config so they can be tuned and reviewed; values chosen should be documented with their source.
- **Medical safety copy** should be reviewed before release.
