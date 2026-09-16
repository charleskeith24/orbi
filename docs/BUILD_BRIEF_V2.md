# Orbi v2 — build brief

Lead-owned. Read it fully before you start; your agent prompt names your workstream.

Orbi (Personal Brand Content OS) is built, QA'd and committed. The user asked for four workstreams:

1. **Protect what you have** — prove the Supabase schema on a real Postgres engine, move a local workspace to the cloud, make the app deploy-ready with a step-by-step guide. (Pushing to GitHub is a user action, not in scope.)
2. **Daily habit on the phone** — installable PWA with an offline shell and an Android share target; reminders (calendar file now, web push once deployed); Simple mode.
3. **Filipino creator features** — Brand deals & income tracker plus a media kit; analytics import presets (Meta Business Suite, TikTok Studio, YouTube Studio); Taglish across the whole app.
4. **Selling Orbi to other creators** — trademark pre-check brief; beta toolkit (feedback, opt-in usage analytics, beta test guide).

## Rules for every agent (on top of CLAUDE.md and docs/ARCHITECTURE.md)

- **Ownership.** Edit only files you own (table below). New files inside your own folders are yours. If you need a change in a file you don't own, don't edit it — list it under "Requests for other owners" in your final report.
- **Secrets.** Never create, guess or commit secrets or API keys. Every env var is already listed (empty) in `.env.example`. A feature that needs an account or key renders an honest "not configured" state that says what to do.
- **No demo data in the product UI.** The demo workspace is a test fixture and dev-only QA seed.
- **i18n.** Every new user-facing string goes through the i18n API (below) with English and Taglish. Exceptions: page `metadata` titles, the media-kit document itself (English — it is written for brands), developer-facing errors.
- **Dependencies** are installed (`web-push`, `@types/web-push`, `@electric-sql/pglite`). Don't `npm install` anything else — request it in your report.
- **Memory (8 GB RAM, several agents at once).** While iterating run `npx vitest run <your test files>` and `npx eslint <your files>`; run `npx tsc --noEmit -p .` a handful of times, not in a loop; the full `npx vitest run` once at the end. Never start a dev server (one runs on :3000). Never run `next build` unless your section explicitly allows it.
- **Compiling increments.** A usage limit can stop you mid-task; the tree must type-check at every pause.
- **Verify in the browser.** `node scripts/smoke.mjs <route> --seed=fresh|demo|none [--dark] [--width=390 --height=844] --out=<png>` then look at the screenshot. Check light, dark and 390px mobile. `node scripts/route-audit.mjs --only=/a,/b --seed=demo --dir=<dir>` for console errors/overflow.
- **Final report:** what you built, how you verified it (commands and results), deviations, requests for other owners, files touched.

## Shared contract (implemented by FOUNDATION; everyone builds against it)

Supabase has never been deployed — the init migration has not run anywhere. **Workspace-schema changes go straight into `supabase/migrations/20260910000000_init.sql`** (the parity test parses its `create table` statements). Server-only tables that are not part of the workspace model go into their owner's own new migration file.

### New workspace tables

Append to `TABLE_NAMES` after `"app_settings"` in this order, and create them in the same order at the end of the init migration. RLS, `updated_at` trigger, indexes and comments exactly like every other workspace table. Fractional numbers go into the parity test's `FRACTIONAL_FIELDS`.

**`brand_deals`** — a sponsorship or collaboration.

| column | type | default |
|---|---|---|
| brand_name | text | `''` |
| contact_name | text | `''` |
| contact_email | text | `''` |
| contact_handle | text | `''` |
| source | DealSource: `inbound` `outbound` `agency` `referral` | `inbound` |
| status | DealStatus: `lead` `pitched` `negotiating` `contracted` `in_progress` `delivered` `paid` `lost` | `lead` |
| fee | numeric (fractional), nullable | null |
| currency | text | `'PHP'` |
| deliverables | text[] | `{}` |
| platforms | PlatformId[] | `{}` |
| content_item_ids | uuid[] — array reference to content_items (relations: `array_remove`) | `{}` |
| campaign_id | uuid → content_campaigns, ON DELETE SET NULL | null |
| start_date / due_date / paid_at | date, nullable | null |
| usage_rights | text | `''` |
| show_in_media_kit | boolean | false |
| notes | text | `''` |

**`income_entries`** — money received or expected.

| column | type | default |
|---|---|---|
| date | date — local "today" per insert, like `engagement_logs.date` | today |
| amount | numeric (fractional) | 0 |
| currency | text | `'PHP'` |
| source | IncomeSource: `brand_deal` `affiliate` `platform_payout` `product` `service` `tip` `other` | `other` |
| affiliate_program | text (free text; suggestions: TikTok Shop, Shopee, Lazada, Involve Asia, Amazon) | `''` |
| platform | PlatformId, nullable | null |
| status | IncomeStatus: `expected` `received` | `received` |
| brand_deal_id | uuid → brand_deals, ON DELETE SET NULL | null |
| content_item_id | uuid → content_items, ON DELETE SET NULL | null |
| description | text | `''` |

**`rate_cards`** — media-kit packages.

| column | type | default |
|---|---|---|
| name / description | text | `''` |
| platform | PlatformId, nullable | null |
| deliverables | text[] | `{}` |
| price | numeric (fractional), nullable | null |
| currency | text | `'PHP'` |
| is_active | boolean | true |
| sort_order | integer | 0 |

### New columns on existing tables (in the init migration's `create table`)

- `brand_profiles`: `contact_email text ''`, `website text ''`, `media_kit_bio text ''` (short third-person bio; the media kit falls back to `who_am_i`).
- `app_settings`: `ui_language` UiLang (`en` `tl`) `'en'` · `simple_mode boolean true` · `currency text 'PHP'` · `reminders_daily_enabled boolean false` · `reminders_daily_time text '08:00'` · `reminders_slot_enabled boolean false` · `reminders_slot_lead_minutes integer 30` · `reminders_review_enabled boolean false` · `reminders_review_day integer 0` (0 = Sunday) · `reminders_review_time text '18:00'`.
- Starter Kit: `simple_mode: true`. Demo fixture: `simple_mode: false`, `ui_language: "en"`, realistic deals (every status), income (every source, ~6 months), rate cards and brand contact fields — keep every seed test green (the demo brand must fill every string/array field).
- `normalizeDatabase` already fills missing fields from defaults for older local workspaces — confirm it covers the new tables too.

### Server-only tables (Supabase only, not in `TABLE_NAMES`)

FOUNDATION adds `SERVER_ONLY_TABLES = ["push_subscriptions", "feedback", "usage_events"]` to `schema-parity.test.ts`: tolerated when present, must have RLS enabled. Owners: `push_subscriptions` → REMINDERS (`supabase/migrations/20260914000200_push.sql`); `feedback` and `usage_events` → BETA (`supabase/migrations/20260914000100_beta.sql`).

### Constants & utils (FOUNDATION)

`DEAL_STATUSES` (ordered, label + description), `DEAL_SOURCES`, `INCOME_SOURCES`, `INCOME_STATUSES`, `AFFILIATE_PROGRAM_SUGGESTIONS`, `CURRENCIES` (PHP first). `formatMoney(amount, currency = "PHP")` in `utils.ts` → `₱12,500` (Intl `en-PH`, no decimals for whole amounts).

### Navigation & Simple mode (FOUNDATION)

- New section **Monetize** after Measure: **Money** (`/money`, icon `Wallet`) → Overview `/money`, Brand Deals `/money/deals`, Income `/money/income`, Media Kit `/money/media-kit`.
- `NavItem.simple?: true` marks Simple-mode items: Home, Today, Ideas, Content Studio, Calendar, Analytics, Money, Settings. With `app_settings.simple_mode` on, the sidebar hides the rest and shows a footer toggle "Show all modules (N hidden)"; Settings → General has the switch too. ⌘K and direct URLs still reach every page.
- ⌘K: money pages in `ALL_PAGES`; brand deals searchable → `/money/deals?open=<id>`. Add the entity → page rows to ARCHITECTURE §4.

### Routes, stubs and integration points (FOUNDATION creates; owners replace the stubs)

- `src/app/(app)/money/page.tsx`, `money/deals`, `money/income`, `money/media-kit` → `MoneyOverviewView`, `DealsView`, `IncomeView`, `MediaKitView` in `src/components/features/money/`. Stubs show an honest empty state — no dead buttons.
- ui-store dialog `{ type: "log-income"; dealId?: ID; itemId?: ID }`, mounted in global dialogs → `features/money/log-income-dialog.tsx` (stub).
- Settings tab `reminders` (icon `Bell`, after `engagement`) → `features/reminders/reminders-tab.tsx` (stub).
- Settings → General: App language (English / Taglish), Simple mode, Currency.
- Finishing onboarding sets `app_settings.ui_language` from the onboarding language (english → `en`, taglish → `tl`).

### i18n (core written by the lead in `src/lib/i18n/`; FOUNDATION finishes it)

```ts
import { defineMessages, useT } from "@/lib/i18n"

export const m = defineMessages({
  en: { title: "Brand deals", empty: "No deals yet — log your first collab.", count_one: "{count} deal", count_other: "{count} deals" },
  tl: { title: "Brand deals", empty: "Wala pang deals — i-log ang una mong collab.", count_one: "{count} deal", count_other: "{count} deals" },
})

const t = useT(m)
t("empty")
t.plural("count", deals.length)
```

- A feature's messages live in `messages.ts` inside the feature folder (owned by that feature). Shared words (Save, Cancel, Delete, Edit, Close, Search, Add, Back, Next, Done, Loading…) live in `src/lib/i18n/messages/common.ts` (FOUNDATION).
- Non-React code imports from `@/lib/i18n/core` (never `@/lib/i18n` — that pulls in the store and creates a cycle) and uses `translate(m, getUiLang(), key, vars)`; FOUNDATION provides `getUiLang()` (current workspace language, `"en"` before load).
- FOUNDATION removes the temporary cast in `use-t.ts` once `ui_language` is in the model, and adds a test that checks every `defineMessages` module: same keys, same `{placeholders}`, no empty strings.
- **Taglish voice** — how Filipino creators actually write online: English nouns and product terms, Tagalog glue and verbs, friendly and short. Keep ARCHITECTURE §9 terms in English ("Idea Bank", "Content Studio", "Pipeline"). Match `src/components/features/onboarding/copy-tl.ts`. Examples: Save → "I-save", Delete → "I-delete", Cancel → "Cancel", "No ideas yet" → "Wala pang ideas", "Add your first pillar" → "Idagdag ang una mong pillar", "Something went wrong — try again" → "May mali — subukan ulit". Avoid deep or formal Tagalog ("Kanselahin", "Pagpapatunay") and don't leave Taglish strings in plain English unless the English is what people actually say.

## Workstreams and ownership

| Workstream | Wave | Owns |
|---|---|---|
| **FOUNDATION** | 1 | `src/lib/types.ts`, `src/lib/data/{defaults,relations,starter,seed}.ts`, `src/lib/data/seed/**`, `supabase/migrations/20260910000000_init.sql`, `src/lib/data/schema-parity.test.ts`, `src/lib/data/seed.test.ts`, `src/lib/constants.ts` (additions), `src/lib/utils.ts` (formatMoney), `src/lib/navigation.ts`, `app-shell/app-sidebar.tsx`, `src/lib/store/ui-store.ts`, `app-shell/global-dialogs.tsx`, `app-shell/command-palette/search.ts` (+ test), `features/settings/{tabs.ts,settings-view.tsx,general-tab.tsx,sections.ts,sections.test.ts,use-settings-draft.ts}`, `features/onboarding/{apply-onboarding.ts,onboarding-plan.ts}`, `src/lib/i18n/**`, `src/app/(app)/money/**`, stubs in `features/money/` and `features/reminders/reminders-tab.tsx`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md` |
| **PWA & REMINDERS** | 1 (PWA) → 2 (reminders, after the lead says go) | `src/app/manifest.ts`, `src/app/apple-icon.png`, `public/icons/**`, `public/sw.js`, `next.config.ts`, `vercel.json`, `src/app/(app)/share/**`, `features/pwa/**`, `app-shell/user-menu.tsx`; wave 2: `features/reminders/**` (replaces the stub), `src/lib/reminders/**`, `src/app/api/push/**`, `src/app/api/cron/**`, `supabase/migrations/20260914000200_push.sql` |
| **SUPABASE & DEPLOY** | 1 | `src/lib/data/supabase-adapter.ts`, `src/lib/data/local-adapter.ts` (fixes only), `src/lib/supabase/**`, new `src/lib/data/*.pglite.test.ts`, `src/proxy.ts`, `src/app/(auth)/**`, `src/components/providers/data-provider*`, the app-shell data gate and local-mode banner, `features/settings/{data-tab.tsx,workspace-io.ts,workspace-io.test.ts,storage-usage.ts,download.ts}`, `docs/SUPABASE.md`, `docs/DEPLOY.md` |
| **IMPORT PRESETS** | 1 | `src/lib/integrations/**`, `features/settings/{csv-import,csv-mapping,csv-review,integrations-tab,integration-card,connect-dialog}.tsx` |
| **BETA & TRADEMARK** | 1 | `docs/TRADEMARK_CHECK.md`, `docs/BETA_TEST.md`, `features/feedback/**`, `src/lib/telemetry/**`, `src/app/api/feedback/**`, `src/app/api/events/**`, `supabase/migrations/20260914000100_beta.sql`, `app-shell/app-topbar.tsx`, `features/onboarding/wizard.tsx` (tracking calls only) |
| **MONEY** | 2 | `features/money/**` (replaces the stubs), one new dashboard card file + its line in `dashboard-view.tsx`, the Studio item-details file where the brand-deal link goes (name it in your report) |
| **I18N** (several agents) | 3 | existing screens, assigned by folder later |
| Lead | — | `package.json`, `.env.example`, `README.md`, this brief, final QA |

## Workstream specs

### FOUNDATION

Everything under "Shared contract". Done when tsc, eslint and the full vitest suite are green, `route-audit` on the money routes and `/settings?tab=general`, `/settings?tab=reminders` passes with `--seed=demo` and `--seed=fresh`, and you have looked at screenshots of the sidebar with Simple mode on and off (light, dark, 390px).

### PWA & REMINDERS

**Wave 1 — PWA.** Read the manifest / PWA guidance in `node_modules/next/dist/docs/` first.

- `src/app/manifest.ts`: name/short_name "Orbi", description, `start_url: "/today"`, `scope: "/"`, `display: "standalone"`, background and theme colours from the light theme, icons 192 and 512 plus a maskable 512, `apple-icon.png` 180. Generate the PNGs from the Orbi mark on a solid tile by rendering SVG in Chrome with playwright-core (no new dependencies). Shortcuts: Quick Capture, Today, New content. `share_target`: GET `/share` with `title`, `text`, `url`.
- `/share` (inside the app shell): turns shared title/text/url into a prefilled Quick Capture (Android). For iPhone, be honest: Add to Home Screen works; share-to-app doesn't.
- `public/sw.js`: offline app shell — static assets stale-while-revalidate, navigations network-first with a cached fallback, never cache `/api/*` or Supabase requests, versioned cache cleanup. Register only in production builds (or behind an explicit flag) so dev and HMR are untouched. Local mode then keeps working offline.
- User menu: "Install Orbi" — `beforeinstallprompt` on Android/desktop Chrome; on iOS a short Add-to-Home-Screen instructions dialog; hidden when already running standalone.
- You may run **one** production check at the end: `npx next build` then `npx next start -p 3100` (stop it afterwards); verify the manifest, icons, service-worker registration and an offline reload with playwright-core.
- Then **stop and report**. The lead messages you when wave 2 can start.

**Wave 2 — Reminders** (after FOUNDATION lands).

- Pure `src/lib/reminders/`: from the `reminders_*` settings, posting-schedule slots, scheduled items and the timezone, compute upcoming reminders — daily digest ("2 posts today…"), slot reminders N minutes before each slot, weekly review.
- **Calendar reminders** (works everywhere, no server): Settings → Reminders → "Add to my calendar" downloads an `.ics` with recurring events and alarms (RFC 5545; test by parsing it). This is the default path in local mode.
- **Web push** (online version only): `/api/push/subscribe`, `/unsubscribe`, `/test` (Supabase auth); `push_subscriptions` with RLS (own rows); `/api/cron/reminders` (`Authorization: Bearer $CRON_SECRET`, service access via `SUPABASE_SECRET_KEY`, idempotent, safe to call every 15 minutes, records what was sent); service-worker `push` and `notificationclick` handlers that open the right page; `vercel.json` cron entry. Document schedulers: check the current Vercel plan limits for cron frequency, and Supabase `pg_cron` + `pg_net` as the free 15-minute option. Honest states: local mode → "needs the online version"; iPhone → "add Orbi to your Home Screen first (iOS 16.4+)"; missing VAPID keys → "not configured".
- Tests: reminder computation (timezones, week start), ICS output, cron route with mocked web-push and Supabase.

### SUPABASE & DEPLOY

- **Prove the schema on a real Postgres engine with PGlite.** Apply every file in `supabase/migrations` in order, with a stub Supabase `auth` schema (`auth.users`, `auth.uid()` from a session setting, `anon`/`authenticated` roles if PGlite supports them). Tests: migrations apply cleanly; the demo workspace inserts in `TABLE_NAMES` order; every `relations.ts` rule behaves the same in Postgres (delete a parent, compare with the in-memory `planDelete`); `updated_at` triggers fire; RLS isolates two users (if PGlite can't do roles/RLS, say so and test what it can). FOUNDATION edits the init migration in parallel — keep the tests data-driven (`TABLE_NAMES`, migration files) and re-run them at the end.
- Review the Supabase adapter and auth path for bugs you can prove with a test; fix them in owned files.
- **Local → cloud.** When signed in with an empty cloud workspace while this browser holds a local workspace (`localStorage["pbos:workspace:v2"]`), offer "Move my local workspace to my account" (Settings → Data, plus a one-time prompt after sign-in). Import through the adapter in FK order with progress, a confirm and a toast; keep the local copy until it succeeds.
- **Backups in local mode:** record the time of every export, show "Last backup" in Settings → Data, and a gentle reminder in the local-mode banner when there has been no backup for 7 days.
- `docs/DEPLOY.md`: step by step for a non-developer — GitHub (GitHub Desktop), a Supabase project (Singapore region), running the migrations, auth URLs, Vercel import and env vars, custom domain, what is free, troubleshooting. Update `docs/SUPABASE.md`.

### IMPORT PRESETS

- Presets: Meta Business Suite (Facebook posts, Instagram posts), TikTok Studio, YouTube Studio ("Table data.csv"). Detect the preset from the header row (synonym sets, case- and spacing-insensitive, extra columns tolerated), auto-map the columns, keep the manual mapping editable.
- Parse robustly: thousands separators, percentages, `0:45` / `1:02:03` durations, several date formats, blanks, quoted CSV, BOM. XLSX → clear "save it as CSV first" guidance.
- Unmatched rows: optional "Create published posts for unmatched rows" (published item + metrics snapshot through the existing domain operations) to bootstrap analytics history — off by default, per-row choice, preview first.
- Realistic fixtures in `src/lib/integrations/fixtures/`; tests for detection, parsing, matching and bootstrap.

### BETA & TRADEMARK

- `docs/TRADEMARK_CHECK.md`: web research, citing URLs, on existing "Orbi" marks and products — Netgear Orbi and any others in software/SaaS/marketing (Nice classes 9, 35, 42). How to search IPOPHL (plus WIPO Global Brand Database and USPTO), a risk summary, next steps, and 8–10 alternative names that keep the orbit logo, each with a quick conflict note. Clearly marked "not legal advice".
- `docs/BETA_TEST.md`: testing with 3–5 Filipino creators — setup (online version, invite-only via the Supabase dashboard), tasks to observe, interview questions (English and Taglish), what to measure, how to read feedback and the onboarding funnel (SQL snippets), timeline.
- **Feedback:** a "Feedback" button in the top bar → dialog (kind: bug / idea / confusing / praise; message; current page attached). Online version → `POST /api/feedback` (Supabase, RLS insert/select own rows). Local mode → an honest message plus "Copy feedback" (clipboard).
- **Opt-in usage analytics** (online version only, off by default, toggled in the feedback dialog, stored per device): onboarding step viewed/completed (calls in `onboarding/wizard.tsx`), module page views, key actions (idea captured, content created, post published, metrics logged). Batched `POST /api/events` → `usage_events`. No personal content in events.
- `supabase/migrations/20260914000100_beta.sql` with RLS.

### MONEY (wave 2)

- **`/money` overview:** received this month vs last month; expected (open deals + expected income); income by source per month (stacked bar, last 6 months, §6 chart rules); top-earning content (income linked to items, plus deal content); deals due soon; empty state → Log income / Add deal.
- **`/money/deals`:** board by status (drag between statuses, like Pipeline) with a table toggle; detail sheet (`?open=`): contact, fee, deliverables checklist, linked content (link existing, or create content for the deal and link it), dates, usage rights, notes, `show_in_media_kit`. "Mark paid" creates the income entry (source `brand_deal`, amount = fee) and sets status `paid` + `paid_at`.
- **`/money/income`:** table (date, description, source, platform, deal, content, amount, status) with filters and search, add/edit/delete, totals, CSV export, `?open=`.
- **Log income dialog** (global): amount, source, optional deal/content.
- **`/money/media-kit`:** auto-built one-pager in English — brand, niche, positioning, bio, location, contact; platforms (handle, `current_followers`, average views and engagement rate over the last 90 days from analytics, period labelled); top posts; audience summary (primary persona); rate cards (CRUD here); past collaborations (deals with `show_in_media_kit`). Missing data → inline prompts to fill it, never invented numbers. "Print / Save as PDF" with a print stylesheet that is always light.
- **Studio:** show and set a content item's brand deal (writes `content_item_ids` on the deal).
- **Dashboard:** "Income this month" card, shown only when there is income or a deal.
- Tests for the money model (totals, by source, mark paid, media-kit metrics).

## Order

1. Wave 1 in parallel: FOUNDATION, PWA (part 1), SUPABASE & DEPLOY, IMPORT PRESETS, BETA & TRADEMARK.
2. Wave 2 after FOUNDATION: MONEY, REMINDERS.
3. Wave 3: i18n of existing screens.
4. Lead QA and commit.
