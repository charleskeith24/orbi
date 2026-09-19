# Calm UI — declutter pass (build brief)

**Status:** approved by the user on 2026-09-20.

**The problem, in the user's words:** "the UI has too much text — make it easier to navigate but still premium."

**Measured with `node scripts/text-budget.mjs`, demo seed, before any change:**

| Screen | Words above the fold (desktop EN) | Page height | Phone (TL, 390px) |
|---|---|---|---|
| `/pipeline` | 814 | 900px | 115 words |
| `/` Home | 413 | 2,490px | 188 words, **5,549px tall** |
| `/settings?tab=profile` | 273 | 1,109px | 148 words |
| `/ideas` | ~350 | 3,439px | — |
| `/strategy` | ~300 | 4,472px | — |

The sidebar has about 51 links.

**Target feel:** Linear, Stripe and Notion. Numbers, short labels and one obvious next action. Explanations exist but wait until they're asked for. Premium comes from restraint, hierarchy, spacing and consistency, not decoration.

## Rules (they become ARCHITECTURE §5 "Calm UI")
1. **Word budget.** At most ~120 words above the fold on desktop and ~80 on a 390px phone, measured by `text-budget.mjs` (the board and table *data* on Pipeline and Ideas count; aim to cut the chrome around them).
2. **Page header.** A title, plus at most one short subtitle (≤ 8 words) or none at all. Page-level explanations move into an **ⓘ InfoHint** next to the title.
3. **Section header.** A title of ≤ 4 words, an optional count, and an optional single action. **No description line.** When a section needs one, use an InfoHint.
4. **Numbers over sentences.** A stat is a number, a short label and a trend chip. An insight is one line with a "Why?" disclosure. Never a paragraph on a card.
5. **Progressive disclosure.** Details go in `Disclosure` ("Details"/"Detalye"), sheets or tabs. Explanations for beginners live in **empty states**, not beside data that already exists.
6. **One primary action per screen region.** Remove duplicate buttons; for example, Capture and New content should appear once in the top bar, not again on each page.
7. **Fewer boxes.**
   - Prefer sections separated by spacing and hairline dividers over nested bordered cards.
   - Use cards for things that are objects (a post, a deal), not for every paragraph.
8. **Field help.** Show helper text under a field only for format or validation. Otherwise use a good placeholder or an InfoHint.
9. **Status.** Status still pairs an icon with a label (§5), but the label is one or two words.
10. **Both languages get shorter.** Taglish is often longer, so cut it at least as much. Keep §9 terms. Remove keys that are no longer used.
11. **No information loss that matters.** Every removed sentence either becomes an InfoHint or Disclosure, moves to an empty state, or was redundant. List any you drop entirely.

## Navigation (user approved)
**Sidebar: five groups plus Money and Settings. Sub-pages become in-page tabs, not nested sidebar links.**

| Group | Modules (one sidebar link each) | Their tabs |
|---|---|---|
| — | Home, Today | — |
| **Plan** | Brand HQ (`/strategy`), Audience, Pillars | Brand HQ · Goals · Platforms · System / Personas · Problems · Questions / Pillars · Matrix · Funnel |
| **Create** | Ideas, Content Studio, Pipeline, Calendar | Idea Bank · Generator · Hooks · Angles / — / — / Calendar · Weekly Planner · Posting Schedule |
| **Grow** | Collabs, Circles, Campaigns, Series, Story Vault, Research | — / — / — / — / Vault · Experience → Content / Library · Inspiration → Original |
| **Measure** | Analytics, Winners, Reports, Experiments | Overview · Posts / — / Weekly · Monthly / — |
| — | Money, Settings | Overview · Deals · Income · Media Kit / existing tabs |

- URLs don't change. Tabs are links (`HubTabs`), so `?open=`, ⌘K, bookmarks and every existing link keep working.
- Simple mode still trims the sidebar (§12). The Simple set stays Home, Today, Ideas, Content Studio, Calendar, Analytics, Money and Settings.
- Group headers are collapsible, and the open state is remembered per device.
- **Top bar**, calmer:
  - page title or breadcrumb;
  - search (⌘K);
  - one **"＋ New"** button with a menu: Quick Capture, New content, Log a post, Add analytics, New collab;
  - the Content Strategist button;
  - the account avatar.
  - Theme and Feedback move into the account menu.
  - The workspace backup banner becomes a compact single line.
- **Phone:** a **bottom tab bar** below the `md` breakpoint.
  - Tabs: **Home · Today · ＋ · Calendar · More**.
    - "＋" opens the same New menu as a bottom sheet.
    - "More" opens the full navigation sheet.
  - Respect `env(safe-area-inset-bottom)`.
  - Pages get bottom padding so nothing hides behind the bar.
  - The PWA's `start_url` (`/today`) still lands correctly.
  - The desktop layout is unchanged except for the calmer sidebar and top bar.

## Shared building blocks
Put these in `src/components/common/`, reusing shadcn primitives from `src/components/ui`, which stay unedited:
- `PageHeader`: title, optional short subtitle, optional `info` (InfoHint content) and actions.
- `SectionHeader`: title, optional count, optional `info`, optional single action.
- `InfoHint`: an ⓘ button opening a popover. It's keyboard reachable, has an `aria-label` and works on touch (tap). Its content is the explanation that used to sit on the page.
- `Disclosure`: an accessible "Details" toggle.
- `HubTabs`: route-linked tabs for a module's sub-pages. They are scrollable on phones.
- A compact `StatTile` variant if needed.
- `BottomTabBar` and `NewMenu`, in the app shell.

Update existing common components (`SectionCard`, page headers, etc.) where that's the cleaner path. Keep their APIs backward-compatible, because the rollout agents will migrate screens gradually.

## Pilot scope (this brief)
1. Navigation: sidebar groups, top bar, the bottom tab bar on phones, `HubTabs` on every module with sub-pages.
2. The shared building blocks.
3. Three pilot screens rewritten to the rules:
   - **Home (`/`).**
     - A **"Your focus today"** hero with one next action (from the existing recommendations or the first-week mission), three KPI tiles, and the week strip.
     - Everything else collapses under "More on your week" or moves to its natural page, e.g. health detail → Analytics. Nothing may vanish without a path to it.
     - Target on phone: ≤ 2 screens tall.
   - **Pipeline (`/pipeline`).** Keep the board. Cut the chrome: summary text, column descriptions and hint lines. Buffer detail moves into an InfoHint or Disclosure.
   - **Settings → Profile.** The form plus a compact preview. The visibility explainer becomes an InfoHint, and the local-mode note becomes one line.
4. Update `docs/ARCHITECTURE.md`: §5 gets the "Calm UI" rules and the building blocks, §12 the Simple-mode interplay, and §4 gets a note that sub-pages are tabs.

**Out of scope for the pilot:** rewriting the other screens. Rollout agents will do that after the user approves the pilot. Other screens must still look correct with the new shell.

## Definition of done
- **Code:**
  - `npx tsc --noEmit -p .` is clean.
  - eslint is clean on changed files.
  - `npx vitest run` passes in full; update tests whose copy changed.
- **Before/after numbers.** Run `node scripts/text-budget.mjs "--routes=/,/pipeline,/settings?tab=profile"` in English desktop and with `--lang=tl --width=390 --height=844`, and report both tables next to the "before" numbers above.
  - Target: at least **50% fewer words above the fold** on each pilot screen.
  - Home on phone should be ≤ 2 screens tall.
- **Screenshots**, in `…/scratchpad/ui/after-*`, using the same names as the `before-*` files already there:
  - the 3 pilot screens, EN desktop light and TL 390px dark;
  - the new sidebar, expanded and collapsed groups;
  - the top bar New menu;
  - the phone bottom bar with the ＋ sheet and the More sheet;
  - `HubTabs` on Ideas and on Calendar;
  - one untouched screen (e.g. `/analytics`), to show it still looks right in the new shell.

  Look at every one, compare with the before shots, and fix anything that regressed.
- **Route and click audits:**
  - `node scripts/route-audit.mjs --seed=demo --lang=tl --modes=light,mobile` covers all routes with 0 failures.
  - `node scripts/click-audit.mjs /` and `node scripts/click-audit.mjs /pipeline` find no dead buttons.
- **Flows:** `e2e-flow.mjs` and `onboarding-flow.mjs` pass. If copy they depend on changed, update the scripts' selectors, not the behaviour.
- **Commit:** nothing committed.

## Pilot result (2026-09-20, not committed)

**Built:** the navigation (grouped sidebar, `ModuleTabs`, top bar with ＋ New and the account avatar, phone bottom bar), the building blocks (ARCHITECTURE §5 "Calm UI" lists their APIs) and the three pilot screens. `text-budget.mjs` now also prints **on screen** words (inside the viewport on both axes, not clipped by a scroll container) next to the original "above the fold" count.

| Screen | Desktop EN above the fold | Phone TL 390px | Height |
|---|---|---|---|
| `/` Home | 413 → **98** (−76%) | 188 → **87** (−54%) | desktop 2,490 → 900px · phone 5,549 → **859px** (1.02 screens) |
| `/settings?tab=profile` | 273 → **83** (−70%) | 148 → **70** (−53%) | desktop 1,109 → 900px |
| `/pipeline` | 814 → **709** (−13%); on screen 327 → **258** (−21%) | 115 → **57** (−50%) | — |

Pipeline's desktop number is almost all card data: the metric counts every column's cards, including the nine scrolled off to the right. Everything except the cards is ~70 words, including the shell and the 13 column headers. Reaching −50% would mean cutting card titles.

**Where the removed text went**
- Home: the date line was dropped (the week strip marks today); Capture/New content moved to the top bar; Content Today moved to Today (Due today tile → `/today`); Quick Capture card → top bar New menu (⌥N still works); growth tile → "More on your week" (Platform Growth); the Buffer hover breakdown → Pipeline's Buffer ⓘ; card descriptions → ⓘ; health row sentences → "Details"; first-week and first-steps lists → "All missions" / "All steps".
- Pipeline: page sentence → ⓘ; Stage groups panel → a one-line stage rail (still jumps); Buffer panel → one inline stat + ⓘ (breakdown, target, warning line, jump buttons); empty-column hints → the phone empty state and a tooltip; "Add to …" rows → a ＋ in the column header; "Last 14 days · All posts in Analytics" → a ↗ in the Published header; card format name and "High" text → the thumbnail and the priority icon (named for screen readers); "64 cards" → shown only while filtering; phone facets → behind "Filters".
- Settings → Profile: Settings' page sentence dropped (the section list says it); section description → ⓘ (merged with "This is you, the person…"); local-mode box → one line + ⓘ; "Your profile" card header dropped (duplicated the section title); EXIF line → the photo's ⓘ; "Your name in each circle can still be different" → the Preview's ⓘ; links help and "No links yet." dropped (the placeholder shows the format; the limit message still appears at 6); "Who sees your profile" card → the Preview's ⓘ; "Includes unsaved changes" dropped (the save bar says it).
- Shell: header buttons that duplicated a tab were removed on Calendar, Idea Bank, Idea Generator, Story Vault, Experience → Content, Research Library and Inspiration → Original. The Analytics "Post Performance" link stays because it carries the filters.

## Rollout (after the user approves the pilot)

Run five agents in parallel. Each owns only its `features/<folder>/**` (views and `messages.ts`). **Nobody edits `src/components/common/*`, `app-shell/*` or `navigation.ts`**; ask the lead instead. Checklist per screen: `PageHeader info` instead of the description sentence (no icon), `SectionHeader`/`SectionCard info` instead of description lines, drop Capture/New content buttons (top bar), explanations into empty states / ⓘ / `Disclosure`, fewer nested cards, Taglish cut as much as English, remove unused keys, then `text-budget.mjs` before/after plus screenshots.

1. **Daily work:** Today (`today`, and the full `WhatToPost` in `recommendations`), Content Studio list + workspace (`studio`, `repurpose`), Calendar · Weekly Planner · Posting Schedule (`calendar`).
2. **Plan:** Brand HQ · Goals · Platforms · System (`strategy`), Audience (`audience`), Pillars · Matrix · Funnel (`pillars`).
3. **Ideas & library:** Idea Bank (`ideas`), Generator · Hooks · Angles (`ideas-lab`), Story Vault (`stories`), Research (`research`), Series (`series`).
4. **Grow & money:** Collabs (`collabs`), Circles (`circles`), Campaigns + detail (`campaigns`), Money · Deals · Income · Media Kit (`money`).
5. **Measure & settings:** Analytics · Posts (`analytics`), Winners (`winners`), Reports (`reports`), Experiments (`experiments`), the other ten Settings tabs (`settings`, `reminders`), Strategist page (`strategist`).

Out of the shell (separate pass if wanted): onboarding, auth, admin, legal pages.
