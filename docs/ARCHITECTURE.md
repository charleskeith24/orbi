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
    (auth)/login|signup        Supabase auth pages (explain local mode when unconfigured); /signup = Request access (waitlist)
    (admin)/admin/…            admin area (§14): own minimal shell, never loads a workspace; every page runs getAdminGate()
    privacy/                   public privacy notice (no sign-in needed); also the shared legal frame (legal-shell.tsx) and contact-email.ts
    terms/                     public Terms of Use (no sign-in needed)
    onboarding/                first-run wizard (outside the shell)
    api/ai/route.ts            AI gateway (server-only keys)
    api/admin/…                admin API (§14): every handler wrapped in withAdmin (requireAdmin)
    api/access-requests/       public waitlist endpoint (anonymous POST, same-origin, rate-limited in Postgres)
  components/
    ui/                        shadcn primitives (generated)
    app-shell/                 sidebar, top bar (New menu, account menu), module tabs, phone bottom bar, data gate, ⌘K, dialogs
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
    supabase/                  config, browser + server clients, secret-key client (admin.ts — server only)
    admin/                     admin & access (§14): contract types, form schema, gate (pages), guard (API), server/* (data access)
    circles/                   Collab Circles (§15): client contract, pure logic, in-memory fake
    profiles/                  Profiles (§16): client contract, link rules, crop math, local + fixture clients
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

New workspaces are created from the **Starter Kit** (`src/lib/data/starter.ts`: formats, angles, hook templates, goals, platform strategies, posting schedule, tags, settings, blank brand) and go through **Quick setup** (`/onboarding`, `docs/QUICK_SETUP.md`): four screens — language, name and platforms · interests and skills · who you help · pick a niche direction or write your own — then a Building screen, and `quickSetupAnswers` (`features/onboarding/quick-setup.ts`) fills in the rest (role, industry, positioning, pillars, persona, goals, posting schedule, first ideas) before the one apply path (`planOnboarding` → `applyOnboardingPlan`). Voice and audience problems are left to the Home checklist (`features/dashboard/first-run.ts`). **Your first week** (`features/dashboard/first-week.ts`, docs/FIRST_WEEK.md) then paces seven missions (capture 3 own ideas → content → script → voice + audience problem → publish → numbers → review/plan, plus a collab bonus) from `firstWeekStartKey` — row creation dates, never typed publish/schedule dates. Each mission ticks from workspace data only; setup's starter ideas (`source: "onboarding"`) never count as captured (`contentToday` excludes them too). It replaces Home's first-steps card while visible, shows one row on Today, and retires on day 15 or when hidden (`app_settings.first_week_dismissed`). Brand HQ re-runs use the **Detailed setup** (the full niche-first flow) and `/onboarding?step=niche` re-runs Niche Discovery on Quick setup screens 2–4. The demo workspace (`src/lib/data/seed.ts`) is a **test fixture and dev-only QA seed** (`localStorage["pbos:dev-seed"]` = `demo` | `fresh`, set by the scripts' `--seed` flag) — never shown to users.

### Model
`src/lib/types.ts` defines 33 workspace tables (`TABLE_NAMES` in `src/lib/data/defaults.ts` = insert order = the order `supabase/migrations/20260910000000_init.sql` creates them). Field names are snake_case and identical to Postgres columns. Text defaults to `''`, lists to `[]`, optional FKs are `ID | null`. Server-only tables that aren't part of the workspace (`push_subscriptions`, `feedback`, `usage_events`, and the admin tables in §14) live in their owner's own migration; the parity test tolerates them and requires RLS.

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
- Collabs: `collabs` = one collaboration with another creator (status `idea → reached_out → agreed → scheduled → published → reviewed`, or `declined`; `type` duet/stitch, guesting, joint Live, shoutout swap, giveaway, co-created, group brand deal, other). Partner fields are free text (no link to another account); `content_item_ids` = the creator's posts made for it (`array_remove`, like `brand_deals`); optional `pillar_id` / `goal_id` / `campaign_id` / `brand_deal_id` (set null). Results come only from the latest snapshot of linked posts (`collabResults`); **Collab lift** (`collabLift` in `src/lib/analytics/collabs.ts`) compares collab vs solo posts on the same platform over the last 90 days (medians; needs ≥ 3 collab and ≥ 5 solo posts with analytics, otherwise it says what's missing). Writes go through `features/collabs/collab-actions.ts`; `uiActions.openDialog({ type: "new-content", defaults, collabId })` links the created items to a collab.
- `app_settings` also holds the UI language (`ui_language`), `simple_mode`, the default `currency`, the `reminders_*` preferences and `first_week_dismissed`; `brand_profiles` holds the media-kit contact fields (`contact_email`, `website`, `media_kit_bio`).

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
- **Sub-pages are tabs, not sidebar links.** A module's sub-pages (`NavItem.children` in `src/lib/navigation.ts`) keep their own routes and render as route-linked tabs under the top bar (`ModuleTabs` → `HubTabs`, e.g. Ideas: Idea Bank · Generator · Hooks · Angles). Each child has a full `title` (⌘K, breadcrumb) and a short `tab` label. The sidebar has one link per module, active on every sub-route. `?open=`, ⌘K, bookmarks and links keep working because tabs are plain links. Adding a sub-page = adding a child; nothing else.
- Content item detail lives at **`/studio/<itemId>`**; campaign detail at **`/campaigns/<id>`**.
- Entity → page map (for links): idea `/ideas?open=`, item `/studio/<id>`, hook `/ideas/hooks?open=`, angle `/ideas/angles?open=`, persona `/audience?open=`, problem `/audience/problems?open=`, question `/audience/questions?open=`, pillar `/pillars?open=`, story `/stories?open=`, research `/research?open=`, series `/series?open=`, experiment `/experiments?open=`, campaign `/campaigns/<id>`, brand deal `/money/deals?open=`, income entry `/money/income?open=`, collab `/collabs?open=` (`/collabs?new=1&campaign=<id>` or `&deal=<id>` opens the form pre-linked; `/collabs?ideas=1` opens Collab ideas). Rate cards are edited on `/money/media-kit`.
- Settings tabs: `profile`, `general`, `performance`, `funnel`, `formats`, `tags`, `engagement`, `reminders`, `ai`, `integrations`, `data` (`settingsHref(tab)` in `features/settings/tabs.ts`). `/settings` with no tab still opens `general`; the account menu's **Profile** item opens `/settings?tab=profile`.
- Admin area (Supabase mode, admins only, §14): `/admin` (Overview), `/admin/requests`, `/admin/users`, `/admin/feedback`, `/admin/audit`, `/admin/security` (2-step verification). Never in `NAV_SECTIONS`; the entry is the account menu and ⌘K, for admins only.
- Collab Circles (§15, online version; local mode shows a notice): `/circles` (list), `/circles/<id>` (a circle; `#asks` jumps to Collab asks), `/circles/join/<code>` (invite link; signed-out visitors go through `/login?next=`).
- Public pages (no sign-in in Supabase mode): `/login`, `/signup` (Request access), `/privacy`, `/terms` (`PUBLIC_PAGES` in `features/auth/auth-paths.ts`). Both legal pages show `NEXT_PUBLIC_CONTACT_EMAIL` when it's set (`src/app/privacy/contact-email.ts`) and say honestly when it isn't; `?preview=contact` fakes one in development only.

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
The top bar's **＋ New** menu (and the phone bar's ＋ sheet) is the one place for these: Quick Capture, New content, Log a post, Add analytics and New collab (`/collabs?new=1`) — `useNewActions()` in `app-shell/new-menu.tsx`. Pages don't repeat Capture / New content buttons.

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

### Calm UI (declutter rules — brief and measurements in `docs/CALM_UI.md`)

Numbers, short labels and one obvious next action; explanations exist but wait until they're asked for. Premium comes from restraint, hierarchy, spacing and consistency, not decoration.

1. **Word budget.** ≤ ~120 words above the fold on desktop, ≤ ~80 on a 390px phone. Measure with `node scripts/text-budget.mjs "--routes=/x"` (add `--lang=tl --width=390 --height=844` for phones). It reports `above the fold` (every text node that starts above the fold, including Kanban columns scrolled off to the side) and `on screen` (only what is visible). Board and table data count; cut the chrome around them.
2. **Page header:** a title and at most one subtitle of ≤ 8 words, or none. The page's explanation goes in `PageHeader info` (an ⓘ). No icon tile on new screens.
3. **Section header:** a title of ≤ 4 words, an optional count, an optional ⓘ and one optional action — `SectionHeader`, `PageSection` or `SectionCard` with `count`/`info`. **No description line.**
4. **Numbers over sentences.** A stat is a number, a short label and one status chip. An insight is one line with a "Why?" `Disclosure`. Never a paragraph on a card.
5. **Progressive disclosure.** Details go in `Disclosure` ("Details"), sheets or tabs. Beginner explanations live in **empty states**, not next to data that already exists.
6. **One primary action per region.** Capture and New content live once, in the top bar's New menu.
7. **Fewer boxes.** Separate sections with spacing and hairlines; cards are for objects (a post, a deal, a stat), not for every paragraph.
8. **Field help** only for format or validation ("JPG, PNG or WebP, up to 5 MB", a counter). Everything else: a good placeholder or an ⓘ.
9. **Status** still pairs an icon with a label — one or two words.
10. **Both languages get shorter;** Taglish is often longer, so cut it at least as much. Keep §9 terms. Remove unused keys.
11. **No information that matters is lost:** every removed sentence becomes an ⓘ or a Disclosure, moves to an empty state or its natural page, or was redundant.

**Building blocks** (`@/components/common`, on shadcn primitives):
- `PageHeader({ title, description?, info?, infoTitle?, actions?, children? })` — `description` is the ≤ 8-word subtitle; `children` is a second row (filters).
- `SectionHeader({ title, count?, info?, infoTitle?, action?, as?, id? })`; `PageSection` and `SectionCard` also take `count` and `info` (their `description` stays for older screens — move it to `info`).
- `InfoHint({ children, title?, label?, side?, align? })` — an ⓘ button (Tab, Enter/Space, tap; ~36px touch target) opening a popover; `title` bolds the first line and names the button "About {title}".
- `Disclosure({ label?, meta?, variant: "inline" | "section", defaultOpen?, open?, onOpenChange?, storageKey? })` — `inline` is a small "Details ›" toggle, `section` a full-width divider ("More on your week ────"). `aria-expanded`/`aria-controls` via Radix; closed content isn't rendered; `storageKey` remembers it per device.
- `HubTabs({ tabs: { title, href }[], label? })` + `activeHubTab()` — route-linked tabs (`aria-current="page"`), sideways-scrolling on phones. The shell renders them for every module with sub-pages; use it directly only for a page-level set of routes.
- `StatTile size="sm"` — the compact tile.
- Shell: `NewMenu`/`useNewActions`, `UserMenu` (account avatar: Profile, Settings, Theme, Feedback, Install), `BottomTabBar`, `ModuleTabs`, the one-line `WorkspaceBanner`.

**Shell.** Top bar: location, search (⌘K), **＋ New**, Content Strategist, account avatar. Sidebar: Home and Today; **Plan · Create · Grow · Measure** (group headers fold, remembered per device in `pbos:sidebar:collapsed`; a folded group still shows the module you're on; the icon rail lists everything); Money and Settings. Phones (below `md`): the sidebar trigger and New give way to a bottom bar — Home · Today · ＋ · Calendar · More (＋ = the New menu as a sheet, More = every module as a sheet). The bar sets `--bottom-bar` (height + safe area) on phones: the shell pads page content with it, and anything sticky to the bottom uses `bottom-[calc(var(--bottom-bar,0px)+…)]` (save bars) or `bottom-[var(--bottom-bar,0px)]`; toasts sit above it too.

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

Brand HQ · Audience HQ · Persona · Problem Bank · Question Bank · Content Pillar · Content Matrix · Content Funnel (TOFU/MOFU/BOFU) · Idea Bank · Quick Capture · Idea Generator · Hook Library · Angle Library · Content Studio · Content Brief · Script · Content Score · Pipeline · Calendar · Posting Schedule · Weekly Planner · Campaign · Series · Story Vault · Research Library · Analytics · Winner detection (Normal / Good / Winner / Breakout) · Winning Content Library · Repurposing Engine · Content Tree · Experiments · Weekly Report · Monthly Review · Content Strategist · Content Health Score · Content Buffer · Collab tracker · Collab lift · Collab Circles · Your first week.

## 10. Definition of done (every feature)

1. **No dead buttons.** Every control does something real. If a capability needs an unavailable integration, render it disabled with an explanation.
2. No placeholder pages or lorem ipsum. Real computed data from the workspace.
3. Empty, loading (AI), and error states handled. Forms validated.
4. Works in light + dark, desktop + mobile (≥ 360px).
5. `npx tsc --noEmit -p .` clean for your files; `npx eslint <files>` clean; tests pass.
6. Smoke test passes: `node scripts/smoke.mjs <route> --out=/tmp/x.png` (then look at the screenshot). The dev server is already running on :3000 — never start another one and never run `next build` while others are working.
7. Every new user-facing string goes through `defineMessages` with English and Taglish (§11).

## 11. Language (English / Taglish)

- `app_settings.ui_language` (`"en"` | `"tl"`) is the language of the screens — Settings → General → App language. During a first run it follows the language toggle on the Quick setup screens, so shared controls switch too. The language content is *written* in is Brand HQ's `brand_profiles.language`; AI output follows that, not the UI.
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
- With the Calm UI groups: Simple mode leaves Home and Today, **Create** (Ideas, Content Studio, Calendar), **Measure** (Analytics), then Money and Settings; groups with nothing left disappear. A folded group and Simple mode both keep the current page's module visible. The phone **More** sheet follows the same rules and has the same toggle. Module tabs (§4) always show every sub-page — Simple mode never trims tabs.
- Adding a module: add it to `NAV_SECTIONS`; set `simple: true` only if a new creator needs it every day.

## 13. Feedback & usage analytics (privacy rules)

Both are **online-version only** (Supabase) and live in server-only tables (`feedback`, `usage_events` in `supabase/migrations/20260914000100_beta.sql`; RLS: users insert and read only their own rows; admins with 2-step verification read every row, §14). `schema-parity.test.ts` lists them in `SERVER_ONLY_TABLES` with `push_subscriptions` (Reminders) and the admin tables (§14) — tolerated outside `TABLE_NAMES`, RLS required.

- **Feedback** — account menu (top-bar avatar) → **Send feedback** dialog → `POST /api/feedback` (`src/lib/telemetry/feedback.ts`: kind `bug | idea | confusing | praise`, message ≤ 4,000 chars, the page path without query string or hash, a viewport bucket). Local mode never sends anything: it says so honestly and offers "Copy feedback".
- **Usage analytics** — opt-in, **off by default, per device** (consent in this browser's localStorage `pbos:usage-analytics`, never in the workspace). `trackUsage(name, props)` from `@/lib/telemetry` is a no-op on the server, in local mode, before the workspace loads and without consent. Batches go to `POST /api/events`, which re-validates with the same rules.
- **What an event may contain:** a name from `USAGE_EVENT_NAMES` and only the whitelisted properties for that event (`EVENT_PROPS` in `src/lib/telemetry/events.ts`) — enum-like tokens, small counts, booleans. `sanitizeProps` drops everything else; `normalizePath` strips query strings and ids from paths. **Never** put titles, notes, scripts, captions, hooks, names, handles, emails, amounts, URLs or any other text a creator typed into an event — and don't widen the whitelist to allow it.
- **Key actions** (`idea_captured`, `content_created`, `post_published`, `metrics_logged`) are derived from workspace changes in `src/lib/telemetry/store-watch.ts` (ids, enums and booleans only; bulk changes such as imports or a reset are ignored), so domain operations and components need no tracking calls. Onboarding step events are the only explicit calls (`features/onboarding/wizard.tsx`).
- **Adding an event:** extend `USAGE_EVENT_NAMES` and `EVENT_PROPS` and the CHECK list on `usage_events.name` in the beta migration together, with a test.

## 14. Admin & access

The online version has a platform admin (the owner, plus anyone they promote) and a waitlist: nobody gets an account without an admin's approval. The owner's guide is `docs/ADMIN.md`; the schema is `supabase/migrations/20260918000000_admin.sql`. **Local mode is unchanged**: there are no accounts, `/admin` shows an honest notice, every admin and waitlist route answers `501 not_configured`, and admin links never appear.

- **The admin never sees a creator's content.** Account metadata and **counts** only (`admin_user_stats()` and `admin_onboarding_funnel()` return numbers). Never select titles or text from workspace tables in admin code. Feedback is readable in full because it was written *to* the team. Of a profile (§16) admins get the **name and photo** only: `AdminUserRow.photo_url` is a 1-hour signed URL made with the secret key; never select `headline`, `location`, `links` or `show_niche` in admin code.
- **The role can't be self-granted.** It lives in `admin_users`, which has no grants or policies for `authenticated`. It is written only by the server with the secret key, or by the SQL line in ADMIN.md for the first admin. Never put a role column on `public.users` (users update their own row). `public.is_admin()` is `security definer`, `stable`, `set search_path = ''`, and executable by `authenticated`; the UI may call it to decide whether to show the Admin entry.
- **Contract.** `src/lib/admin/types.ts` holds the route table, the error codes, the `AdminApi` client interface and `AdminGate`. `access-request.ts` is the form schema, shared by the form and the route. The UI's HTTP client follows the route table exactly; add to the contract, never rename.
- **Pages.** Every `/admin` page calls `getAdminGate()` (`src/lib/admin/gate.ts`):
  - `local` → the notice;
  - `signed_out` → `/login?next=`;
  - `not_admin` → 404, so the area isn't revealed;
  - `needs_mfa` → `/admin/security`, to enroll when `!has_factor`, otherwise to take the challenge;
  - `ok` → the page.
- **API.** Every `/api/admin/*` handler is `withAdmin(...)` (`src/lib/admin/guard.ts`). `requireAdmin` runs these checks in order:
  1. local mode → `501 not_configured`;
  2. a mutation (anything but GET/HEAD) without a same-origin `Origin` → `403 bad_origin`;
  3. no session from `auth.getUser()`, never cookies alone → `401 unauthorized`;
  4. not `is_admin()`, or the check failed → `404 not_found`;
  5. session not AAL2 → `403 mfa_required`;
  6. no `SUPABASE_SECRET_KEY` → `501 not_configured`.

  Handlers get `{ admin, supabase, service, origin, now }`: `supabase` is the admin's session, where RLS applies; `service` is the secret-key client (`src/lib/supabase/admin.ts`, server only). Every response is `Cache-Control: no-store`. Failures are `{ error, message }`; throw `AdminError(code, message)`, and anything else becomes `500 server_error` with details only in the server log.
- **Guard rails.**
  - An admin can't disable, delete or un-admin themselves → `409 self_action`.
  - The last admin can't be removed → `409 last_admin`. `revoke_admin()` decides this in one serialized transaction.
  - Deleting an account requires the body to repeat its email. It deletes the account's profile photos through the Storage API first (files can't cascade from SQL); if Storage fails, nothing is deleted (`500`).
  - `DELETE /api/admin/users/:id/photo` removes a profile photo (moderation): the files in the account's `avatars` folder, then `public.users.avatar_url`. No photo → unchanged, no audit row.
- **Audit.** Every successful change writes **one** `admin_audit_log` row with `writeAudit()`: the action from `ADMIN_AUDIT_ACTIONS` (the CHECK list is kept in sync — the latest definition is in `20260920000000_profiles.sql`, which added `profile_photo_removed`), the target id and email, and small content-free `details` such as `{ from: "active", to: "disabled" }`. The log is append-only: no update or delete grant, not even for the secret key.
- **Reads that need 2-step verification.** Admins read the audit log, `feedback` and `usage_events` through RLS policies that require `is_admin()` **and** `auth.jwt() ->> 'aal' = 'aal2'`. A stolen password alone can't read them through the Data API.
- **Waitlist.** `POST /api/access-requests` is the only anonymous API call the proxy lets through (`isPublicApiCall` in `features/auth/auth-paths.ts`); `/privacy` and `/terms` are the only public pages besides the auth pages. The route:
  - requires a same-origin `Origin`;
  - validates with the shared zod schema, answering `400 invalid` with a `fields` map;
  - accepts a filled honeypot silently, without storing it;
  - stores the request through `public.submit_access_request()` with the secret key. That function runs in one serialized transaction: `403 closed` while `platform_settings.access_open` is off, `429 rate_limited` after 30 new requests in an hour for everyone together, and nothing stored for an email that already has an account or a pending request.

  New, repeat and existing emails all get the same `201 { ok: true }`. No IP address is read or stored. The `/signup` server component reads `getAccessRequestState()` (`src/lib/admin/server/settings.ts`).
- **Emails.** Approve and invite use `auth.admin.inviteUserByEmail`, password resets use `resetPasswordForEmail`, and both land on `/set-password` through the token-hash email templates (DEPLOY.md step 5). Reject sends no email. Disable is a long `ban_duration`, and enable is `"none"`.
- **Tests.**
  - `src/lib/admin/admin-migration.pglite.test.ts`: the SQL on Postgres.
  - `src/lib/admin/guard.test.ts`: every gate and guard branch.
  - `src/app/api/admin/routes.test.ts` and `src/app/api/access-requests/route.test.ts`: every handler and error code, against the in-memory fake in `src/lib/admin/testing/fake-supabase.ts`.

## 15. Collab Circles

Small invite-only groups of creators (3–8) who keep each other posting and find collab partners: a weekly check-in, streaks and collab asks (`docs/CIRCLES.md`). **Online version only**; local mode shows an honest notice (the `/admin` pattern). No chat, no public directory, no engagement pods.

- **Privacy is the product.**
  - Nothing leaves a workspace automatically. A check-in holds only what the member submits: a number of posts (pre-filled from their own workspace by `checkinDraft`, editable) and an optional note ≤ 280.
  - Contacts (`circle_contacts`) have **no grants and no policies**. They're written only by `set_circle_contact()` and read only by `circle_contact(circle, other)`, which answers for yourself or for a member linked to you by an **accepted** interest on an ask in that circle (either direction).
  - Admins get nothing: no admin policies, and `service_role` has no grants on the circle tables.
  - Leaving, being removed or deleting the account removes the member's check-ins, asks, interests and contact in that circle (composite foreign keys to `circle_members`).
- **Schema.** `supabase/migrations/20260919000000_circles.sql`: `circles`, `circle_members`, `circle_contacts`, `circle_checkins`, `circle_asks`, `circle_ask_interests`. These are server-only tables (`SERVER_ONLY_TABLES`), not workspace tables, so the Collab tracker's data model is unchanged.
  - Members read their circles' rows through RLS (`is_circle_member()`), but never `circles.invite_code_hash` (column grant — always list columns, never `select *`).
  - Members write their own check-ins (this or last week only), asks (edit/close their own), interests (only in others' open asks; withdraw while pending) and their own `display_name`.
  - Everything else goes through `security definer` functions that check `auth.uid()`: `create_circle`, `preview_invite`, `join_circle` (8 members max, 10 circles per person), `rotate_invite` / `remove_member` (owner only; never the owner), `leave_circle` (the longest-standing member takes over; the last one deletes the circle — a trigger does the same when an account is deleted), `accept_interest` (the ask's author only).
  - Errors are raised as short codes (`circle_full`, `not_owner`, …) and mapped by `toCircleError`.
- **Profiles in circles** (§16). Members, check-ins and asks show each member's profile photo (`MemberAvatar` → `PersonAvatar`, falling back to initials of the circle name); clicking a member in the Members list opens their profile card (`ProfilePopover`: headline, location, links, and the niche only if they opted in). Members see each other's profiles because `can_see_profile()` counts a shared circle as "connected". The per-circle `display_name` stays; "Your name in this circle" defaults to the profile's display name, then Brand HQ's name.
- **Invite codes.** 43 base64url characters (244 random bits), generated by the database; only the SHA-256 is stored. An owner's browser remembers the link it last created or rotated (`circle-memory.ts`, localStorage); elsewhere the owner makes a new link.
- **Client.** `CirclesApi` (`src/lib/circles/types.ts`) has two implementations:
  - `features/circles/api/supabase-api.ts`: the browser Supabase client, with RLS and RPCs only. There are no API routes and no secret key.
  - `src/lib/circles/fixture-api.ts`: an in-memory fake with the same rules, used for tests and the dev fixture.
  - `useCirclesClient()` / `<CirclesFrame>` pick the right one and render the local, signed-out and loading states.
- **Pure logic** (`src/lib/circles`), with tests:
  - `circleStreak`: consecutive weeks, ending with the current or previous week, with a check-in of ≥ 1 post. 6–8-day gaps count as consecutive (Monday ↔ Sunday weeks).
  - `circleWeek`: this week's check-ins, sorted by name, never by score.
  - `checkinDraft`: the same count as the weekly posting goal.
  - `collabFromAsk`: "Add to Collabs" creates an Agreed collab in the author's own workspace with a 3-day follow-up.
- **Dev fixture.** `localStorage["pbos:dev-circles"] = "fixture"`, set by the scripts' `--circles` flag, loads sample circles on the local dev server. `dev-fixture.ts` checks `NODE_ENV` and never loads the fixture in production, and creating the fake in production throws.
- **Tests.**
  - `src/lib/circles/circles-migration.pglite.test.ts`: every RLS rule and function on Postgres.
  - `features/circles/api/supabase-api.pglite.test.ts`: the browser client end to end through a PostgREST-like stand-in (`src/lib/circles/testing/pglite-client.ts`).

## 16. Profiles

Every account has a personal profile — the **person** using Orbi, not the brand (Brand HQ holds the brand; the difference matters for team workspaces, where a VA signs in as themselves). Brief: `docs/PROFILES.md`. Fields: photo, display name (≤ 80), one-line headline (≤ 160), location (≤ 80), up to 6 links (`{ platform: PlatformId | "website", value }` — a handle without "@" or an http(s) URL) and the opt-in **"Show my niche and main platform"** (read from Brand HQ at read time, never copied).

- **Visibility: connected people only.** Yourself and members of a circle you're in see the whole profile (team members will too). Admins see the name and photo only. No public profile page. **Email is never part of a profile** — no new path may expose it.
- **Schema.** `supabase/migrations/20260920000000_profiles.sql` extends `public.users` (no new table): `full_name` is the display name, `avatar_url` holds a **storage path** (`<user id>/<random>.webp|jpg`, never a URL; CHECKed), plus `headline`, `location`, `links` (jsonb, `profile_links_valid()`), `show_niche`.
  - Only the owner selects `public.users` (it holds the email); signed-in users may update only the profile columns (column grant — never `email` or `id`).
  - The sign-up triggers clean the display name and never copy a photo from Auth metadata; a name the person set is never overwritten from metadata.
- **Reading other people.** `get_profiles(ids uuid[])` — `security definer`, `set search_path = ''`, at most 200 ids — returns `id, display_name, avatar_path, headline, location, links`, plus `niche` and `main_platform` only when `show_niche`, for the ids that pass `can_see_profile()`; others are simply missing. Never the email.
  - `can_see_profile(uuid)` is **the one place** the "connected" rule lives (yourself, or a shared circle). Team workspaces add "shares a workspace" there, and both `get_profiles()` and the photo policy follow.
- **Photos.** A **private** Storage bucket `avatars` (1 MB, `image/webp` + `image/jpeg`), created by the migration. Policies on `storage.objects`: insert/update/delete only inside your own folder with the random-name pattern; select for yourself and connected people (`can_see_profile()` on the folder).
  - Upload in the browser (`features/profile/photo-encode.ts`): JPG/PNG/WebP ≤ 5 MB (HEIC only where the browser decodes it, otherwise an honest message) → square crop with zoom/pan (`src/lib/profiles/crop.ts`) → 512×512 WebP (JPEG fallback) through a canvas, which **strips EXIF, GPS included** ("We remove hidden location data from your photo").
  - A new random path per upload; the old file (and any leftover) is deleted after the row points at the new one.
  - Shown through **signed URLs** (1 hour), cached per session and re-signed 5 minutes before expiry (`usePhotoUrl`). Admins get them server-side with the secret key.
  - Deleting an account: Storage can't cascade from SQL, so the admin delete route removes the files first; dashboard deletions leave a folder only the secret key can read — ADMIN.md has the cleanup query.
- **Client.** `ProfilesApi` (`src/lib/profiles/types.ts`) has three implementations: `features/profile/api/supabase-api.ts` (RLS, `get_profiles()`, Storage; no API routes), `src/lib/profiles/local-api.ts` (local mode) and `src/lib/profiles/fixture-api.ts` (dev only). `<ProfilesSync />` (in the app shell) picks one when the workspace loads; `features/profile/profile-store.ts` holds your profile and the caches.
  - **Shared pieces for other features** (team workspaces reuse them): `useProfiles(ids)` / `useProfile(id)` (batched `get_profiles()`; `null` = not visible), `usePhotoUrl(path)`, `<ProfileAvatar>` / `<PersonAvatar userId name>` and `<ProfilePopover>` / `<ProfileCardBody>`.
- **Where it shows.** Settings → Profile (`/settings?tab=profile`: the editor beside a compact Preview whose ⓘ says who can see it), the account menu in the top bar (photo + display name; online it falls back to the sign-up name or the email's local part), circles (§15), Admin → Users (§14), and — per device, opt-in — the media kit header ("Use my profile photo in the media kit", `localStorage["pbos:media-kit-photo"]`).
- **Local mode.** No accounts: the profile is kept on this device only (`localStorage["pbos:local-profile"]`, the photo as a ≤ 60 KB 256×256 data URL, re-encoded the same way). The tab says so in one line ("Saved on this device only", with the online difference behind its ⓘ), and the account menu shows it.
- **Dev fixture.** The Circles fixture (`--circles`) also gives its sample members sample profiles and illustrated sample photos; your own profile stays the local one. Same production guard as §15. The admin fixture (`--admin`) carries sample `photo_url`s.
- **Tests.**
  - `src/lib/profiles/profiles-migration.pglite.test.ts`: every rule above on Postgres, with a stub of the `storage` schema (`src/lib/supabase/testing/pglite.ts`).
  - `features/profile/api/supabase-api.pglite.test.ts`: the browser client end to end, Storage through `src/lib/profiles/testing/pglite-storage.ts`.
  - `src/lib/profiles/*.test.ts`: link rules (and their agreement with the SQL CHECK), draft validation, crop math, photo paths, the local and fixture clients.
  - `src/app/api/admin/routes.test.ts`: photo removal, its audit row, and photo cleanup on account deletion.
