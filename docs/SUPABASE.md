# Supabase: accounts, sync and production persistence

Personal Brand OS runs in one of two modes. Nothing in the UI changes except where your data lives and whether there are accounts.

| | Local mode (default) | Supabase mode |
|---|---|---|
| Turned on by | no Supabase env vars | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Data | this browser's `localStorage`, seeded with a demo workspace | Postgres, one workspace per account, row-level security |
| Accounts | none; `/login` and `/signup` explain local mode | email + password, magic link, email confirmation |
| Devices | one browser | any device you sign in on |
| Route guard (`src/proxy.ts`) | pass-through | refreshes the session on every request; signed-out pages → `/login?next=…`, signed-out `/api/*` → `401` |
| Adapter | `src/lib/data/local-adapter.ts` | `src/lib/data/supabase-adapter.ts` |

The switch is `isSupabaseConfigured` in `src/lib/supabase/config.ts`. The AI provider is configured separately (`ANTHROPIC_API_KEY`) and works in both modes.

---

## 1. Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Pick a region close to you and save the database password somewhere safe (you won't need it for the app).

## 2. Apply the schema

The whole schema is one migration: [`supabase/migrations/20260910000000_init.sql`](../supabase/migrations/20260910000000_init.sql).

**Option A: SQL editor (no tools needed)**

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of the migration file and click **Run**. It should finish with "Success. No rows returned".

**Option B: Supabase CLI** (install it separately; it isn't a project dependency)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Run the migration once per project. It creates 30 tables (29 workspace tables + `public.users`), their indexes, triggers and row-level security policies.

## 3. Configure authentication

Dashboard → **Authentication**:

1. **Sign In / Providers → Email**: keep it enabled.
   - **Confirm email** on: new accounts must click a link before their first sign-in. The sign-up form then shows "Check your email to confirm".
   - **Confirm email** off: sign-up signs the user in immediately.
2. **URL Configuration**:
   - **Site URL**: `http://localhost:3000` (your production URL once deployed).
   - **Redirect URLs**: add `http://localhost:3000/**` and, for production, `https://<your-domain>/**`. Email links go to `/auth/callback?next=<page>`, and the `/**` pattern also allows that query string.
3. **Emails / SMTP** (recommended before inviting anyone): the built-in sender is rate-limited to a few emails per hour and may only deliver to your team's addresses. Configure custom SMTP for real use.

## 4. Add the environment variables

Create `.env.local` in the project root (it is git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Find both under **Project Settings → API Keys** (and **Data API** for the URL). Older projects show a legacy `anon` key instead; it works too, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as the variable name.

> Only the publishable (or anon) key belongs in a `NEXT_PUBLIC_` variable. It is safe in the browser because row-level security limits every query to the signed-in user. Never put the secret / `service_role` key in the app.

## 5. Restart and sign up

Environment variables are read when the dev server starts, so restart it (`npm run dev`). Then open <http://localhost:3000>:

1. You're redirected to **/login** → **Create an account**.
2. Confirm your email if required. The link lands on `/auth/callback`, which signs you in.
3. A new account starts with an empty workspace, so the onboarding wizard opens. Or import an existing workspace (next section).

The account menu sits at the bottom of the sidebar (avatar + email) and has **Settings** and **Sign out**.

---

## Move a local workspace into Supabase

Local data stays in the browser it was created in. To take it with you:

1. **Before** adding the Supabase variables (still in local mode), open **Settings → Data** and export the workspace as JSON. The file contains every table of your workspace.
2. Add the variables, restart the dev server, and sign up or sign in.
3. Open **Settings → Data** again and import that file. The import replaces the cloud workspace of the signed-in account (a new account's is empty), keeps every row id and relationship, and assigns all rows to your account.

The local copy is not deleted. Remove the Supabase variables and restart to get back to it.

---

## How the pieces fit

| Piece | File | What it does |
|---|---|---|
| Proxy | `src/proxy.ts` | Supabase mode only: calls `auth.getUser()` on every request to refresh the session cookie; redirects signed-out page requests to `/login?next=<path>`, answers signed-out `/api/*` calls with `401 {"error":"unauthorized"}`, and sends signed-in visitors of `/login` / `/signup` to `next` or `/`. Public: `/login`, `/signup`, `/auth/*`, static files. |
| Auth pages | `src/app/(auth)/login`, `src/app/(auth)/signup` | Email + password, "Email me a magic link", confirmation state. In local mode they show an explanation card with **Open my local workspace**. |
| Email links | `src/app/auth/callback/route.ts` | Exchanges `?code=` (PKCE) or verifies `?token_hash=&type=`, sets the session cookies, continues to `next`. Failures go back to `/login?error=<code>` (keeping `next`) with a readable message. |
| Sign-out | `src/app/auth/signout/route.ts` | `POST` only; ends this browser's session (`scope: "local"`) and redirects to `/login`. |
| Clients | `src/lib/supabase/{client,server}.ts` | Browser singleton and per-request server client (cookies). |
| Data | `src/lib/data/supabase-adapter.ts` | Loads every table (RLS scopes it to the user), writes rows, and sends the effects Postgres can't express (array-reference cleanup, tag links). |

`next` values are restricted to same-origin relative paths (`src/components/features/auth/auth-paths.ts`), so links like `/login?next=//evil.com` can't redirect elsewhere.

### Optional: email links that work across devices

The default email templates use the PKCE flow: the link must be opened in the browser that requested it (otherwise the login page says so). To confirm from any device, edit **Authentication → Emails → Confirm signup** and **Magic Link** to link to:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

This template doesn't carry the `next` page, so these links always land on the home page.

---

## Schema reference

The migration mirrors `src/lib/types.ts` exactly. Column names are the TypeScript field names, so rows move between the store, the local adapter and Postgres without mapping.

**Conventions**

- Every workspace table: `id uuid` primary key, `user_id` → `auth.users` (`on delete cascade`, defaults to `auth.uid()`), `created_at`, `updated_at` (kept current by the `set_updated_at` trigger).
- `string` → `text not null default ''`; `string[]` → `text[] not null default '{}'`; `ID[]` → `uuid[]`; counts, ranks and scores → `integer`; anything that can be fractional → `numeric` (rates, percentages, tier multipliers, durations, years of experience, posts per week); `ISODate` → `date`; `ISODateTime` → `timestamptz`; nested objects (scores, analysis, stats, sections, AI input/output, funnel targets, engagement tasks) → `jsonb`.
- Enum-typed columns are `text` with a `CHECK` listing exactly the values in `types.ts` (arrays of enums use `<@ array[...]`).
- Defaults match `TABLE_DEFAULTS` in `src/lib/data/defaults.ts`.
- Tables are created in `TABLE_NAMES` order (parents before children), the same order the adapter uses to import.

**Relationships** (identical to `src/lib/data/relations.ts`, which applies the same rules in memory for local mode)

- Deleting a content item cascades to its brief, scripts, metrics and repurposing records; every other optional reference is `on delete set null`.
- Tags → tag links cascade.
- No foreign key, by design (each has a `COMMENT` in the migration):
  - array references (`content_platforms.preferred_*_ids`, `content_experiments.variant_*_item_ids`, `weekly_reviews.planned_item_ids`): the app removes deleted ids;
  - polymorphic references (`content_tags.entity_id`, `content_ideas.source_ref_id`, `ai_generations.entity_id`);
  - `content_ideas.converted_item_id`: a soft reference, because `content_items.idea_id` already points back and a second FK would create an insert cycle. The `clear_converted_item_refs` trigger nulls it when the item is deleted.

**Security**

- Row-level security is enabled on every table. Each table has `select` / `insert` / `update` / `delete` policies for the `authenticated` role using `(select auth.uid()) = user_id`; `public.users` allows a user to read and update only their own row. The `anon` role has no table access.
- `public.users` is filled by the `on_auth_user_created` trigger (name from sign-up metadata) and kept in sync by `on_auth_user_updated`. Accounts that existed before the migration are backfilled.
- One `brand_profiles` row and one `app_settings` row per user (unique on `user_id`); tag names are unique per user, case-insensitively; a tag is linked to an entity at most once.

**Indexes**: `user_id` and every foreign-key column, plus `content_items (user_id, stage)`, `content_items (user_id, scheduled_at)`, `content_metrics (content_item_id, recorded_at)` and `content_tags (entity_type, entity_id)`.

## Changing the schema

1. Update the interface in `src/lib/types.ts` and its entry in `TABLE_DEFAULTS` (plus `REFERENCES` in `relations.ts` for a new reference).
2. Add a new migration, e.g. `supabase/migrations/20261001000000_add_story_mood.sql`:
   ```sql
   alter table public.stories add column mood text not null default '';
   ```
   Don't edit a migration that has already been applied to a project.
3. Run the parity test. It compares every migration against `types.ts`, `TABLE_DEFAULTS` and `relations.ts` (columns, types, nullability, enum `CHECK` lists, defaults, foreign keys, indexes, RLS) and checks that the demo workspace would import cleanly:
   ```bash
   npx vitest run src/lib/data/schema-parity.test.ts
   ```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Couldn't load your workspace" with `Loading <table> failed: Could not find the table … in the schema cache` (or `relation … does not exist`) | The migration hasn't been applied to this project (step 2). If you just applied it, reload the API schema cache: run `notify pgrst, 'reload schema';` in the SQL editor. |
| Saving fails with `invalid input syntax for type integer` | A form sent a fraction to a whole-number column (counts, scores, targets). Round it in the form; local mode accepts it, Postgres doesn't. |
| `/login` still shows "Accounts are off in local mode" | The env vars are missing or misspelled, or the dev server wasn't restarted. |
| "Couldn't reach Supabase" | Check `NEXT_PUBLIC_SUPABASE_URL` and your connection. |
| Email link opens `/login` with "Open the link in the same browser…" | PKCE links only work in the requesting browser. Request a new link there, or switch to the token-hash templates above. |
| Email link goes to the wrong site or is rejected | Add `<origin>/auth/callback` to **Redirect URLs** and check the **Site URL**. |
| "Too many emails were sent" | Built-in email rate limit. Wait, or configure custom SMTP. |
| "An account with this email already exists" | Sign in instead, or use "Email me a magic link". |
| "new row violates row-level security policy" | The request wasn't made as the signed-in user. Sign out and back in; never write rows with another `user_id`. |
