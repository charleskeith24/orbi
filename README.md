# Orbi — Personal Brand Content OS

**Strategy → Create → Publish → Analyze → Improve**

A strategic content operating system for growing a personal brand across Facebook, TikTok, Instagram, YouTube, LinkedIn, X and Threads. It connects brand strategy, audience research, content pillars, idea generation, production, scheduling, analytics and learning into one feedback loop — so you always know **what to create, why, for whom, where, when, how, what performed, why it performed, and what to create next.**

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no configuration the app runs in **local mode** (your workspace is saved in this browser). A new workspace starts empty and opens the **onboarding**, which begins with **Niche Discovery**: your interests (*hilig*), skills, audience and goals → three niche directions → a strategy, pillars and 30 starter ideas aligned to the niche you pick. Onboarding runs in English or Taglish. **Settings → Data** exports/imports your workspace or starts fresh.

### Optional: Claude for AI features

Copy `.env.example` to `.env.local` and set:

```
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-opus-5     # default
AI_EFFORT=high             # low | medium | high | xhigh | max
```

Without a key, every AI feature still works through the built-in **offline template engine** (brand-aware, clearly labelled "Offline templates" in the UI). Keys never reach the browser — all AI calls go through `/api/ai`.

### Optional: Supabase for accounts and sync

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, run the SQL migration in `supabase/migrations/`, and restart. See [docs/SUPABASE.md](docs/SUPABASE.md).

## What's inside

| Area | Modules |
|---|---|
| Strategy | Brand HQ, goals, platform strategy, flywheel, principles, operating rhythm |
| Audience | Personas, Problem Bank, Question Bank |
| Pillars | Content pillars with target mix, Content Matrix, TOFU/MOFU/BOFU funnel |
| Ideas | Idea Bank (table / cards / kanban), Quick Capture, AI Idea Generator, Hook Library, Angle Library, Idea Priority Score |
| Create | Content Studio (brief, scripts for every format, Content Score), Repurposing Engine, Content Tree |
| Produce & publish | Pipeline (13-stage kanban), Calendar (month/week/day, drag-and-drop), Posting Schedule, Weekly Planner, content buffer |
| Organize | Campaigns, Series, Story Vault, Experience → Content, Research Library, Inspiration → Original |
| Measure & learn | Analytics (manual entry + computed rates), winner detection, Winning Content Library, Experiments, Weekly Report, Monthly Review |
| Intelligence | Content Health Score, "What should I post?" decision engine, strategic insights, Content Strategist assistant |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (analytics, seed integrity, AI offline engine, schema parity) |
| `node scripts/smoke.mjs <route>` | Headless smoke test of one route (uses local Google Chrome) |
| `node scripts/route-audit.mjs` | Every route in light / dark / mobile — errors, overflow, screenshots |
| `node scripts/click-audit.mjs <route>` | Clicks every control on a page and flags controls with no effect |
| `node scripts/e2e-flow.mjs` | Cross-feature flow: Quick Capture → Idea Bank → convert → Studio → Pipeline → publish → analytics → Calendar → Dashboard |

The QA scripts seed a sample workspace in dev by default (`--seed=demo`); use `--seed=fresh` for an onboarded but empty workspace or `--seed=none` for a true first run. The sample workspace is a test fixture only — real users never see it.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture, data layer, design system, engineering contract
- [docs/FEATURES.md](docs/FEATURES.md) — feature-by-feature specification
- [docs/SUPABASE.md](docs/SUPABASE.md) — database, auth and deployment setup

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Zustand · Recharts · Supabase (Postgres + Auth + RLS) · Anthropic Claude via a provider abstraction · Vitest · Playwright (smoke/QA scripts).
