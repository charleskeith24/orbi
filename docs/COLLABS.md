# Collabs: creator collaborations (build brief)

**Status:** approved by the user on 2026-09-19.

**Decisions:**
- **Single-player first.** The **Collab tracker** is useful to one creator today, even in local mode and with partners who aren't on Orbi.
- **Networking comes later.** When there are enough online users:
  - Collab Circles (small invite-only accountability groups);
  - Discover & match (opt-in creator profiles, complementary-niche matching);
  - anonymous rate benchmarks.
- **No in-app chat.** For networking, a connect request is a short note. Once it's **accepted**, each side sees the contact channel the other chose to share.
- **Never:**
  - engagement pods, which break platform rules;
  - scraping social profiles;
  - showing workspace data to others without explicit opt-in.

**Why:** in the Philippines, collabs are one of the fastest ways to grow. Creators do TikTok duets and stitches, joint FB/IG Lives, podcast or show guesting, shoutout swaps, giveaways and group brand deals. Nobody measures whether a collab was *worth it*. Orbi can measure it, because it already has the posts and their analytics.

## What the creator gets (`/collabs`)
1. **Collab pipeline.** A board by status plus a table view, with the same patterns as Money → Brand deals:
   - **Idea**
   - **Reached out / Na-message na**
   - **Agreed / Pumayag**
   - **Scheduled / Naka-schedule**
   - **Published / Na-publish**
   - **Reviewed / Na-review**: results looked at, rating given
   - **Declined / Hindi natuloy**: a side state, shown collapsed or filtered
2. **Detail sheet** (`/collabs?open=<id>`). It has:
   - **Partner:** name, @handle, main platform, link, their niche, approximate followers (optional).
   - **Basics:** type, title, date.
   - **Links:** pillar, goal, campaign, brand deal (for group brand deals).
   - **Linked content.** Your posts made for this collab. Link existing content items, or "Create content for this collab", which opens the New content dialog pre-linked.
   - **Follow-up date:** "follow up on …".
   - **Outreach message.** "Write my pitch" (AI) + copy.
   - **Notes.**
   - **Results.**
3. **Results that are computed, never invented.**
   - **Per collab:** views, engagement, and followers gained from the latest snapshot of each linked post, plus the creator's rating (1–5) and "Would collab again?".
   - **Collab lift on the page header.** Compare followers gained per post (and views per post) for collab posts against solo posts. Use the same platform and the last 90 days, and take the median. The result reads e.g. "Collab posts bring **2.4×** the followers of your solo posts".
   - **Not enough data.** Below a minimum (≥ 3 collab posts with metrics and ≥ 5 solo posts), say honestly that there isn't enough data yet and what's needed.
   - **Code.** It's a pure function in `src/lib/analytics/collabs.ts` with tests. Follow §3 Time: pass `now` in.
4. **Collab ideas (AI, `collab_ideas` task).**
   - **Input:** the creator's niche, pillars, audience/personas, platforms and goals.
   - **Output:** 5 ideas. Each has:
     - the collab type;
     - a concept title;
     - **the kind of partner to look for**: an *adjacent* niche that shares the audience without competing (for example, freelancer finance ↔ freelance skills), never a named real person;
     - why it fits;
     - the best platform and format.
   - "Save as collab idea" creates a collab in **Idea** status.
   - The offline engine must give genuinely useful, niche-specific ideas, and the output follows Brand HQ's writing language.
   - Show `ProviderBadge`.
5. **Outreach pitch (AI, `collab_pitch` task).**
   - A short, friendly DM in the creator's writing language (Taglish or English), for the partner and collab type.
   - It says what's in it for the partner (their audience, the format) and proposes a concrete first step.
   - No flattery templates that sound like spam.
   - Offline templates must be decent. Keep the previous draft visible while regenerating.
6. **Follow-ups on Today.**
   - A small "Collab follow-ups" list in Today: collabs in **Reached out** whose follow-up date is today or earlier, plus **Scheduled** collabs happening today.
   - Each row has a quick "Followed up" (moves the date +3 days) and "Open".
7. **Connections elsewhere in the app:**
   - Studio: a chip "Collab with @handle" linking to the collab.
   - Campaign detail: its collabs.
   - Brand deal sheet: linked collabs (group deals).
   - ⌘K: search collabs by partner or title.
   - Navigation: **Collabs** in the "Organize" section after Campaigns (`simple: false`, reachable by ⌘K and links).

## Data model (workspace table `collabs`)
Follow ARCHITECTURE §3 "Workspace-schema changes" exactly. That means editing these together:
- `types.ts`
- `TABLE_NAMES` / `TABLE_DEFAULTS`
- `relations.ts`
- the init migration's `create table`, including RLS, indexes and trigger. Nothing is deployed yet, so extending the init migration is the documented path.
- `normalizeDatabase`, so older local workspaces get the new table.
- `schema-parity.test.ts`, which must pass.

Also add a few collabs to the **demo QA seed** (`src/lib/data/seed.ts`, dev-only fixture) so screenshots have data.

**Fields.** Every row has the standard columns: `id`, `user_id`, `created_at`, `updated_at`.

| Field | Type |
|---|---|
| `title` | text |
| `type` | check: `duet_stitch`, `guesting`, `joint_live`, `shoutout_swap`, `giveaway`, `co_created`, `group_brand_deal`, `other` |
| `status` | check: `idea`, `reached_out`, `agreed`, `scheduled`, `published`, `reviewed`, `declined` |
| `partner_name` | text |
| `partner_handle` | text |
| `partner_platform` | PlatformId, nullable |
| `partner_link` | text |
| `partner_niche` | text |
| `partner_followers` | integer, nullable |
| `pillar_id`, `goal_id`, `campaign_id`, `brand_deal_id` | FK, nullable, on delete set null |
| `content_item_ids` | ID[], `array_remove` on item delete, like `brand_deals` |
| `collab_date` | ISODate, nullable |
| `follow_up_on` | ISODate, nullable |
| `outreach_message` | text |
| `notes` | text |
| `rating` | integer 1–5, nullable |
| `would_repeat` | boolean, nullable |
| `status_changed_at` | ISODateTime |

**Labels.** Option labels (types, statuses) go in `src/lib/constants.ts` like other option lists, and stay English per the i18n rules. Put translated descriptions in the feature's messages where they are shown as helper text.

## AI tasks
- Add `collab_ideas` and `collab_pitch` to `src/lib/ai/tasks`, following the existing tasks' pattern: a schema, a prompt with Brand Context, an offline template engine, and tests.
- Output language is Brand HQ's `brand_profiles.language`.
- Everything goes through `runAiTask` / `useAiTask`; never call a provider from a component.

## Design and language
- Follow §5: the brand-deals board and sheet are the closest pattern.
- Status badges use the icon + label rule, and there are empty states.
- Destructive actions use confirm + toast.
- It must work at 360px and in dark mode.
- Every string uses `defineMessages` in English and Taglish.

## Definition of done
- `npx tsc --noEmit -p .` is clean, and eslint is clean on changed files.
- `npx vitest run` passes in full, including:
  - schema parity;
  - analytics lift tests: enough data, not enough data, and the same-platform baseline;
  - AI offline output tests: niche-specific, no repeated phrases, no named real people;
  - relations: deleting an item, campaign or deal updates the collab.
- Screenshots in EN and TL, light desktop and 390px dark:
  - `/collabs` with the board, the table and the lift tile;
  - the detail sheet;
  - the ideas panel;
  - the pitch;
  - the Today follow-ups;
  - the Studio chip;
  - the empty state (`--seed=fresh`).

  Look at every one.
- Route and click audits:
  - `node scripts/route-audit.mjs --only=/collabs,/today,/studio,/campaigns --seed=demo --lang=tl --modes=light,mobile` shows 0 failures.
  - `node scripts/click-audit.mjs /collabs` finds no dead buttons.
  - `node scripts/e2e-flow.mjs` and `node scripts/onboarding-flow.mjs` still pass.
- Nothing is committed.
