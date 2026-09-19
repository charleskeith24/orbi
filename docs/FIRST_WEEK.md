# Your first week / Unang 7 araw — build brief

**Status:** the user approved it on 2026-09-19.

**Goal:** a new creator gets through Quick setup, then gets a short daily mission (about 10 minutes) for 7 days. The missions walk them once around the whole loop — capture → create → script → publish → measure → review → plan — so the habit forms before the beta ends. Most new apps lose people in the first week, and this card is Orbi's answer to that.

## Rules
- **One checklist, not two.** For a workspace in its first weeks, the plan **replaces** the existing Home first-steps card (`features/dashboard/first-steps-card.tsx`, `firstSteps()` in `first-run.ts`). Reuse and extend `first-run.ts` rather than building a second, competing list. When the first week is finished or dismissed, the Home card goes back to its current behaviour.
- **Ticked from real data, never by clicking "done".** A mission is complete when the workspace shows it happened, the same way `firstSteps` works.
  - **Only the creator's own actions count.** The ideas Quick setup generates must not count as "captured". Tell them apart by `content_ideas.source` (see `IDEA_SOURCES` in `constants.ts`), and by created-after-setup where needed.
- **Paced, not locked.**
  - Day N comes from the workspace start (`workspaceStartKey`).
  - The card shows **today's mission** first, then the rest with ✓ or ○.
  - Earlier missions that weren't done stay open, with a gentle "catch up" label and no guilt wording.
  - Later missions can be done early.
- **Every mission has one clear primary action.** It opens the right dialog or page, in the same style as the existing `FirstStepAction`.

## Missions (default plan)
| Day | Mission (EN / TL) | Done when |
|---|---|---|
| 1 | Capture 3 ideas of your own / Mag-capture ng 3 sariling ideas | ≥ 3 ideas the creator added after setup |
| 2 | Turn one idea into content / Gawing content ang isang idea | ≥ 1 content item |
| 3 | Write your first script / Isulat ang unang script | ≥ 1 content script |
| 4 | Make it sound like you / Gawing tunog-ikaw ang Orbi | brand has ≥ 1 tone **or** trait, and ≥ 1 audience problem. This absorbs the "Set your voice" and "Add problems" steps. |
| 5 | Publish and log your first post / I-publish at i-log ang unang post | ≥ 1 published item |
| 6 | Add its numbers / Ilagay ang numbers nito | ≥ 1 content metrics snapshot |
| 7 | Review your week and plan the next / I-review ang linggo at i-plan ang susunod | a saved weekly review, **or** a Weekly Planner plan for next week. Check how Reports and the Weekly Planner store these, and pick the honest signal. |

A small optional **bonus** after Day 7: "Save one collab idea / Mag-save ng isang collab idea", done when ≥ 1 collab exists.

**Finish card.** When all 7 are done, show "Your first week is done 🎉 / Tapos na ang unang linggo mo". Include a few real counts: ideas, content, posts and first views. Then, per §10, offer one real next action, such as the Weekly Planner.

**Dismiss.** Offer "Hide / Itago". The plan also retires itself 14 days after the workspace start, after which the regular Home card behaviour returns.
- Store the dismissal where it survives devices in the online version.
- **Pick the smallest honest place.** If that needs a new `app_settings` field, follow §3 "Workspace-schema changes" (types, defaults, init migration, parity, normalize).
- Don't use localStorage for this. It must follow the account.

## Where it shows
- **Home:** the full card, replacing the first-steps card while active.
- **Today:** one compact row near the top: "Day 3 · Write your first script → Open", or a catch-up line. It hides when the plan is finished or dismissed.
- **Optional — Reminders.** Mention today's mission in the daily digest, if that's a small change in `src/lib/reminders` (text only, in the user's UI language). Skip it if it isn't small, and say so.

## Out of scope
- **Telemetry events.** Measuring missions for the beta would need a new usage event, and §13 requires the migration CHECK list, whitelist and tests to change together. List it as a follow-up; don't build it.
- **ARCHITECTURE.md.** Don't edit it; the lead updates it. Report what should change.

## Definition of done
- **Code checks.**
  - `npx tsc --noEmit -p .` is clean.
  - eslint is clean on changed files.
  - `npx vitest run` passes, with unit tests for mission detection, day pacing (catch-up and early done), onboarding ideas not counting, finish, dismiss and the 14-day retirement.
- **Screenshots** (EN + TL, light desktop + 390px dark):
  - Home and Today on day 1, day 3 with one catch-up, and day 7 all done (finish card);
  - after dismiss.
  - A fresh workspace can be made by running the Quick setup flow (`scripts/onboarding-flow.mjs` shows how), or with `--seed=fresh`.
  - Say how you simulated later days: for example, a test clock, or seeding dates in a scratch script. Never ship a date override.
  - Look at every screenshot.
- **Audits and flows.**
  - `node scripts/route-audit.mjs --only=/,/today --seed=fresh --lang=tl --modes=light,mobile` gives 0 failures.
  - `e2e-flow.mjs` and `onboarding-flow.mjs` still pass.
- **Nothing committed.**
