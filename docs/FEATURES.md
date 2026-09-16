# Feature Briefs

Each section is the build brief for one feature area. Section numbers like **§33** refer to the product specification.
Read `docs/ARCHITECTURE.md` first — it is the contract (data layer, URL conventions, design system, chart rules, AI rules, definition of done).

## Shared building blocks (already built — use them, don't re-invent)

| Need | Use |
|---|---|
| Page chrome | `PageContainer`, `PageHeader`, `PageSection`, `SectionCard` from `@/components/common` |
| Stats / meters | `StatTile`, `Meter`, `ScoreRing` |
| Identity & status | `PlatformIcon`, `PillarBadge`, `PersonaBadge`, `StageBadge`, `IdeaStatusBadge`, `PriorityBadge`, `FunnelBadge`, `TierBadge`, `StatusPill`, `ColorDot` |
| Inputs | `PillarSelect` … `IdeaStatusSelect`, `MultiSelect`, `ChipToggleGroup`, `PlatformToggleGroup`, `ListEditor`, `TagPicker`, `EntityTagEditor`, `DatePicker`, `DateTimePicker`, `NumberField`, `InlineText`, `FormField` |
| Lists | `DataTable`, `FilterBar`, `SearchInput`, `FacetFilter`, `ViewToggle`, `EmptyState` |
| Content | `ContentCard`, `ContentThumbnail`, `DetailSheet`, `KeyValue`, `Markdown`, `CopyButton`, `useConfirm` |
| AI UI | `AiButton`, `ProviderBadge`, `AiNotice` |
| Charts | `@/components/charts` — `TrendChart`, `ColumnChart`, `BarList`, `MixBar`, `DonutChart`, `Sparkline`, `FunnelBars`, `Heatmap`, `ChartFrame`, `EmptyChart` |
| Analytics | `@/lib/analytics` — metrics, tiers/winners, aggregates, pipeline/today/buffer, consistency, balance, health, goals, experiments, reports, recommendations/insights |
| AI | `@/lib/ai` — `useAiTask(task)`, `runAiTask`, `useAiStatus`, task input/output types |
| Data | `@/lib/store` — hooks (`useTable`, `useRow`, `useLookup`, `useBrand`, `useSettings`, `useDb`), `dataActions`, domain operations, `uiActions` |

Read the actual exports (`src/components/common/index.ts`, `src/components/charts/index.ts`, `src/lib/analytics/index.ts`, `src/lib/ai/index.ts`) before coding — the names above are indicative.

## Cross-feature components with fixed props (stubs until their owner implements them)

- `RepurposePanel({ itemId, onCreated? })` — `@/components/features/repurpose/repurpose-panel` (owner: F9)
- `ContentTree({ itemId?, ideaId? })` — `@/components/features/repurpose/content-tree` (owner: F9)
- `WhatToPost({ variant?: "card" | "full", className? })` — `@/components/features/recommendations/what-to-post` (owner: F2)
- Global dialogs `QuickCaptureDialog`, `NewContentDialog`, `LogPostDialog`, `AddMetricsDialog` — `@/components/features/capture/*` (owner: F2). Everyone else opens them with `uiActions.openDialog(...)`.
- `StrategistPanel()` — `@/components/features/strategist/strategist-panel` (owner: F19). Everyone else uses `uiActions.askStrategist(prompt)`.

Cross-link to other features with URLs (see ARCHITECTURE §4), not by importing their components.

## Common requirements for every feature

- `page.tsx` stays a small server component exporting `metadata` and rendering one client view from `src/components/features/<feature>/`. Wrap views that read `useSearchParams()` in `<Suspense>`.
- Honor `?open=<id>` on every list page (opens the detail sheet) and keep the URL in sync when a sheet opens/closes (`router.replace` with `scroll: false`).
- All numbers are computed from the workspace via `@/lib/analytics` — never hard-coded.
- Every AI action: `AiButton` pending state, `ProviderBadge` on results, errors shown inline with retry, results editable before saving. Works offline (template engine) — never block on a missing API key.
- Empty states for empty lists; confirm dialogs for deletes; toasts for mutations; validation for forms.
- Light + dark, desktop + tablet + mobile (≥ 360px). Page padding via `PageContainer`.
- No dead buttons. No placeholder text. Terminology per ARCHITECTURE §9.
- Whole-number columns (counts, targets, `severity`, `sort_order`, scores, `weekly_post_target`, buffer days, `winner_window`, `frequency` …) are `integer` in Postgres: use `NumberField integer` or `Math.round` before saving, or saves fail in Supabase mode only. Fractional fields (rates, percentages, thresholds, `years_experience`, `posting_frequency`, retention, watch time) may be decimals.
- Frozen stats (`weekly_reviews.stats`, `monthly_reviews.stats`) must be plain JSON — numbers, strings and ids — never `Date` objects or whole rows copied from analytics results.
- Inside cards prefer `variant="outline"` or `"ghost"` buttons for secondary actions; one `default` (primary) button per region.

---

## F1 · Home Dashboard — `/`

**Owns:** `src/app/(app)/page.tsx`, `src/components/features/dashboard/**` · **Spec:** §2, §46, §55, §62

The executive dashboard must immediately answer: What should I create today? What is due? What is in production? What is ready to publish? What performed best recently? Which pillars perform? Which platforms grow? What should I create more of? Am I posting consistently?

Layout (desktop grid, `max-w-[1400px]`; mobile stacks with Today, posting progress and quick capture first):
1. **Header** — eyebrow "Personal Brand OS", greeting with the brand owner's first name, "This week · Mon d – Sun d", actions: Capture idea, New content.
2. **KPI row** (4 `StatTile`s, each links somewhere real):
   - *Posting progress* — "Posts published 7 / 10" this week + `Meter` + "3 scheduled for the rest of the week" (`weeklyPostingProgress`), 8-week history sparkline (`postingHistory`).
   - *Content due* — due today + overdue count → `/today`.
   - *Content buffer* — "11 days · Healthy" / "Content Buffer Low" (`contentBuffer`), breakdown on hover → `/pipeline`.
   - *Growth* — followers gained last 7 days with delta vs previous 7 and trend (`periodTotals`/`comparePeriods`, `timeSeries`) → `/analytics`.
3. **Content Today** card — Due today · Scheduled today · Awaiting production · Awaiting approval (counts + first items, click → `/studio/<id>`) (`contentToday`).
4. **Content Health Score** card — `ScoreRing` 0–100 + band label ("Healthy Content System") + component bars with detail text (consistency, pillar balance, engagement, completion, repurposing, backlog) (`contentHealthScore`).
5. **Content Pipeline** strip — IDEA → BRIEF → SCRIPT → PRODUCTION → REVIEW → READY → SCHEDULED → PUBLISHED with counts (`pipelineCounts`), clickable → `/pipeline`.
6. **This week** mini calendar — 7 days: posting slots (from `content_calendar`) vs scheduled/published items with platform icons; open slots flagged "Open slot · Tutorial / Framework" → `/calendar`.
7. **Top Performing Content** — last 30 days, top 5: thumbnail, title, platform, views, engagement rate, leads, pillar, `TierBadge` (`topPerformers`) → `/winners`.
8. **Content Pillar Performance** — table Pillar | Posts | Avg Views | Engagement | Leads (`pillarPerformance`) + **Pillar Distribution** `MixBar` actual vs target with imbalance warnings (`pillarMix`) — the dashboard must warn when the content mix is unbalanced.
9. **AI Recommendations** — `<WhatToPost variant="card" />` + `strategicInsights` list (icons per type, links) + 2–3 "Ask the strategist" prompt chips (`uiActions.askStrategist`).
10. **Platform growth** — `BarList` of platforms (views + followers gained last 30 days with deltas) (`platformPerformance`).
11. **Quick Capture** — inline input: Enter saves an inbox idea (`createIdea`, source `quick_capture`); "Transform with AI" opens the quick-capture dialog with the text.

---

## F2 · Today, Capture dialogs & What-to-post — `/today` + global dialogs

**Owns:** `src/app/(app)/today/page.tsx`, `src/components/features/today/**`, `src/components/features/capture/**` (replace the 4 stubs, keep props), `src/components/features/recommendations/**` (replace the `WhatToPost` stub, keep props) · **Spec:** §10, §25, §32, §38, §52 (daily), §53

**Today page — Daily Content Command Center**
- Header "Today · Wednesday, Sep 10" + quick buttons **+ Capture Idea**, **+ Create Content**, **+ Log Published Post**, **+ Add Analytics** (global dialogs).
- Sections (desktop columns, mobile stack), all from `contentToday`:
  - **Today's Content** — scheduled + due today, platform icons, time; *Mark published* (`moveItemToStage` → then offer *Add analytics*).
  - **Content to Record** — `toRecord`; *Start recording* → stage `recording`; *Done* → `editing`.
  - **Content to Review** — `toReview`; inline *Approve* (→ `ready_to_post`) / *Request revision* (→ `revision`) / *Open*.
  - **Content to Post** — `toPost`; *Copy caption/script* (current script body via `getCurrentScript`), *Open*, *Mark published*.
  - **Content Overdue** — reschedule quick actions (Tomorrow / Pick date via `DatePicker` → `due_date` or `scheduleItem`), *Open*.
  - **Ideas Captured Today** — list + *Convert* (new-content dialog with `ideaId`).
  - **Suggested Content** — `<WhatToPost variant="full" />`.
- **Engagement Tracker** (§53) — today's tasks from `settings.engagement_tasks` with +/− counters toward targets and completion checkboxes, stored in today's `engagement_logs` row (create on first change); counters for comments responded to, DMs replied, creator comments, questions collected, potential content ideas; *Collect a question* inline form → `audience_questions` row (+ increments `questions_collected`); notes; 7-day mini history.
- **Daily rhythm** (§52) — Capture · Create · Review · Publish · Engage with a check when today's activity proves it (e.g. ideas captured today > 0, an item moved forward today, nothing left in review, something published today, engagement tasks done).

**`WhatToPost({ variant, className })`** — the Content Decision Engine (§38)
- Deterministic ranking from `recommendNextContent`; shows **Today's best content**: title, platform, format, angle, suggested hook, CTA, and *Why this topic / platform / format / angle* (plain-language reasons + signals).
- *Refine with AI* runs `what_to_post` with the candidates and today's context; show `ProviderBadge`; keep the deterministic pick visible until the AI result arrives.
- Actions: *Create this content* (idea → `convertIdeaToContent` with the recommended platform → `/studio/<id>`; existing item → open it), *Next suggestion* (cycles candidates), *Open idea*.
- `card` = compact (dashboard); `full` = with alternatives list.

**Global dialogs** (keep the stub props exactly)
- **QuickCaptureDialog** (§10) — autofocused textarea "Enter an idea…"; *Save* (⌘/Ctrl+Enter) → `createIdea` (title = first sentence ≤ 90 chars, description = full text, source `quick_capture`, status `inbox`), toast with *Open* (`/ideas?open=`). *Transform with AI* → `capture_idea` → editable preview (topic, pillar, persona, hook + category, format, platforms, goal, funnel stage, talking points) → *Save idea*. Full-screen on mobile. `initialText` pre-fills.
- **NewContentDialog** — tabs *From an idea* (searchable ideas, validated/selected first → platforms multi-select → stage (default Brief) → due date → `convertIdeaToContent` → `router.push('/studio/<firstId>')`) and *From scratch* (title, platforms (one item per platform), pillar, format, persona, goal, funnel, stage, due date, owner, campaign, series → `createContentItem` → navigate). Honors `ideaId` and `defaults`.
- **LogPostDialog** (§32) — title, platform, published date/time, URL, pillar, format, hook (+ category), funnel stage, campaign; optional metrics section → `logPublishedPost`; toast with *Open* and *Add analytics*.
- **AddMetricsDialog** (§25) — searchable item picker (published first; preselect `itemId`), recorded date, metric fields grouped (Reach: views, reach, profile visits · Engagement: likes, comments, shares, saves · Conversion: followers gained, link clicks, leads, sales · Video: watch time, average retention — video formats only), pre-filled from the latest snapshot, **live computed rates** (`computeRates`: engagement, share, save, lead conversion, follower conversion), save → `logMetrics` → toast including the resulting performance tier. Mobile: 2-column grid, `inputMode="numeric"`.

---

## F3 · Strategy — `/strategy`, `/strategy/goals`, `/strategy/platforms`, `/strategy/system`

**Owns:** those four `page.tsx` + `src/components/features/strategy/**` · **Spec:** §3, §4, §15, §29, §50, §51, §52, §1

- **Brand HQ** (`/strategy`) — sectioned editor with a sticky section nav (desktop): *Identity* (name, brand name, role/profession, industry, expertise summary, years of experience, location, main platforms) · *Brand Positioning* (Who am I? What do I want to be known for? What problems do I help solve? Why should people listen to me? What makes my point of view different?) · *Positioning Statement* builder "I help [AUDIENCE] achieve [DESIRED RESULT] through [METHOD / EXPERTISE]." with live preview + copy · *Expertise Areas* (chips + `EXPERTISE_SUGGESTIONS`) · *Brand Personality* (10 selectable traits) · *Communication Style* (Language: English / Tagalog / Taglish; Tone multi-select) · *Brand Rules* (Always do, Never do, frequently used phrases, phrases to avoid, preferred CTA style, storytelling style). Dirty-state bar ("Unsaved changes · Discard · Save changes"), validation (name required), `updateBrand`. *Suggest with AI* runs `onboarding_strategy` from current answers and lets the user accept positioning statement / known-for / point of view per field. **Completeness meter** ("Brand HQ 86% complete — the AI writes better when this is complete") and a read-only **Brand Voice preview** of what the AI is told (§29).
- **Goals** (`/strategy/goals`) — the five categories (Awareness, Authority, Community, Leads, Business) with their KPIs; CRUD goals (name, category, description, KPIs, target metric, target value, period, active); choose **PRIMARY** and **SECONDARY** goal (`updateBrand`); progress `Meter` via `goalProgress`; count of content linked to each goal (last 30 days).
- **Platforms** (`/strategy/platforms`) — one editable card per platform (Facebook, TikTok, Instagram, YouTube, LinkedIn, X, Threads): active, handle, primary goal, posting frequency/week, preferred formats, preferred pillars, audience, CTA style, current followers, notes. Summary: total weekly frequency vs `weekly_post_target` (warn on mismatch) and 30-day performance per platform (`platformPerformance`). Integration status line: "Manual analytics · API connection in Settings → Integrations".
- **Flywheel & System** (`/strategy/system`) — the **Personal Brand Flywheel** (§51: Expertise → Content → Attention → Trust → Authority → Community → Opportunity → Experience → More content) as an elegant circular SVG with live evidence per step (e.g. Content: posts last 30 days; Attention: views; Trust: saves; Authority: shares; Community: comments; Opportunity: leads; Experience: stories logged). **The 10 principles** (§50) each with a live "how the system enforces it" metric (e.g. "Every piece of content needs a purpose — 92% of items have a goal"). **Operating rhythm** (§52) daily/weekly/monthly with links. **Core loop** (§1) Strategy → … → New strategy with links to each module.

---

## F4 · Audience — `/audience`, `/audience/problems`, `/audience/questions`

**Owns:** those three `page.tsx` + `src/components/features/audience/**` · **Spec:** §5, §54, principles 1 & 4

- **Audience HQ / Personas** — persona cards (colour, name, profession, primary badge, # problems, # questions, platforms, share of recent content targeting them). Detail/editor sheet (`?open=`) with every §5 field (lists via `ListEditor`): name, age range, profession, industry, experience level, location, goals, problems, fears, frustrations, aspirations, questions, objections, buying motivation, content consumed, platforms, influencers, language they use, notes, colour. Set primary, duplicate, delete (confirm).
- **Problem Bank** — grouped by the 8 categories (Beginner, Intermediate, Advanced, Emotional, Financial, Career, Business, Operational); filters persona / pillar / severity; search; CRUD; each problem shows linked ideas/items; *Create idea* (`createIdea` source `problem_bank`, problem/persona/pillar prefilled) and *Generate ideas* → `/ideas/generator?problem=<id>&persona=<id>&pillar=<id>&run=1` (the Idea Generator, pre-filled and started). Highlight **untapped problems** (no ideas yet) — "Each problem can become a content idea".
- **Question Bank** (§54) — table: question, person/source, platform, topic, frequency asked, pillar, converted?; sort by frequency; *+1 asked again* (frequency + `last_asked_at`); priority derived from frequency (≥ 5 High, ≥ 3 Medium) so repeated questions rise; *Convert to idea* (idea source `question_bank`, status `idea_created`, `idea_id` set); *Mark answered* (link a content item); *Dismiss*; inline quick add; CRUD.

---

## F5 · Pillars, Matrix & Funnel — `/pillars`, `/pillars/matrix`, `/pillars/funnel`

**Owns:** those three `page.tsx` + `src/components/features/pillars/**` · **Spec:** §6, §7, §8

- **Content Pillars** — visual cards (colour, icon from a curated lucide list, name, description, example chips, target %, actual % last 30 days, posts, avg views, engagement, leads). Create / edit / delete (confirm: content keeps its data but loses the pillar) / reorder. **Set Target %** with a running total that must equal 100 (validation + *Normalize to 100*). `MixBar` actual vs target + imbalance warnings (`pillarMix`). *Add recommended pillars* for missing `PILLAR_PRESETS`. `?open=`.
- **Content Matrix** (§7) — choose dimensions: pillars × formats × audience problems (optionally by persona) × goals × funnel stages → *Generate combinations* (cartesian, capped ~60, prioritising under-target pillars and high-severity/untapped problems) → rows with the combination chips + a deterministic working title; actions *Save as idea* (source `matrix`) and *Expand with AI* → `/ideas/generator?pillar=&format=&problem=&goal=&funnel=&count=3&run=1` for that combination. Also a pillar × format **coverage heatmap** of existing content to reveal gaps.
- **Content Funnel** (§8) — TOFU (Awareness: reach new audiences), MOFU (Trust: build expertise and relationship), BOFU (Conversion: create an action) cards with goals and examples; distribution (last 30/90 days) vs targets (`funnelMix`) with `MixBar`/`FunnelBars`; performance per stage (`funnelPerformance`: views, engagement, leads); edit `settings.funnel_targets` (sum 100); recent items per stage; items without a funnel stage with quick-assign.

---

## F6 · Idea Bank — `/ideas`

**Owns:** `src/app/(app)/ideas/page.tsx`, `src/components/features/ideas/**` · **Spec:** §9, §39, §10

- Header with counts per status + inline quick-capture input (Enter → inbox idea; *AI* → quick-capture dialog with the text).
- **Views**: *Table* (`DataTable`: title + hook, pillar, persona, platforms, format, goal, funnel, priority, status, score, created), *Cards* (dense grid), *Kanban* (6 status columns — Inbox, Researching, Validated, Selected, Converted to Content, Archived — drag & drop with @dnd-kit to change status; dropping into Converted opens the convert flow).
- **Filters**: search, pillar, platform, format, audience, goal, priority, status (default "Active" = hides archived + converted), source; sort by score / created / priority. Persist view + filters in the URL. `?q=` prefills search; `?open=` opens the sheet.
- **Idea detail sheet** — every field editable (title, core topic, description, hook + hook category, angle, pillar, persona, problem (filtered by persona), goal, platforms, format, funnel stage, inspiration, source, priority, status, talking points, CTA, why it matters, campaign, series, tags). **Idea Priority Score** (§39): seven 1–10 sliders with descriptions → live "IDEA SCORE 84 / 100" + HIGH/MEDIUM/LOW (`setIdeaScores`); *Score with AI* (`score_idea`, shows rationale, apply). Actions: *Convert to content* (platforms + due date → `convertIdeaToContent` → link to `/studio`), *Generate hooks* (`generate_hooks` → pick → set hook), *Duplicate*, *Archive/Restore*, *Delete* (confirm). Related: converted items, source link (story / research / question / winner).
- **Bulk actions** on table selection: status, priority, pillar, archive, delete.

---

## F7 · Ideas Lab — `/ideas/generator`, `/ideas/hooks`, `/ideas/angles`

**Owns:** those three `page.tsx` + `src/components/features/ideas-lab/**` · **Spec:** §11, §12, §13, §57

- **Content Idea Generator** — inputs: content pillar, audience, platform, content goal, topic, funnel stage, angle (optional), audience problem (optional), number of ideas (1–20); prefill from `?pillar=&persona=&problem=&platform=&goal=&topic=&funnel=&angle=&format=&count=`; `run=1` generates immediately on load (used by the Problem Bank, Content Matrix and Angle Library). Results (`generate_ideas`) as cards: TITLE, CORE IDEA, WHY IT MATTERS, HOOK, FORMAT, ANGLE, KEY TALKING POINTS, CTA, PLATFORM, FUNNEL STAGE. Multi-select → *Save to Idea Bank* (source `ai_generator`; map format/angle names to ids). *Regenerate*, *More like this*. Recent generations (from `ai_generations`) can be restored. `ProviderBadge`. Empty state with example briefs.
- **Hook Library** — search; filter by category (Curiosity, Contrarian, Mistake, Authority, Story, Problem, Results, List, Warning, Question, Custom) and source; favourites. Each hook: text with `___` blanks highlighted, category, times used, avg views / engagement / leads of content that used it (`hookPerformance`). Header: **Which hook styles work best** — `hookCategoryPerformance` as `BarList` with a metric switch (views, retention, engagement, leads). CRUD. *Generate hooks with AI* (`generate_hooks` → save selected). *Use hook* → copy or create an idea with it. `?open=`.
- **Angle Library** — the default + custom angles with description and example, usage (ideas/items with the angle) and average performance; CRUD custom angles; *Generate ideas with this angle* → `/ideas/generator?angle=<id>`. `?open=`.

---

## F8 · Content Studio — `/studio`, `/studio/[id]`

**Owns:** `src/app/(app)/studio/**`, `src/components/features/studio/**` · **Spec:** §16, §17, §28, §29, §30

- **Studio home** — *Continue creating* (items in brief/scripting/review/revision by due date), *Start from an idea* (validated/selected ideas → convert → workspace), *Create from scratch* (new-content dialog), format quick-starts (Short-form Script, Facebook Post, LinkedIn Post, Carousel, Video Brief), *Recently published*, search.
- **Workspace** (`/studio/<id>`; not found → empty state) — header: inline-editable title, platform, stage (`moveItemToStage`), pillar / persona / format / funnel / goal (editable), due date, schedule (`DateTimePicker` → `scheduleItem`), owner, priority, *Mark published*, menu (duplicate, delete with confirm, open idea, copy link). Tabs (`?tab=`):
  1. **Brief** (§17) — Content Title, Objective, Target Audience, Audience Problem, Content Pillar, Platform, Format, Funnel Stage, Hook (library picker + *Generate hooks*), Angle, Main Message, Supporting Points, CTA, Visual Direction, Reference, Caption, Production Notes, B-roll, On-screen text, Deadline, Status. Autosave with a "Saved" indicator. *Generate brief with AI* (`content_brief`) → preview → apply all / per field.
  2. **Script** (§16) — format selector (Short-Form Script: HOOK · CONTEXT · VALUE · EXAMPLE · KEY TAKEAWAY · CTA; Facebook Post: HOOK · STORY/PROBLEM · INSIGHT · LESSON · CTA; LinkedIn Post: HOOK · CONTEXT · INSIGHT · FRAMEWORK · CONCLUSION · CTA; Carousel: Slides 1–7; Video Brief: Hook · Talking points · B-roll · Visual direction · On-screen text · CTA; plus the other `SCRIPT_FORMATS`), section editor with hints, word count and spoken-time estimate (~150 wpm), *Generate with AI* (`generate_script`, optional Story Vault story picker), versions (history, restore, side-by-side compare), caption + hashtags, copy full script, carousel slide preview, `saveScriptVersion`.
  3. **Score** (§28) — `score_content` on the current script: HOOK /20, RELEVANCE /20, VALUE /20, CLARITY /20, AUTHENTICITY /20, CTA /10, TOTAL /100 + rating ("High Potential"), strengths and actionable improvements; disclaimer "A quality evaluation — not a prediction of virality"; saved to `quality_score`; "stale" when the script changed after scoring.
  4. **Repurpose** — `<RepurposePanel itemId={id} />`.
  5. **Tree** — `<ContentTree itemId={id} />`.
  6. **Performance** — latest metrics, rates, tier (value vs baseline), snapshot history, *Add analytics* (`uiActions.openDialog({ type: "add-metrics", itemId })`), published URL; before publishing, explain when it appears.
  - Right rail (desktop): brand voice reminders (tone, phrases, CTA style), linked idea, related stories (keyword overlap → `/stories?open=`), recent AI activity for this item.
- ⌘/Ctrl+S saves the current tab.

---

## F9 · Repurposing Engine & Content Tree

**Owns:** `src/components/features/repurpose/**` (replace both stubs, keep props) · **Spec:** §23, §24, principle 6

- **`RepurposePanel({ itemId, onCreated })`** — source summary; selectable tiles for every `REPURPOSE_TYPES` entry (Facebook post, LinkedIn post, Carousel, X thread, Instagram Reel caption, YouTube Short, Newsletter insight, Follow-up video, Part 2, Opposite opinion, Case study, Update post) showing existing state (created → link to the item; suggested → badge). *Generate selected* → `repurpose` task with the source item + current script body (fallback: brief/hook/title) → editable previews → *Create content item* per asset (`createRepurposedItem` with sections and provider) or *Create all*; *Save as suggestion* (`content_repurposing` status `suggested` with draft) and *Dismiss* suggestions. `ProviderBadge`.
- **`ContentTree({ itemId, ideaId })`** — resolve the root idea (via `idea_id` / `parent_id` chain) and render ORIGINAL IDEA → content items per platform → repurposed children (recursive) → pending suggestions (dashed). Node: platform + format glyph, title, stage, tier badge when published, views; click → `/studio/<id>` or `/ideas?open=`. Layered horizontal layout on desktop, indented list on mobile; summary line "1 idea → 7 assets across 5 platforms".

---

## F10 · Pipeline — `/pipeline`

**Owns:** `src/app/(app)/pipeline/page.tsx`, `src/components/features/pipeline/**` · **Spec:** §18, §55, §2

- Header: counts per stage group; **Content Buffer** panel (§55): Ready Ideas, Ready Scripts, Ready-to-Record, Edited Content, Ready-to-Publish + "CONTENT BUFFER · 11 Days · Healthy" (warning "Content Buffer Low" under the threshold) (`contentBuffer`); *Add content*.
- **Kanban** with the 13 columns in order: IDEAS, SELECTED, BRIEF, SCRIPTING, READY FOR PRODUCTION, RECORDING, EDITING, REVIEW, REVISION, READY TO POST, SCHEDULED, PUBLISHED, REPURPOSE. Horizontal scroll, sticky column headers with counts, collapsible columns (persist in localStorage); PUBLISHED shows the last 14 days with a link to analytics.
- **Drag & drop** (@dnd-kit, pointer + keyboard sensors) → `moveItemToStage`; dropping on SCHEDULED without a date opens a date/time picker → `scheduleItem`; dropping on PUBLISHED offers *Add analytics*.
- **Card** (`ContentCard`): thumbnail, title, platform, pillar, owner, deadline, priority; click → `/studio/<id>`; quick menu (move to…, set due date, assign owner, duplicate, delete).
- Filters: search, platform, pillar, owner, priority, campaign, format; quick add at the top of IDEAS / SELECTED / BRIEF (title + platform → `createContentItem` in that stage).
- Mobile: stage picker showing one column at a time with move buttons.

---

## F11 · Calendar, Posting Schedule & Weekly Planner — `/calendar`, `/calendar/schedule`, `/calendar/planner`

**Owns:** those three `page.tsx` + `src/components/features/calendar/**` · **Spec:** §19, §20, §49, principle 3

- **Calendar** — Month / Week / Day views (persisted), Today, prev/next. Cards show platform icon, pillar colour dot, title, time, stage; published items appear muted with a check. **Drag & drop rescheduling** (unpublished → `scheduleItem`, keeping time of day; published items are not draggable). Click → `/studio/<id>`. Filters: platform, pillar, goal, format, status.
  - **Posting targets** — each day shows its slots from `content_calendar` (e.g. "Educational / Authority") as a subtle lane; unfilled slots show *Fill slot* → pick an idea (filtered to the slot's pillar) → `convertIdeaToContent` scheduled at that day/time, or pick an unscheduled ready item.
  - **Unscheduled tray** — ready_to_post and other undated items; drag onto a day to schedule.
- **Posting Schedule** (`/calendar/schedule`) — fully customizable weekly slots (never hard-coded): per weekday, slots with label, pillar, format, platforms, time, active; add/remove/reorder; *Reset to the recommended weekly strategy* (§49: Monday Educational/Authority, Tuesday Story/Journey, Wednesday Tutorial/Framework, Thursday Opinion/Leadership, Friday Behind the Scenes, Saturday Personal/Lifestyle, Sunday Reflection/Community); summary of slots/week vs `weekly_post_target` and slot pillar mix vs pillar targets.
- **Weekly Planner** (`/calendar/planner`) — guided stepper (§20): 1 Review previous week's performance (`weeklyReport`) · 2 Identify top-performing topics, hooks, formats, platforms, pillars · 3 Choose this week's strategic focus (text + quick picks from `strategicInsights`) · 4 Select content ideas (recommended from `recommendNextContent` + Idea Bank picker; target = weekly post target) · 5 Assign platforms · 6 Set deadlines (auto-fill publish slots and due dates, editable) · 7 Generate content briefs (`convertIdeaToContent` for each; optional `content_brief` AI per item). Output: **Weekly Content Plan** (by day, printable) and a `weekly_reviews` row for the week (focus, `planned_item_ids`). *Draft the plan with AI* (`weekly_plan`) pre-fills steps 4–6.

---

## F12 · Campaigns & Series — `/campaigns`, `/campaigns/[id]`, `/series`

**Owns:** those three `page.tsx` + `src/components/features/campaigns/**`, `src/components/features/series/**` · **Spec:** §21, §22

- **Campaigns** — list with status, date range (time progress), pillar, goal, platforms, pieces (published / planned vs target), views and leads. Create/edit dialog: Name, Objective, Description, Start Date, End Date (≥ start), Audience, Primary Pillar, Goal, Platforms, Campaign Message, Target posts, Colour, Status. Delete (confirm).
- **Campaign detail** (`/campaigns/<id>`) — header + status control; **Content Pieces** (items with `campaign_id` by stage/timeline; add existing items; *New content in campaign* → new-content dialog with `defaults.campaign_id`; linked ideas); a timeline across the campaign dates; **Performance** (`campaignPerformance`: posts, views, reach, engagement, leads, by platform, best piece); message and objective.
- **Series** — Series Name, Description, Frequency, Platform(s), Default Pillar, Default Format, day of week, hook template, active; episodes count, last/next episode; CRUD; detail sheet (`?open=`) with episodes (items with `series_id`), performance, *Create next episode* (new item with series defaults, next date per frequency).

---

## F13 · Story Vault & Research — `/stories`, `/stories/experience`, `/research`, `/research/adapt`

**Owns:** those four `page.tsx` + `src/components/features/stories/**`, `src/components/features/research/**` · **Spec:** §30, §31, §36, §37, principle 8

- **Story Vault** — the content memory: grid/list with type (story, experience, lesson, quote, opinion, framework, case study, achievement, failure, belief), title, lesson preview, pillar, keywords, favourite; filters and search; detail sheet (`?open=`) with Story Title, Situation, Problem, Action, Result, Lesson, Emotion, Potential Content Pillar, Keywords, date, type; *Turn into content ideas* (`experience_to_content` on the story → save angles as ideas, source `story`, `source_ref_id`), *Create idea*; usage (ideas/items citing the story); CRUD; stats line ("18 stories · 9 lessons · used in 12 ideas").
- **Turn Experience Into Content** (`/stories/experience`, §31) — "What happened today?" (example: "Today I had to talk to my team because deadlines were being missed.") → `experience_to_content` → cards for Leadership lesson, Management framework, Personal reflection, Storytelling post, Educational video, Contrarian opinion, LinkedIn post, Facebook post (hook, outline, expandable draft) with *Save as idea*, *Create content*, *Copy*; *Save to Story Vault* (the returned story).
- **Research Library** (§36) — references with Source, Creator, Platform, Topic, Hook, Why it caught attention, What can be learned, Potential adaptation, URL, pasted content, type, status; filters; detail sheet (`?open=`); *Analyze* (`analyze_reference` → Hook, Structure, Angle, Psychology, Why it works, Patterns; status analyzed); *Adapt into original* → `/research/adapt?from=<id>`. Banner: "Analyze structure, angle, hook and pattern — then create original content. Never copy."
- **Inspiration → Original** (`/research/adapt`, §37) — 1 paste reference (or pick from the library) → 2 AI analysis → 3 ORIGINAL version adapted to the user's audience, expertise, experience and brand voice (pillar / persona / platform selectors, optional story) → title, hook, outline, draft, originality note → *Save as idea* (source `research`), *Create content*, *Save reference to library* (status `adapted`).

---

## F14 · Analytics — `/analytics`, `/analytics/posts`

**Owns:** those two `page.tsx` + `src/components/features/analytics/**` · **Spec:** §25, §26, §13, §2, principle 7

- **Overview** — one filter row (date range presets 7/30/90/180 days + custom, platform, pillar) scoping everything; KPI tiles with deltas vs the previous period: posts, views, reach, engagements + engagement rate, followers gained, leads (+ lead conversion), saves, shares; `TrendChart` of views/reach (weekly) and follower growth; breakdowns (each in `ChartFrame` with a table twin): platform, pillar (posts, avg views, engagement, leads), format, hook style (metric switch: views / retention / engagement / leads), funnel stage; tier distribution (Normal / Good / Winner / Breakout) with a link to Winners; posting-time `Heatmap` (weekday × hour vs avg views); `strategicInsights`.
- **Post Performance** (`/analytics/posts`) — `DataTable` of published items: title + thumbnail, platform, date, pillar, format, views, reach, likes, comments, shares, saves, followers gained, profile visits, link clicks, leads, sales, watch time, retention, engagement rate, share rate, save rate, lead conversion, follower conversion, tier. Sort, filters, column visibility (sensible default subset), search, **Export CSV**. Row → detail sheet (`?open=`): snapshot history (edit/delete snapshots), rate formulas (`RATE_FIELDS`), tier explanation (value vs baseline, ratio, sample size, thresholds), *Add snapshot*, link to Studio.
- Manual entry is first-class: prominent *Add analytics*; "12 published posts have no analytics yet" list with quick add.

---

## F15 · Winners & Experiments — `/winners`, `/experiments`

**Owns:** those two `page.tsx` + `src/components/features/winners/**`, `src/components/features/experiments/**` · **Spec:** §26, §27, §35, principle 5

- **Winning Content Library** — header explains the rule with current settings ("Compared with the average of the last 20 posts on the same platform · Good ≥ 1.5× · Winner ≥ 2× · Breakout ≥ 3×" + *Edit thresholds* → `/settings?tab=performance`); filters (tier, platform, pillar, period); cards with Winning Topic, Hook, Angle, Format, Platform, Content Pillar, Views, Engagement, CTA, ratio ×, tier; pin/unpin manual winners (`pinned_winner`). Detail sheet (`?open=`): **Why It Worked** (editable; *Analyze with AI*), **Replication Ideas**, and **Create more content like this** (`winner_replication`): 5 variations, 3 follow-ups, 3 different hooks, Part 2, Contrarian version, Advanced version, Beginner version, Story version — each *Save as idea* (source `winner`, `source_ref_id`) or *Save all*; *Repurpose* (sheet with `RepurposePanel`); `ContentTree`.
- **Experiments** (§35) — grouped by status; create from templates (short vs long hooks, 30 vs 60-second videos, storytelling vs educational, talking-head vs B-roll, Tagalog vs English, direct vs soft CTA) or blank: Experiment, Hypothesis, Variant A, Variant B, Metric, Start Date, End Date; link published items to each variant; results (`experimentResults`: means, lift, n, suggested winner) with a `ColumnChart`; set Result, Winner, Lesson; status transitions; *Turn lesson into an idea*.

---

## F16 · Reports — `/reports`, `/reports/monthly`

**Owns:** those two `page.tsx` + `src/components/features/reports/**` · **Spec:** §33, §34

- **Weekly Content Report** — week picker (default: last completed week; current week-to-date allowed): Content Published, Posting Consistency, Total Views, Total Reach, Total Engagement, New Followers, Leads, Best Post, Worst Post, Best Platform, Best Pillar, Best Topic, Best Format, Best Hook, Content Mix (`weeklyReport`). AI sections **WHAT WORKED · WHAT DIDN'T · WHAT WE LEARNED · WHAT TO DOUBLE DOWN ON · WHAT TO STOP · WHAT TO TEST NEXT WEEK** (`weekly_review`) → editable → save to `weekly_reviews` (upsert by week, stats snapshot, draft/final); history of saved reviews; *Plan next week* → `/calendar/planner`; print-friendly (`window.print()`).
- **Monthly Personal Brand Review** — month picker: Audience Growth, Total Reach, Total Content, Best Content, Top 10 Posts, Platform / Pillar / Topic / Format Performance, Follower Growth chart, Lead Generation, Business Opportunities, Content Consistency (`monthlyReport`); **MONTHLY STRATEGIC RECOMMENDATIONS** Continue · Increase · Reduce · Stop · Experiment (`monthly_review`) → editable → save `monthly_reviews`; *Create experiment* from an Experiment recommendation (creates a planned experiment); history.

---

## F17 · Settings — `/settings`

**Owns:** `src/app/(app)/settings/page.tsx`, `src/components/features/settings/**`, `src/lib/integrations/**` · **Spec:** §14, §19, §26, §41, §43, §53, §55, §58 (Phase 4), §59

Tabs (`?tab=`):
- **General** — app language (English / Taglish), Simple mode, default currency (v2); weekly post target, week starts on, timezone, default owner, pillar tolerance.
- **Performance** — winner metric, comparison window, minimum sample, Good / Winner / Breakout thresholds with a live preview of how many posts fall in each tier; buffer healthy / warning days.
- **Funnel** — funnel targets (sum 100).
- **Formats** (§14) — CRUD content formats (name, category, description, default script structure).
- **Tags** (§41) — CRUD tags with colour and usage counts.
- **Engagement** (§53) — daily engagement tasks editor with targets.
- **AI** — `useAiStatus` (provider, model, configured), how to enable Claude (`ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_EFFORT` in `.env.local`), what Brand Context is sent, recent generations log (task, provider, duration, status) with *Clear log*.
- **Integrations** (§58 Phase 4) — Meta/Facebook, Instagram, TikTok, YouTube, LinkedIn, Google Drive, Canva, Buffer, Metricool, Later, other social analytics APIs: cards with capabilities (import analytics, publish, assets) and an honest status "Not connected — requires OAuth app credentials". Built on a real adapter interface in `src/lib/integrations` (`IntegrationAdapter { id, name, category, capabilities, status(), connect() }` where `connect()` reports it isn't configured) — **no fake connections**. Include a working **CSV analytics import** (map columns → `logMetrics` for matched items by URL or title) as the manual path.
- **Data** — mode indicator (local / Supabase); **Export workspace** (JSON download), **Import workspace** (validate, confirm replace → `replaceWorkspace`), **Start fresh** (confirm → `createStarterDatabase` → `/onboarding`), local storage usage; pointer to `docs/SUPABASE.md`.

---

## F18 · Onboarding — `/onboarding`

**Owns:** `src/app/onboarding/page.tsx`, `src/components/features/onboarding/**` · **Spec:** §48 (reshaped: niche first)

Every new workspace starts empty and lands here. The onboarding first helps the user **find their niche**, then pre-fills the rest of the setup from it so the whole OS — pillars, audience, hooks, ideas and the AI's voice — is aligned from day one.

0. **Language** — English or Taglish for the whole onboarding (switchable at any step); pre-selects the brand's content language.
1. **Hilig** — topics they could talk about for hours (suggestion chips + free text).
2. **Galing** — skills, what people ask them for help with, experience, results/proof (optional proof story → Story Vault).
3. **Kanino** — who they want to help, where those people are now, their problems.
4. **Para saan** — what the brand should do for them (clients, career, audience, products, speaking, community).
5. **Niche suggestions** — `niche_discovery` AI task → 3 distinct directions, each with a one-line niche, audience, positioning statement, niche-specific pillars, 5 sample ideas, monetization paths, passion / expertise / demand fit scores with reasons, and one honest risk. Pick one, edit it, or write your own.
6. **Clarity check** — one clear sentence, a specific audience, ≥3 real problems, enough range for 30 ideas, a monetization path (warns, never blocks).
7. **Confirm the pre-filled setup** — identity basics, platforms + posting targets + schedule, voice, pillars (sum 100) → **Generate initial strategy** (`onboarding_strategy` with the niche) → 30 niche-aligned starter ideas → *Finish setup* writes Brand HQ (incl. `niche`, `interests`, `niche_fit`), goals, pillars, persona + problems, platforms, slots, settings and ideas → `/`.

`/onboarding?step=niche` re-runs Niche Discovery for an existing workspace (Brand HQ links here). Works offline (template engine) and with Claude.

---

## F19 · Content Strategist — panel + `/strategist`

**Owns:** `src/app/(app)/strategist/page.tsx`, `src/components/features/strategist/**` (replace the stub; keep `export function StrategistPanel()` with no props) · **Spec:** §56, §57

- **StrategistPanel** — right `Sheet` bound to `useUIStore` (`strategistOpen`, `setStrategistOpen`, `consumeStrategistPrompt` → auto-send on open); ~440px, full-screen on mobile. Conversation persisted in `ai_generations` (task `strategist_chat`); user bubbles right, assistant `Markdown` left; suggested prompts (§56): "What should I post this week?", "Why are my educational posts underperforming?", "Give me 20 ideas about leadership.", "Turn my experience today into a Facebook post.", "What topics should I double down on?", "What are my best hooks?", "Build my content plan for next week."; ⌘/Ctrl+Enter sends; typing indicator; error with retry; *Clear conversation* (confirm); `ProviderBadge`. Show what the answer considered (§57: positioning, audience, goal, platform, pillar, funnel stage, recent performance, existing content, audience problems, previous winners) as compact context chips. Suggested ideas render as cards with *Save to Idea Bank*; follow-up questions as chips; link *Open full page*.
- **`/strategist`** — the same conversation full-width with a left column "What the strategist knows" (brand summary, health score, buffer, top pillar, winners) and quick prompts; `?q=` sends a prompt.

---

# Orbi v2 features

Build brief and ownership: `docs/BUILD_BRIEF_V2.md`. Every new string goes through `defineMessages` (English + Taglish, ARCHITECTURE §11).

## F20 · Money — `/money`, `/money/deals`, `/money/income`, `/money/media-kit`

**Owns:** MONEY (wave 2) — `src/components/features/money/**`, replacing FOUNDATION's stubs (read-only lists, `?open=` details, the minimal global `log-income` dialog), plus one dashboard card and the Studio brand-deal link.

- Data: `brand_deals`, `income_entries`, `rate_cards` and the brand's media-kit contact fields (ARCHITECTURE §3). Option lists `DEAL_STATUSES`, `DEAL_SOURCES`, `INCOME_SOURCES`, `INCOME_STATUSES`, `AFFILIATE_PROGRAM_SUGGESTIONS`, `CURRENCIES` in `@/lib/constants`; translated labels in `@/lib/i18n/messages/money`; `formatMoney` / `currencySymbol` in `@/lib/utils`.
- Global dialog: `uiActions.openDialog({ type: "log-income", dealId?, itemId? })`. Brand deals are in ⌘K and open `/money/deals?open=<id>`.
- The demo workspace has a USD deal (total per currency) and a deal paid 50% upfront (so "Mark paid" should record the balance, not the whole fee again).

## F21 · Simple mode & app language

**Owns:** FOUNDATION.

- `app_settings.simple_mode` (Starter Kit: on; demo: off). The sidebar keeps only the `NavItem.simple` modules — Home, Today, Ideas, Content Studio, Calendar, Analytics, Money, Settings — plus the module of the page you're on. Footer toggle: "Show all modules (N hidden)" / "Back to Simple mode"; the same switch is in Settings → General. ⌘K and links reach every page.
- `app_settings.ui_language` (`en` | `tl`) — Settings → General → App language; finishing onboarding sets it from the onboarding language. Settings → General also sets the default currency.

## F22 · Reminders — Settings → Reminders

**Owns:** PWA & REMINDERS (wave 2) — `features/reminders/**` replaces the stub tab. `app_settings.reminders_*` exist: daily digest, a nudge before each Posting Schedule slot, weekly review. Calendar file (.ics) everywhere; web push in the online version.

## F23 · PWA and share target

**Owns:** PWA (wave 1). Installable app with an offline shell, "Install Orbi" in the user menu, Android share target → Quick Capture (`/share`).

## F24 · Analytics import presets

**Owns:** IMPORT PRESETS (wave 1). Meta Business Suite, TikTok Studio and YouTube Studio CSV presets in Settings → Integrations, detected from the header row.

## F25 · Online version, beta toolkit and trademark check

**Owns:** SUPABASE & DEPLOY (schema proven on PGlite, local → cloud move, backups, `docs/DEPLOY.md`) and BETA & TRADEMARK (feedback button, opt-in usage analytics, `docs/BETA_TEST.md`, `docs/TRADEMARK_CHECK.md`).
