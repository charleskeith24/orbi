# Supabase: accounts, sync and production persistence

Orbi runs in one of two modes. Nothing in the UI changes except where your data lives and whether there are accounts.

> Deploying for real (GitHub, Supabase, Vercel, domain)? Follow **[DEPLOY.md](DEPLOY.md)** — it is the step-by-step version of this page for non-developers. This page is the technical reference.

| | Local mode (default) | Supabase mode ("online version") |
|---|---|---|
| Turned on by | no Supabase env vars | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Data | this browser's `localStorage` (`pbos:workspace:v2`), starting from the Starter Kit | Postgres, one workspace per account, row-level security |
| Accounts | none; `/login`, `/signup`, `/set-password` and `/admin` explain local mode | email + password, magic link, invites; new people ask on `/signup` (**Request access**) and an admin approves them in `/admin` ([ADMIN.md](ADMIN.md)) |
| Devices | one browser | any device you sign in on |
| Backups | Settings → Data → Export; the banner reminds you after 7 days without one | the database; exports still work |
| Route guard (`src/proxy.ts`) | pass-through | refreshes the session on every request; signed-out pages → `/login?next=…`, signed-out `/api/*` → `401` (public: `/privacy`, `/terms`, `POST /api/access-requests`) |
| Adapter | `src/lib/data/local-adapter.ts` | `src/lib/data/supabase-adapter.ts` |

The switch is `isSupabaseConfigured` in `src/lib/supabase/config.ts`. The AI provider is configured separately (`ANTHROPIC_API_KEY`) and works in both modes.

---

## 1. Create a project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Region: **Southeast Asia (Singapore)** for users in the Philippines. Save the database password somewhere safe (the app doesn't use it).

## 2. Apply the schema

**Run every file in `supabase/migrations`, in filename order, once each.** Today:

| File | Owner | Creates |
|---|---|---|
| `20260910000000_init.sql` | workspace | `public.users` + every workspace table (`TABLE_NAMES` in `src/lib/data/defaults.ts`), indexes, triggers, RLS |
| `20260914000100_beta.sql` | beta toolkit | `feedback`, `usage_events` (server-only, RLS: insert/read own rows) |
| `20260914000200_push.sql` | push reminders | `push_subscriptions` (server-only, RLS: own rows) + reminder claim functions — setup in [REMINDERS.md](REMINDERS.md) |
| `20260918000000_admin.sql` | admin & access | `admin_users`, `access_requests`, `admin_audit_log`, `platform_settings` (server-only, RLS), `is_admin()`, the waitlist and admin functions, admin read policies on `feedback` / `usage_events` — setup in [ADMIN.md](ADMIN.md) |
| `20260919000000_circles.sql` | Collab Circles | `circles`, `circle_members`, `circle_contacts`, `circle_checkins`, `circle_asks`, `circle_ask_interests` (server-only, members-only RLS, no admin access), `is_circle_member()` and the circle RPCs (create, preview/join, rotate invite, remove, leave, accept interest, contacts) — ARCHITECTURE §15 |
| `20260920000000_profiles.sql` | Profiles | the profile columns on `public.users` (`headline`, `location`, `links`, `show_niche`; `full_name` = display name, `avatar_url` = a path in the private `avatars` bucket), `can_see_profile()`, `get_profiles()`, the private **`avatars` Storage bucket** and its `storage.objects` policies, the `profile_photo_removed` audit action — ARCHITECTURE §16 |
| `20260926000000_ai_keys.sql` | Your own AI key | `ai_keys` (server only: no grants or policies for signed-in users, not even for their own row) — one encrypted key per account, its last four characters, the model and what Orbi knows about it; the engine CHECK lists on scripts, reviews and the AI log gain `gemini` — ARCHITECTURE §7 |
| `20260925000000_server_grants.sql` | Server grants | what the secret key (`service_role`) may use, and nothing else: everything revoked first (older projects grant it every table, newer ones nothing), then column grants for the admin area, `submit_access_request()` and the reminders job; `admin_user_stats()` / `admin_onboarding_funnel()` become security definer, so the admin gets counts without any grant on content tables — ARCHITECTURE §14 |
| `20260921000000_team.sql` | Team workspaces | `workspace_members`, `workspace_invites` (server-only, RLS; no write grant at all), `workspace_role()` / `can_edit_workspace()` / `has_money_access()`, the team RPCs (invite, respond, set role, remove, leave, my workspaces), and **the row-level security of every workspace table rewritten** from those three helpers; `can_see_profile()` extended with "shares a workspace" — ARCHITECTURE §17 |
| newer files | their feature | run them too, in filename order |

**Option A: SQL Editor** — Dashboard → **SQL Editor** → **New query** → paste one whole file → **Run** ("Success. No rows returned") → next file.

**Option B: Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies pending files in order and records what already ran.

## 3. Configure authentication

Dashboard → **Authentication**:

1. **Sign In / Providers → Email**: keep it enabled.
   - **Confirm email** on: new accounts click a link before their first sign-in; the sign-up form shows "Check your email to confirm".
   - **Allow new users to sign up** off: accounts only through invites (existing and invited accounts still sign in). Orbi's `/signup` is a waitlist; with this switch on, someone could still sign up by calling Supabase Auth directly ([ADMIN.md](ADMIN.md) step 2).
2. **URL Configuration**:
   - **Site URL**: `http://localhost:3000` locally, your production URL once deployed.
   - **Redirect URLs**: `http://localhost:3000/**`, `https://<your-domain>/**` (and your `*.vercel.app` address). Email links go to `/auth/callback?next=<page>`; the `/**` pattern allows the query string.
3. **Emails / SMTP** (before inviting anyone): the built-in sender is rate-limited and only delivers to your Supabase team's addresses. Configure custom SMTP for real use — Supabase also keeps the email templates below read-only until custom SMTP is set up.

## 4. Add the environment variables

Locally, create `.env.local` in the project root (git-ignored); on Vercel, add them under Project → Settings → Environment Variables and redeploy.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Both are under **Project Settings → API Keys** (and **Data API** for the URL). Older projects show a legacy `anon` key; it works too, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as the variable name. Every other variable (AI, push reminders, the server-only `SUPABASE_SECRET_KEY`) is listed with comments in `.env.example`.

> Only the publishable (or anon) key belongs in a `NEXT_PUBLIC_` variable. It is safe in the browser because row-level security limits every query to the signed-in user. Never put the secret / `service_role` key in a `NEXT_PUBLIC_` variable or in the repository.

## 5. Restart and sign up

Environment variables are read when the app starts (and are built into the bundle on Vercel), so restart `npm run dev` or redeploy. Then:

1. You're redirected to **/login**. `/signup` is the **Request access** waitlist, so create your own first account in the dashboard: **Authentication → Users → Add user → Create new user** (tick **Auto Confirm User**), then sign in.
2. Make that account the admin and turn on 2-step verification ([ADMIN.md](ADMIN.md)). From then on, people request access and you approve them in `/admin`; each approval sends a Supabase invite.
3. A new account starts empty, so onboarding opens — unless this browser holds a local workspace (next section).

The account menu is the avatar at the top right of the top bar (photo or initials + name and email) and has **Profile**, **Settings**, **Theme**, **Send feedback** and **Sign out**.

---

## Move a local workspace into your account

**Same address (e.g. `localhost:3000` before and after adding the env vars).** The local workspace is still in this browser's `localStorage`. After sign-in, while the account is empty, Orbi asks once: **"Move your local workspace to your account?"** The same action stays in **Settings → Data → Local workspace in this browser**.

- The move goes through the Supabase adapter in `TABLE_NAMES` order with a progress bar, then a toast.
- Rows get **fresh ids** with every reference rewritten (`src/lib/supabase/rekey.ts`). Every browser's Starter Kit uses the same ids on the same day, and ids are primary keys shared by all accounts — without this, the second person to move a workspace would hit `duplicate key value violates unique constraint "…_pkey"`.
- The local copy is **never modified**. After a successful move a marker (`pbos:workspace:v2:moved`) stops the offer; Settings → Data can then download or remove the local copy.
- An account that already has its own workspace is never overwritten by the offer; the card offers a download instead.

**Different address (your deployed site).** `localStorage` belongs to one address, so the site can't see it. Export the workspace on the old address (**Settings → Data → Export workspace**), then on the new site open `/settings?tab=data` (reachable before onboarding) → **Import workspace…**. Imports into an account also get fresh ids, so one file can go into several accounts.

**If something fails midway.** PostgREST can't wrap many requests in one transaction, so `replaceAll` reads the account's current rows first and writes them back if any step fails ("Nothing was changed — your previous workspace is back"). If even the restore fails (e.g. the connection is gone), the error says so and asks you to export the in-memory workspace before reloading.

---

## How the pieces fit

| Piece | File | What it does |
|---|---|---|
| Proxy | `src/proxy.ts` | Supabase mode only: calls `auth.getUser()` to refresh the session cookie; signed-out page requests → `/login?next=<path>`, signed-out `/api/*` → `401 {"error":"unauthorized"}`, signed-in visitors of `/login` / `/signup` → `next` or `/`. Public: `/login`, `/signup`, `/privacy`, `/terms`, `/auth/*`, `POST /api/access-requests` (the waitlist form; the route checks the Origin header and rate-limits), `/api/cron/*` (authenticated by `CRON_SECRET` in the route), and static files the matcher skips — `/sw.js`, `/manifest.webmanifest`, `/icons/*`, images, fonts. |
| Auth pages | `src/app/(auth)/login`, `signup`, `set-password` | Email + password, "Email me a magic link", confirmation state; **Set a password** for signed-in users (invited testers, magic-link users). The magic link only signs in existing accounts (`shouldCreateUser: false`) and gives every email the same "if it has an account" answer (`isNoAccountError`). In local mode they explain local mode. |
| Email links | `src/app/auth/callback/route.ts` | Exchanges `?code=` (PKCE) or verifies `?token_hash=&type=` (`email`, `invite`, `recovery`…), sets the session cookies, continues to `next`. Failures → `/login?error=<code>` with a readable message. |
| Sign-out | `src/app/auth/signout/route.ts` | `POST` only; ends this browser's session (`scope: "local"`). |
| Clients | `src/lib/supabase/{client,server}.ts` | Browser singleton and per-request server client (cookies). |
| Data | `src/lib/data/supabase-adapter.ts` | Loads every table (paged, ordered by `created_at, id`), writes rows (unknown fields dropped), sends the effects Postgres can't express (array-reference cleanup, tag links), fails loudly when an update matches no row, and replaces a workspace with rollback + progress (`trackReplace`). |
| Local → cloud | `src/lib/supabase/{move-local,rekey}.ts`, `features/settings/data-move-local.tsx` | Reads the local snapshot, decides whether to offer the move, rekeys and imports. |
| Secret-key client | `src/lib/supabase/admin.ts` | Server only: the `SUPABASE_SECRET_KEY` client (bypasses RLS) for the admin API and the waitlist. |
| Waitlist | `src/app/api/access-requests/route.ts` | `POST` from the public Request access form → `public.submit_access_request()` (one pending request per email, about 30 new requests per hour, closed when the admin switches requests off). Same answer for new, repeat and existing emails. |
| Admin | `src/lib/admin/{gate,guard}.ts`, `src/app/api/admin/*` | Every admin page and route checks the session (`auth.getUser()`), `is_admin()` and 2-step verification (AAL2). Details in ARCHITECTURE.md §14. |

`next` values are restricted to same-origin relative paths (`src/components/features/auth/auth-paths.ts`), so links like `/login?next=//evil.com` can't redirect elsewhere.

### Email links that work across devices

The default templates use the PKCE flow: the link must be opened in the browser that requested it. To make links work anywhere, edit the templates under **Authentication → Emails**:

| Template | Link |
|---|---|
| Confirm signup, Magic Link | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` |
| Invite user | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/set-password` |
| Reset Password | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/set-password` |

Without a `next`, a link lands on the home page. Invited testers land on **Set a password** and use email + password from then on.

---

## Schema reference

The init migration mirrors `src/lib/types.ts` exactly. Column names are the TypeScript field names, so rows move between the store, the local adapter and Postgres without mapping.

**Conventions**

- Every workspace table: `id uuid` primary key, `user_id` → `auth.users` (`on delete cascade`, defaults to `auth.uid()`), `created_at`, `updated_at` (kept current by the `set_updated_at` trigger).
- `string` → `text not null default ''`; `string[]` → `text[] not null default '{}'`; `ID[]` → `uuid[]`; counts, ranks and scores → `integer`; anything that can be fractional → `numeric` (rates, percentages, multipliers, durations, money); `ISODate` → `date`; `ISODateTime` → `timestamptz`; nested objects → `jsonb`.
- Enum-typed columns are `text` with a `CHECK` listing exactly the values in `types.ts` (arrays of enums use `<@ array[...]`).
- Defaults match `TABLE_DEFAULTS` in `src/lib/data/defaults.ts`.
- Tables are created in `TABLE_NAMES` order (parents before children), the same order the adapter imports in.
- Server-only tables (`feedback`, `usage_events`, `push_subscriptions`, `admin_users`, `access_requests`, `admin_audit_log`, `platform_settings`, the `circle_*` tables, `workspace_members`, `workspace_invites`) are not part of the workspace model; they live in their feature's own migration with RLS.

**Relationships** (identical to `src/lib/data/relations.ts`, which applies the same rules in memory for local mode)

- Deleting a content item cascades to its brief, scripts, metrics and repurposing records; every other optional reference is `on delete set null`.
- Tags → tag links cascade.
- No foreign key, by design (each has a `COMMENT` in the migration): array references (`*_ids` columns — the app removes deleted ids), polymorphic references (`content_tags.entity_id`, `content_ideas.source_ref_id`, `ai_generations.entity_id`), and `content_ideas.converted_item_id` (soft reference, cleared by the `clear_converted_item_refs` trigger).

**Security**

- Row-level security on every table. Since `20260921000000_team.sql`, the workspace tables' `select` / `insert` / `update` / `delete` policies for `authenticated` are built from three security-definer helpers — `workspace_role(user_id) is not null` to read, `(select auth.uid()) = user_id` to write Brand HQ, audience, pillars, formats and settings, `can_edit_workspace(user_id)` to write the content tables, and `has_money_access(user_id)` on top for `brand_deals` / `income_entries` / `rate_cards` (ARCHITECTURE §17). A workspace is still every row with one `user_id`; the owner is the account that id belongs to. `public.users` allows reading and updating only your own row (updates: the profile columns only, never `email` or `id`); other people's profiles come only from `get_profiles()`, which never returns the email. `anon` has no table access (older projects grant it by default; the migrations revoke it). `service_role` (the secret key) gets only what the server code uses — `20260925000000_server_grants.sql` — and no table holding a creator's words.
- `public.users` is filled by the `on_auth_user_created` trigger and kept in sync by `on_auth_user_updated`.
- One `brand_profiles` row and one `app_settings` row per user; tag names unique per user, case-insensitively; a tag is linked to an entity at most once.
- Row **ids are global primary keys** — two accounts can't hold rows with the same id. The app generates random UUIDs; moves and imports rekey (above).
- **Admin.** The admin role lives in `admin_users`, which signed-in users can't read or write — never on `public.users`, whose row each user may update. `public.is_admin()` (security definer) tells the signed-in user whether they are an admin. `access_requests` and `platform_settings` are secret-key only. `admin_audit_log` is append-only (no update or delete grant, not even for the secret key). Admins can read every `feedback` and `usage_events` row and the audit log only with a 2-step-verified session (`auth.jwt() ->> 'aal' = 'aal2'`). The admin functions return counts, never workspace content.

## How the schema is tested

| Test | What it proves |
|---|---|
| `src/lib/data/schema-parity.test.ts` | Reads the migration text: columns, SQL types, nullability, CHECK lists, defaults, FKs vs `relations.ts`, indexes, RLS policies and grants, triggers, comments; the demo workspace fits the column types. |
| `src/lib/data/schema.pglite.test.ts` | **Runs** every migration, in filename order, on real Postgres (PGlite — Postgres 18 compiled to WASM, in memory) on top of a stub of Supabase's `auth` schema (`auth.users`, `auth.uid()` / `auth.role()` / `auth.jwt()` reading `request.jwt.claims`, the `anon` / `authenticated` / `service_role` roles, Supabase's default grants). Then: the demo workspace inserts table by table in `TABLE_NAMES` order as its owner with RLS on and reads back identically; for **every** `relations.ts` reference, deleting a parent leaves exactly what `planDelete` predicts (minus the array/tag cleanup that is the adapter's job); `updated_at` triggers fire on every table; RLS: another account sees, updates and deletes nothing, can't insert rows for someone else, `anon` is denied; per-account unique keys; account deletion cascades; sign-up creates `public.users`. |
| `src/lib/admin/admin-migration.pglite.test.ts` | The admin migration on that database: signed-in users (even admins) can't write `admin_users`; `is_admin()` is right for admins and others and not callable by anon; nobody but the secret key reads `access_requests`; the waitlist function's outcomes (created, duplicate, exists, closed, rate limited); the audit log is append-only even for the secret key; admin reads of feedback, usage events and the audit log need aal2; `revoke_admin()` keeps the last admin; the stats and funnel functions return counts only; account deletion keeps the audit log. |
| `src/lib/team/team-migration.pglite.test.ts` | The team migration on that database: the whole RLS matrix — owner, editor, viewer, editor with Money access, viewer with Money access, a non-member and an account with no team — for select, insert, update and delete on **all 33 workspace tables**; that an unfiltered select really does return two workspaces' rows for a member of two (which is why the adapter filters); that a member can't write another workspace's rows, move a row between workspaces, or change any role including their own; that removing a member revokes access at once; that deleting the owner's account cascades memberships; the invite rules (stored whether or not the email has an account, the 5-seat limit shared by members and pending invites, accept/decline, the 10-workspace limit); and that sharing a workspace makes two people connected for `get_profiles()`. `src/lib/team/workspace-scoping.pglite.test.ts` runs the real adapter through the PostgREST stand-in: every load names the workspace, every insert stamps its owner, Money isn't even requested without access, and personal preferences go to the member's own row. |
| `src/lib/profiles/profiles-migration.pglite.test.ts` | The profiles migration, on a stub of the `storage` schema too (`storage.buckets`, `storage.objects` with RLS and the platform's grants): only the owner reads `public.users`; users update only their profile columns; every CHECK (name, headline, location, links — the SQL and `links.ts` agree value by value — and the photo path); the sign-up triggers never take a photo from metadata or overwrite a name you set; `get_profiles()` gives yourself and circle-mates the safe columns, a stranger nothing, never an email, the niche only when opted in, and nothing once a circle is left; the `avatars` bucket is private (1 MB, WebP/JPEG) and its policies let you write only in your own folder and read only yourself and connected people. `features/profile/api/supabase-api.pglite.test.ts` runs the browser client end to end through the PostgREST stand-in plus a Storage stand-in (`src/lib/profiles/testing/pglite-storage.ts`). |
| `src/lib/data/supabase-adapter.pglite.test.ts` | Runs the **real adapter** against that database through a PostgREST stand-in (`src/lib/supabase/testing/postgrest-fake.ts`: one transaction per request as `authenticated` with the user's JWT claims, rows in/out as JSON, `PGRST204` for unknown columns). Covers load (paging past 1,000 rows), insert, update (including "no row matched"), `remove` for every reference end to end (Postgres + the adapter's cleanup = the in-memory store), `replaceAll` with progress, rollback after a rejected row and after a dropped connection, and local → cloud moves (including the primary-key collision rekeying prevents). |

Run them with `npx vitest run src/lib/data/schema.pglite.test.ts src/lib/data/supabase-adapter.pglite.test.ts` (about a minute; one PGlite instance per file). They are data-driven — new tables, references and migration files are picked up automatically.

**What PGlite does not prove.** The SQL is real Postgres, but the rest of hosted Supabase is not in the test: PostgREST itself (the stand-in mimics the calls the adapter makes — no HTTP, schema cache, request limits or its exact error texts), Supabase Auth (sign-up, emails, sessions, token refresh, the real `auth` schema and its functions), Supabase's own extensions and roles beyond the stub, the Storage API (uploads, file bytes, size and mime limits, signed URLs — the stub proves only the `storage.objects` policies), dashboard settings (URL configuration, email templates, SMTP), and the Vercel deployment. After deploying, do the manual check at the end of DEPLOY.md.

## Changing the schema

1. Update the interface in `src/lib/types.ts` and its entry in `TABLE_DEFAULTS` (plus `REFERENCES` in `relations.ts` for a new reference).
2. Before the first deployment, edit the init migration. After a project has run it, add a new migration instead, e.g. `supabase/migrations/20261001000000_add_story_mood.sql`:
   ```sql
   alter table public.stories add column mood text not null default '';
   ```
   Never edit a migration that has already been applied to a project.
3. Run the parity and PGlite tests:
   ```bash
   npx vitest run src/lib/data/schema-parity.test.ts src/lib/data/schema.pglite.test.ts src/lib/data/supabase-adapter.pglite.test.ts
   ```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Couldn't load your workspace" with `Loading <table> failed: Could not find the table … in the schema cache` (or `relation … does not exist`) | A migration hasn't been applied (step 2). If you just applied it, run `notify pgrst, 'reload schema';` in the SQL editor. |
| `Could not find the '<field>' column of '<table>' in the schema cache` | The app is newer than the database: run the newer migration files. |
| Saving fails with `invalid input syntax for type integer` | A form sent a fraction to a whole-number column. Round it in the form; local mode accepts it, Postgres doesn't. |
| `duplicate key value violates unique constraint "…_pkey"` | A row id already exists in the database (another account). Moves and imports rekey automatically; if you insert rows another way, give them new ids. |
| Import / move: "Nothing was changed — your previous workspace is back" | One step failed (the message names the table and reason); the account was restored. |
| "the row no longer exists (deleted on another device?)" | The update matched no row. Reload. |
| `/login` shows "Accounts are off in local mode" | The env vars are missing or misspelled, or the app wasn't restarted / redeployed. |
| "Couldn't reach Supabase" | Check `NEXT_PUBLIC_SUPABASE_URL` and your connection. |
| Email link opens `/login` with "Open the link in the same browser…" | PKCE links only work in the requesting browser. Request a new link there, or switch to the token-hash templates above. |
| Email link goes to the wrong site or is rejected | Add `<origin>/**` to **Redirect URLs** and check the **Site URL**. |
| "Too many emails were sent" | Built-in email rate limit. Wait, or configure custom SMTP. |
| Set a password: "sign in again with an email link" | The project requires a recent sign-in to change passwords. Request a magic link, open it, then set the password right away. |
| "new row violates row-level security policy" | The request wasn't made as the signed-in user. Sign out and back in; never write rows with another `user_id`. |
