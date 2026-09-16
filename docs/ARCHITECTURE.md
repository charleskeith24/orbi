# Orbi (Personal Brand Content OS) — Architecture & Engineering Contract

> Strategy → Create → Publish → Analyze → Improve.
> A strategic content operating system for a personal brand — **not** a social media calendar.

Every page must serve the loop: **STRATEGY → IDEAS → CREATE → PRODUCE → PUBLISH → MEASURE → LEARN → REPEAT.**
Content is never created in isolation from strategy (Brand HQ, audience, pillars, goals) or from analytics (winners, reviews, recommendations).

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** App Router, Turbopack | **Breaking changes vs. training data.** Read `node_modules/next/dist/docs/` before using an API. `middleware.ts` is now **`src/proxy.ts`** (export `proxy`). `params`/`searchParams` are **Promises** (`PageProps<"/route/[id]">`). `next lint` is gone — run `npx eslint`. |
| UI | React 19.2, TypeScript (strict), Tailwind CSS 4, **shadcn/ui (radix-nova)** in `src/components/ui` | Do not edit `src/components/ui/*` except to fix a real bug. `cn()` from `@/lib/utils`. |
| State | Zustand 5 (`src/lib/store`) | Whole workspace held in memory; adapters persist. |
| Persistence | Local adapter (browser localStorage, Starter Kit + onboarding) **or** Supabase (Postgres + RLS + Auth) | Supabase is used when `NEXT_PUBLIC_SUPABASE_URL` + key are set. |
| Charts | Recharts 3 via `src/components/charts` | Follow §6 chart rules. |
| Icons | lucide-react 1.x | **No brand icons** in lucide — use `PlatformIcon` from `@/components/common/platform-icon`. |
| Dates | date-fns 4 + `@/lib/dates` | |
| Validation | zod 4 | |
| AI | Provider abstraction in `src/lib/ai` → `/api/ai` | Anthropic (`claude-opus-5`) when `ANTHROPIC_API_KEY` is set, otherwise the honest offline template engine. |
| Tests | Vitest (`npm test`), `scripts/smoke.mjs` (headless Chrome) | |

---

## 2. Directory map

```
src/
  app/
    layout.tsx                 root: fonts, theme, toaster
    (app)/layout.tsx           DataProvider + AppShell (sidebar, top bar, dialogs, ⌘K, strategist)
    (app)/<route>/page.tsx     server component: exports `metadata`, renders ONE client view
    (auth)/login|signup        Supabase auth pages (explain local mode when unconfigured)
    onboarding/                first-run wizard (outside the shell)
    api/ai/route.ts            AI gateway (server-only keys)
  components/
    ui/                        shadcn primitives (generated)
    app-shell/                 sidebar, top bar, data gate, command palette, global dialogs
    common/                    shared building blocks (badges, selects, tables, empty states…)
    charts/                    chart kit (dataviz rules baked in)
    features/<feature>/        feature views & feature-private components
    providers/                 theme + data providers
  lib/
    types.ts                   domain model (mirrors Postgres, snake_case)
    constants.ts               labels, option lists, system knowledge (principles, flywheel…)
    data/                      defaults, relations (FK rules), adapters, seed
    store/                     zustand store, hooks, domain operations, UI store
    analytics/                 pure analytics functions (metrics, tiers, health, buffer, reports, recommendations)
    ai/                        AI tasks, prompts, providers, offline engine, client hook
    i18n/                      UI language: core (pure), useT, getUiLang, shared messages (§11)
    supabase/                  config, browser + server clients
    dates.ts  utils.ts  scoring.ts  navigation.ts
supabase/migrations/           SQL schema, RLS, triggers
docs/                          this file + setup guides
scripts/smoke.mjs              route smoke test
```

**Page pattern** — keep `page.tsx` a server component:

```tsx
// src/app/(app)/ideas/page.tsx
import type { Metadata } from "next"
import { IdeaBankView } from "@/components/features/ideas/idea-bank-view"
export const metadata: Metadata = { title: "Idea Bank" }
export default function Page() { return <IdeaBankView /> }
```

Dynamic: `export default async function Page(props: PageProps<"/studio/[id]">) { const { id } = await props.params; … }`.
Client views read `useSearchParams()` — wrap them in `<Suspense>` in the page (Next requires it for prerendering).

---

## 3. Data layer

New workspaces are created from the **Starter Kit** (`src/lib/data/starter.ts`: formats, angles, hook templates, goals, platform strategies, posting schedule, tags, settings, blank brand) and go through onboarding, which starts with Niche Discovery. The demo workspace (`src/lib/data/seed.ts`) is a **test fixture and dev-only QA seed** (`localStorage["pbos:dev-seed"]` = `demo` | `fresh`, set by the scripts' `--seed` flag) — never shown to users.

### Model
`src/lib/types.ts` defines 32 workspace tables (`TABLE_NAMES` in `src/lib/data/defaults.ts` = insert order = the order `supabase/migrations/20260910000000_init.sql` creates them). Field names are snake_case and identical to Postgres columns. Text defaults to `''`, lists to `[]`, optional FKs are `ID | null`. Server-only tables that aren't part of the workspace (`push_subscriptions`, `feedback`, `usage_events`) live in their owner's own migration; the parity test tolerates them and requires RLS.

Workspace-schema changes: edit `types.ts`, `TABLE_DEFAULTS` (and `LOCAL_DATE_DEFAULTS` for "today" dates), `relations.ts` for references, and the init migration's `create table` — `src/lib/data/schema-parity.test.ts` checks all of them against each other (types, nullability, CHECK lists, defaults, FKs, indexes, RLS, triggers) and that the demo workspace fits. Fractional numbers need `numeric` and an entry in its `FRACTIONAL_FIELDS`. `normalizeDatabase` fills new columns and tables in older local workspaces and imports.
`ISODate` = `'YYYY-MM-DD'` (local calendar day). `ISODateTime` = full ISO timestamp.

Key relationships:
- `content_ideas` → converted into one `content_items` row **per platform** (`convertIdeaToContent`).
- `content_items` = one post on one platform; `stage` is one of 13 pipeline stages; repurposed versions link via `parent_id` + `content_repurposing`.
- `content_briefs` 1:1 with items; `content_scripts` versioned per item + format (`is_current`).
- `content_metrics` = snapshots; analytics use the **latest snapshot per item**.
- Singletons: `brand_profiles[0]`, `app_settings[0]` (always exist once loaded).
- Tags are polymorphic: `tags` + `content_tags(entity_type, entity_id)`.
- `content_calendar` = recurring weekly posting slots (not dated entries — a dated entry is an item's `scheduled_at`).
- Money: `brand_deals` (status `lead → pitched → negotiating → contracted → in_progress → delivered → paid`, or `lost`; `content_item_ids` = content made for the deal; optional `campaign_id`), `income_entries` (`received` or `expected`, optional `brand_deal_id` / `content_item_id`, free-text `affiliate_program`), `rate_cards` (media-kit packages; `price: null` = ask for a quote). Every money row carries its own `currency`; `app_settings.currency` is only the default for new rows — total per currency, never add ₱ and $. Format with `formatMoney(amount, currency)` (`₱12,500`) from `@/lib/utils`.
- `app_settings` also holds the UI language (`ui_language`), `simple_mode`, the default `currency` and the `reminders_*` preferences; `brand_profiles` holds the media-kit contact fields (`contact_email`, `website`, `media_kit_bio`).

### Reading
```ts
import { useTable, useRow, useLookup, useBrand, useSettings, useDb, useEntityTags } from "@/lib/store"
const ideas = useTable("content_ideas")          // re-renders when that table changes
const idea = useRow("content_ideas", id)
const pillars = useLookup("content_pillars")    // Map<id, pillar>
const db = useDb()                              // whole workspace (analytics views)
```
Derive with `useMemo` — **never return a new array/object from a zustand selector** (infinite render loop in zustand 5).

### Writing
```ts
import { dataActions, createIdea, convertIdeaToContent, moveItemToStage, scheduleItem,
  logMetrics, logPublishedPost, saveScriptVersion, createRepurposedItem, setEntityTags,
  ensureTag, updateBrand, updateSettings } from "@/lib/store"
dataActions.insert("hooks", { text, category: "story" })   // missing fields filled from defaults
dataActions.update("content_items", id, { stage: "review" })
dataActions.remove("content_pillars", id)                  // cascades / set-null applied automatically
```
Writes are optimistic, serialized, and rolled back with an error toast if persistence fails.
Prefer the **domain operations** in `src/lib/store/domain.ts` whenever one exists — they keep side effects consistent (briefs, idea status, publish timestamps, repurposing records).

### Time
Use `new Date()` at the call site (`now`) and pass it into pure analytics functions. Week boundaries use `settings.week_starts_on`. Calendar placement uses `contentItemDate(item)` (`published_at ?? scheduled_at ?? due_date`).

---

## 4. URL conventions

- `?open=<id>` — a page opens that entity's detail sheet/dialog on load (used by ⌘K search and cross-links). Every list page **must** honor it.
- `?tab=<key>` — select a tab on tabbed pages (e.g. `/settings?tab=data`).
- Content item detail lives at **`/studio/<itemId>`**; campaign detail at **`/campaigns/<id>`**.
- Entity → page map (for links): idea `/ideas?open=`, item `/studio/<id>`, hook `/ideas/hooks?open=`, angle `/ideas/angles?open=`, persona `/audience?open=`, problem `/audience/problems?open=`, question `/audience/questions?open=`, pillar `/pillars?open=`, story `/stories?open=`, research `/research?open=`, series `/series?open=`, experiment `/experiments?open=`, campaign `/campaigns/<id>`, brand deal `/money/deals?open=`, income entry `/money/income?open=`. Rate cards are edited on `/money/media-kit`.
- Settings tabs: `general`, `performance`, `funnel`, `formats`, `tags`, `engagement`, `reminders`, `ai`, `integrations`, `data` (`settingsHref(tab)` in `features/settings/tabs.ts`).

Global actions (callable from anywhere):
```ts
import { uiActions } from "@/lib/store"
uiActions.openDialog({ type: "quick-capture", initialText })
uiActions.openDialog({ type: "new-content", ideaId, defaults })
uiActions.openDialog({ type: "log-post" })
uiActions.openDialog({ type: "add-metrics", itemId })
uiActions.openDialog({ type: "log-income", dealId, itemId })   // both optional: pre-link the entry
uiActions.askStrategist("Why are my educational posts underperforming?")
```

---

## 5. Design system

**Direction:** modern, premium, minimal, dense-but-calm — think Linear / Stripe / Notion. Dashboard-oriented.
**Avoid:** gradients, huge empty space, oversized text, cartoonish dashboards, decorative animation, overloaded cards, generic card grids everywhere.
**Logo:** `OrbiLogo` (wordmark) / `OrbiMark` (the "O") from `@/components/app-shell/orbi-logo`; favicon is `src/app/icon.svg`. The orbit's sky → indigo gradient is a fixed brand asset — the one allowed gradient and hard-coded color pair. Ring and letters use `currentColor` (set it with a text class). Inside shadcn buttons/menus, which force `[&_svg]:size-4`, size the logo with `!` (e.g. `h-[22px]!`).

- **Type:** body `text-sm` (14px); secondary `text-xs text-muted-foreground`; page titles `text-lg font-semibold` (never larger than `text-xl`); numbers in tables `num` (tabular); hero stat ≤ `text-3xl font-semibold`.
- **Spacing:** page padding `p-4 md:p-6`; section gap `gap-4`/`gap-6`; cards `rounded-lg border bg-card`; inner padding `p-4`. Max content width `max-w-[1400px]` for dashboards.
- **Tokens only.** Never hard-code hex in components. Colors:
  - Neutrals: `bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border`.
  - Accent (sparingly — active state, focus, AI affordance): `text-brand`, `bg-brand-soft`, `bg-brand`.
  - **Identity** (pillars, personas, campaigns, chart series): `var(--cat-<color>)` / `bg-cat-blue` etc. Colors come from the entity's `color` field. Use a small dot/bar/swatch next to text — **text itself never wears the data color**.
  - **Status** (reserved for meaning): `good` / `warning` / `serious` / `critical` (`text-good-fg`, `bg-good` …). Always pair with an icon **and** a label.
- **Dark mode** is first-class (class-based via next-themes). Check every view in dark mode.
- **Components:** use shadcn primitives + `@/components/common/*`. Buttons: `size="sm"` in toolbars; one primary action per region.
- **Empty states** everywhere a list can be empty: icon, one sentence explaining the value, one primary action.
- **Loading:** the workspace is loaded before views render (DataGate). Show pending state on AI actions (spinner + "Generating…"); keep previous content visible while regenerating.
- **Forms:** validate (zod or explicit checks), inline error text under fields, disable submit while invalid/pending, `Enter` submits single-line forms, `Esc` closes dialogs.
- **Destructive actions** use a confirm dialog and a toast with the result.
- **Feedback:** every mutation that isn't visually obvious gets a `toast.success(...)`.
- **Responsive:** desktop-first; tablet and mobile must work. Mobile priorities: Quick Capture, Today, analytics logging, content review. Wide tables scroll inside `overflow-x-auto`; the page body never scrolls horizontally.
- **Accessibility:** labelled inputs, `aria-label` on icon buttons, focus-visible rings, keyboard reachable menus, sufficient contrast.

## 6. Chart rules (data-viz method)

- Pick the form first: one number → stat tile; ranking → horizontal bars; change over time → line/area; part-to-whole ≤6 → stacked 100% bar (preferred) or donut.
- Categorical colors in fixed order `blue, orange, aqua, yellow, magenta, green, violet, red`; **color follows the entity** (pillar color), never its rank. Never more than 8 series — fold the rest into "Other".
- **One y-axis. No dual-axis charts.**
- Marks: lines 2px, bars ≤ 24px thick with 4px rounded data-end, 2px surface gap between stacked segments, markers ≥ 8px. Area fill ~10% opacity.
- Gridlines/axes: solid 1px hairlines (`--chart-grid`, `--chart-axis`), recessive; axis text `--chart-muted`. Thousands-comma'd, compact ticks.
- Legend always present for ≥ 2 series; direct-label selectively (never a number on every point).
- Tooltips on every interactive chart (crosshair for time series); tooltips never gate information — provide a table view for key charts.
- No fake data: every chart is computed from the workspace.

## 7. AI

- Call AI **only** through `src/lib/ai` (`runAiTask` / `useAiTask`). Never call a provider from a component. Keys stay server-side in `/api/ai`.
- Every generation includes the Brand Context (Brand HQ, audience, pillars, goals, platforms, winners, stories). Output must sound like the user — specific, personal, opinionated — never generic corporate copy.
- Show which engine produced the output (`ProviderBadge`: "Claude Opus 5" vs "Offline templates").
- The Content Score is a **quality evaluation**, never a virality prediction. Say so in the UI.
- Research → original content analyzes structure/angle/hook/psychology; it **never reproduces** the reference.
- Offline mode must still be genuinely useful and must be labelled honestly.

## 8. Integrations

Phase 4 integrations (Meta, TikTok, YouTube, LinkedIn, Google Drive, Canva, Buffer, Metricool, Later) are **adapters with honest "Not connected" states** in Settings → Integrations. Never fake a connection, sync, or import.

## 9. Terminology (use exactly)

Brand HQ · Audience HQ · Persona · Problem Bank · Question Bank · Content Pillar · Content Matrix · Content Funnel (TOFU/MOFU/BOFU) · Idea Bank · Quick Capture · Idea Generator · Hook Library · Angle Library · Content Studio · Content Brief · Script · Content Score · Pipeline · Calendar · Posting Schedule · Weekly Planner · Campaign · Series · Story Vault · Research Library · Analytics · Winner detection (Normal / Good / Winner / Breakout) · Winning Content Library · Repurposing Engine · Content Tree · Experiments · Weekly Report · Monthly Review · Content Strategist · Content Health Score · Content Buffer.

## 10. Definition of done (every feature)

1. **No dead buttons.** Every control does something real. If a capability needs an unavailable integration, render it disabled with an explanation.
2. No placeholder pages or lorem ipsum. Real computed data from the workspace.
3. Empty, loading (AI), and error states handled. Forms validated.
4. Works in light + dark, desktop + mobile (≥ 360px).
5. `npx tsc --noEmit -p .` clean for your files; `npx eslint <files>` clean; tests pass.
6. Smoke test passes: `node scripts/smoke.mjs <route> --out=/tmp/x.png` (then look at the screenshot). The dev server is already running on :3000 — never start another one and never run `next build` while others are working.
7. Every new user-facing string goes through `defineMessages` with English and Taglish (§11).

## 11. Language (English / Taglish)

- `app_settings.ui_language` (`"en"` | `"tl"`) is the language of the screens — Settings → General → App language, set from the onboarding language when setup finishes. The language content is *written* in is Brand HQ's `brand_profiles.language`; AI output follows that, not the UI.
- A feature's strings live in `messages.ts` in its folder (or `<name>-messages.ts` next to a shared component). Shared words (Save, Cancel, Delete, Loading…) are `commonMessages` in `src/lib/i18n/messages/common.ts`; Money option labels are in `src/lib/i18n/messages/money.ts`.

```ts
// messages.ts — message files import the pure core only
import { defineMessages } from "@/lib/i18n/core"
export const m = defineMessages({
  en: { title: "Brand deals", saved: "Deal saved", count_one: "{count} deal", count_other: "{count} deals" },
  tl: { title: "Brand deals", saved: "Na-save ang deal", count_one: "{count} deal", count_other: "{count} deals" },
})

// React components
import { useT } from "@/lib/i18n"
const t = useT(m)
t("title"); t.plural("count", deals.length); t("hello", { name })

// Non-React code (domain operations, helpers called from handlers)
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
toast.success(translate(m, getUiLang(), "saved"))
```

- **Imports.** Lib and store code never import `@/lib/i18n` (the React barrel pulls in hooks and the store). `@/lib/i18n/ui-lang` reads `@/lib/store/data-store` directly, so `domain.ts` may use it; `data-store.ts` itself calls `uiLangOf(get().db.app_settings[0])` from the core.
- **Checked.** A missing Taglish key is a compile error. `src/lib/i18n/messages.test.ts` loads every namespace in `**/messages.ts`, `**/*-messages.ts` and `src/lib/i18n/messages/*.ts` — same keys, same `{placeholders}`, an `_other` form for every `_one`, no empty strings. Messages outside those file names are not checked.
- **Taglish voice** — how Filipino creators write online: English nouns and product terms, Tagalog glue and verbs, short and friendly ("I-save", "Wala pang ideas", "May mali — subukan ulit"; "Cancel" stays "Cancel"). §9 terms and the module/page names in the navigation stay English. No deep or formal Tagalog ("Kanselahin"). Match `features/onboarding/copy-tl.ts`.
- **English only:** page `metadata` titles, the media-kit document (written for brands), developer-facing errors. Numbers and money use fixed locales in both languages (`formatNumber`, `formatMoney` → `₱12,500`).

## 12. Simple mode

- `app_settings.simple_mode` (new workspaces: on). The sidebar shows only the `NavItem.simple` modules — Home, Today, Ideas, Content Studio, Calendar, Analytics, Money, Settings — plus the module of the current page (`sidebarSections()` in `src/lib/navigation.ts`). The footer toggle ("Show all modules (N hidden)" / "Back to Simple mode") and Settings → General flip it.
- Simple mode only trims the sidebar: ⌘K (`ALL_PAGES`), links and URLs reach every page. Don't hide features inside pages based on it.
- Adding a module: add it to `NAV_SECTIONS`; set `simple: true` only if a new creator needs it every day.

## 13. Feedback & usage analytics (privacy rules)

Both are **online-version only** (Supabase) and live in server-only tables (`feedback`, `usage_events` in `supabase/migrations/20260914000100_beta.sql`; RLS: users insert and read only their own rows). `schema-parity.test.ts` lists them in `SERVER_ONLY_TABLES` with `push_subscriptions` (Reminders) — tolerated outside `TABLE_NAMES`, RLS required.

- **Feedback** — top-bar dialog → `POST /api/feedback` (`src/lib/telemetry/feedback.ts`: kind `bug | idea | confusing | praise`, message ≤ 4,000 chars, the page path without query string or hash, a viewport bucket). Local mode never sends anything: it says so honestly and offers "Copy feedback".
- **Usage analytics** — opt-in, **off by default, per device** (consent in this browser's localStorage `pbos:usage-analytics`, never in the workspace). `trackUsage(name, props)` from `@/lib/telemetry` is a no-op on the server, in local mode, before the workspace loads and without consent. Batches go to `POST /api/events`, which re-validates with the same rules.
- **What an event may contain:** a name from `USAGE_EVENT_NAMES` and only the whitelisted properties for that event (`EVENT_PROPS` in `src/lib/telemetry/events.ts`) — enum-like tokens, small counts, booleans. `sanitizeProps` drops everything else; `normalizePath` strips query strings and ids from paths. **Never** put titles, notes, scripts, captions, hooks, names, handles, emails, amounts, URLs or any other text a creator typed into an event — and don't widen the whitelist to allow it.
- **Key actions** (`idea_captured`, `content_created`, `post_published`, `metrics_logged`) are derived from workspace changes in `src/lib/telemetry/store-watch.ts` (ids, enums and booleans only; bulk changes such as imports or a reset are ignored), so domain operations and components need no tracking calls. Onboarding step events are the only explicit calls (`features/onboarding/wizard.tsx`).
- **Adding an event:** extend `USAGE_EVENT_NAMES` and `EVENT_PROPS` and the CHECK list on `usage_events.name` in the beta migration together, with a test.
