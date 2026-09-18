# Quick setup — the 4-screen onboarding (build brief)

**Status:** approved by the user on 2026-09-18. It replaces the 10-step first-run onboarding.

**Goal:** a new creator reaches a working Orbi in about 3 minutes, mostly by tapping, and lands on Home with pillars, a posting schedule and the first ideas ready. Orbi fills in everything it can from the answers. Anything that needs the creator's own judgement becomes a task in the Home checklist, never an onboarding step.

## Why
- The current first run has 11 screens and about 12 required answers, with several free-text fields (role, industry, niche statement, positioning). The creator gets nothing back until the end.
- The Niche screen is dense. Each card has a repeated statement, three score bars that look more precise than they are, pillar lists and "Watch out" notes. There is also a warning banner, a statement form and a clarity check underneath.
- The beta test (3–5 creators) needs people to get through setup. Onboarding step events (`onboarding_step_viewed` / `_completed`) will show where they drop off.

## What does not change
- **Niche-first.** The brand is built around the creator's own interests, skills and audience. Never add demo or sample data.
- **Language.** English or Taglish is chosen on the first screen and switches the copy live. Brand HQ's writing language follows that choice, as it does today.
- **Offline.** The engine must still give good niche directions with no API key, and the provider badge stays honest ("Offline templates").
- **Detailed setup.** The full detailed flow (`FULL_FLOW`) stays for `rerun`. Label it **"Detailed setup" / "Detalyadong setup"** on the Already-set-up screen.
- **Niche Discovery re-run.** `/onboarding?step=niche` (mode `niche`) keeps working. It should reuse the new screens 2–4 where that's simple.
- **Onboarding copy.** It keeps its own copy system (`copy-en.ts` / `copy-tl.ts`, voice as in `copy-tl.ts`), not `defineMessages`.

## The flow (mode `first`)

| # | Screen (EN / TL) | Asks | Required | Replaces |
|---|---|---|---|---|
| 1 | **Let's start / Simulan natin** | Language (EN / Taglish toggle at the top), your name, where you post (platform tiles with `PlatformIcon`, multi-select) | name, ≥ 1 platform | welcome, identity (name), platforms |
| 2 | **About you / Tungkol sa'yo** | Interests (chips + type your own); skills (chips + type your own, optional) | ≥ 2 interests | hilig, galing |
| 3 | **Who you help / Sino ang tinutulungan mo** | Audience (chips + type your own); their #1 problem (one optional line); what the brand is for (aims chips, optional, max 3) | ≥ 1 audience | kanino, para saan |
| 4 | **Pick your niche / Piliin ang niche mo** | Tap one of 3 directions, or "Write my own" | a niche | niche |

After screen 4 comes a **Building** screen. It is not counted as a step. Then the setup is applied and the creator lands on **Home (`/`)**.

**Shortcut: "I already know my niche" / "Alam ko na ang niche ko."**
- It appears as a link on screen 2.
- It jumps to screen 4 with "Write my own" open. Name and platforms from screen 1 are still required.
- The written niche alone must be enough to build pillars and ideas.

### Screen details
- **Progress.** Replace the two rows of 10 labels with one thin progress bar and "2 of 4" / "2 ng 4". Step names follow the language: English names in English mode, and Hilig/Galing/Kanino-style names only in Taglish.
- **Screen 2 is compact.**
  - Show the interest suggestion groups collapsed to the first 2 groups, with "Show more" / "Ipakita pa".
  - Selected chips stay visible at the top.
  - Skills get the same chip treatment, marked optional.
  - Drop years of experience, proof and story from first run. They live in Brand HQ, the Story Vault and the detailed setup.
- **Screen 3.**
  - The problem is a single optional input. Offer suggestion chips if the model has them for the chosen audience.
  - Aims are optional chips. If none is picked, default to `audience` (→ awareness goal).
  - Drop "where are they now", experience level and persona platforms from first run.
- **Screen 4, the lighter Niche screen.** Keep the same component for mode `niche` if feasible.
  - **Direction cards.** Each card shows the niche title and **one** "why it fits" sentence. The top-ranked direction gets a **"Best match"** badge. Remove the three score bars and the repeated statement.
  - **Details on demand.** "See details" / "Tingnan ang detalye" collapses the pillars (name + %), "Watch out" and posts & monetization.
  - **Write my own.** It is the **4th card**. Tapping it reveals one textarea for the niche sentence.
  - **What goes and what stays.**
    - Remove from this screen: the niche statement form, the "I help / to / through" positioning fields and the clarity check. Fill positioning from the chosen card; the creator edits it later in Brand HQ.
    - Remove the "Sharpen these" warning banner. At most, show a small hint under the card it applies to.
    - Keep "Regenerate" / "Gumawa ulit" and the provider badge, but make them small.
  - **Selection.** Tapping a card selects it (radio semantics, keyboard reachable). The primary button reads **"Finish setup" / "Tapusin ang setup"**.
- **Building screen.**
  - Show a short list of what Orbi is creating: brand profile, content pillars, posting schedule, goals, first ideas. Each item ticks when its real work finishes.
  - No fake delays and no decorative animation (ARCHITECTURE §5). Use the existing spinner or pending pattern.
  - On failure, show the error with "Try again" and keep the answers.
  - Then apply, clear the draft, and route to `/` with a success toast.
- **Mobile first.**
  - One column, tap targets ≥ 44px, and the sticky bottom bar with Back and Continue.
  - Hide the "⌘ Enter" hint on touch or narrow screens.
  - Must work at 360px.

### What Orbi fills in (pure, unit-tested)
Write one pure function, e.g. `quickSetupAnswers(quick, niche, lang)` in `onboarding-model.ts`. It turns the 4-screen answers into the full `OnboardingAnswers` that the existing apply/plan code already understands, so `apply-onboarding.ts` / `onboarding-plan.ts` keep one path.
- **Identity:** the name from screen 1. Role and industry are derived from the niche, reusing the logic that pre-fills the identity step today. Location is empty.
- **Platforms and posting schedule:** the platforms from screen 1, with the recommended weekly strategy (§49 helper that already exists).
- **Pillars:** from the chosen niche direction, or from the written niche via the same generator the current flow uses. Targets total 100%.
- **Persona:** the first audience, with the #1 problem if one was given.
- **Goals:** from the aims, or from the `audience` default. No targets.
- **First ideas:** the starter ideas the strategy step generates today (about 30), inside the niche.
- **Voice:** **don't invent a personality.** Leave tones and traits empty unless a default is clearly derived from answers. The Home checklist asks for it.
- **Brand language:** from the language chosen on screen 1.

## Home checklist (`features/dashboard/first-run.ts`)
Add setup-review steps that are ticked off from the workspace itself, with EN + TL strings in `firstStepMessages`:
- **"Set your voice" / "I-set ang voice mo"**: done when the brand has ≥ 1 tone or trait. Links to Brand HQ's voice section.
- **"Add your audience's problems" / "Idagdag ang problema ng audience mo"**: done when there is ≥ 1 audience problem. Links to `/audience/problems`.

Keep the existing steps (niche, pillars, idea, content, publish, analytics). The checklist order follows the loop: Strategy → Ideas → Create → Publish → Measure.

## Engine wording fix
In `src/lib/ai/offline/niche.ts` and the related templates, fix the repetitive output the user saw. Examples:
- "Personal improvement … get good at personal improvement";
- three pillars that all start with the niche phrase.

Add a test that the three directions and their pillars don't repeat the niche phrase.

## Draft, telemetry, tests, scripts
- **Draft (`onboarding-draft.ts`).** Drafts are saved with step keys. A draft saved with an old or unknown step key must resume on screen 1 without crashing. Keep the answers it can map.
- **Telemetry.** Step events send the new step keys. They are tokens, so they're fine under `sanitizeProps`. Don't add new properties.
- **Tests.** Update `onboarding.test.ts` to cover:
  - the quick flow order;
  - per-screen validation, where only the required fields block;
  - `quickSetupAnswers` defaults, including the aims default and the written-niche path;
  - migration of old drafts.

  Also add `first-run.test.ts` cases for the new checklist steps.
- **`scripts/onboarding-flow.mjs`.**
  - The first-run passes (English and Taglish) go through the 4 screens.
  - Add a pass for the "I already know my niche" shortcut.
  - Keep the niche-only re-run pass and add a detailed-setup (`rerun`) pass.
  - Every pass checks the stored workspace: niche, pillars totalling 100, ≥ 20 ideas, persona, platforms, posting slots, brand language, `onboarding_completed`.
  - Also print how many screens and required fields each pass needed.

## Definition of done
- `npx tsc --noEmit -p .` is clean, and `npx eslint` is clean on the changed files.
- `npx vitest run src/components/features/onboarding src/components/features/dashboard src/lib/ai src/lib/i18n` passes.
- `node scripts/onboarding-flow.mjs` passes in both languages, plus `--dark --width=390 --height=844`.
- `node scripts/route-audit.mjs --only=/onboarding,/ --seed=none --modes=light,dark,mobile` gives 0 failures.
- `node scripts/e2e-flow.mjs` still passes.
- Screenshots of every screen in EN and TL, in light desktop and 390px dark, including the Building screen, the shortcut, "See details" open, "Write my own" open, a validation error and the Home checklist after setup. Look at every one.
- Nothing committed. The lead reviews and asks the user.

## Status (2026-09-18)

Built as specified and not committed; waiting for the lead's review. Measured by `node scripts/onboarding-flow.mjs`: required fields are the `[data-ob-required]` markers on each screen the creator submits.

| Pass | Screens | Required fields |
|---|---|---|
| Detailed setup (the old first run, now the Brand HQ re-run) | 11 | 15 |
| Quick setup (first run) | 4 (+ Building) | 5 |
| "I already know my niche" shortcut | 3 (+ Building) | 3 |
| Niche Discovery re-run (`?step=niche`) | 3 (was 5) | 1 |

- **Where things live.** The model is `QUICK_FLOW`, the quick keys in `validateStep`, and `own_niche` in `onboarding-model.ts`. `quickSetupAnswers` is in `quick-setup.ts`, not `onboarding-model.ts`, because it composes the niche model and putting it there would create a circular import. The screens are `steps-quick.tsx`, `step-pick.tsx` and `building.tsx`. Drafts now store step keys (version 3); version-2 drafts are migrated.
- **Written niche.** `niche_discovery` takes an optional `niche`. Every direction is then built on that sentence (the offline engine reads the sentence's topic and its "for …" audience), and the Building screen uses the closest direction for pillars, positioning and industry.
- **Deviations.** Directions are ordered best match first. The niche engine's "Sharpen these" notes are no longer shown, because they are general advice and not tied to a card. During a first run the app language (`app_settings.ui_language`) follows the language toggle live, so shared controls (chip inputs, AI badges) match the chosen language. The AI-suggested point of view is not written to Brand HQ, because the creator never sees it in Quick setup.
