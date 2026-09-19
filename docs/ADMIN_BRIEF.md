# Admin & access — build brief

**Status:** approved by the user on 2026-09-18.

**Decisions:**
- **Platform admin first.** The owner of Orbi manages all accounts. Team workspaces for VAs and editors come later.
- **Signup is a waitlist the admin approves.**
- **The name stays "Orbi".**

**Goal:** in the online version (Supabase), nobody gets an account without the admin's approval. The admin gets a small, secure area to run the beta: approve access requests, manage users, read feedback, see the onboarding funnel, and review an audit log. The admin **never** sees a creator's content.

Read first: `AGENTS.md`, `docs/ARCHITECTURE.md` (§1–§5, §10, §11, §13), `docs/SUPABASE.md`, `docs/DEPLOY.md`, `src/proxy.ts`, `src/components/features/auth/**`, `src/lib/supabase/**`, `src/app/api/feedback/route.ts` + test, `supabase/migrations/20260914000100_beta.sql` and `src/lib/telemetry/beta-migration.pglite.test.ts`. The last two are the pattern for server-only tables and PGlite tests.

## Local mode
There are no accounts in local mode, and nothing about it changes. The `/admin` pages show an honest notice there ("Admin is part of the online version…" with a link to `docs/DEPLOY.md` steps), the same way the login pages explain local mode. Admin links never appear in local mode.

## 1. Access requests (the waitlist)
- **Signup page.** In Supabase mode, `/signup` becomes **"Request access" / "Mag-request ng access"**. Nobody creates an account there.
- **Form fields:**
  - name;
  - email;
  - "What do you create? / Anong content mo?" (optional, ≤ 300 chars);
  - a link to your page (optional URL);
  - a required consent checkbox linking to `/privacy`;
  - a hidden honeypot field.
- **Login page.** It gets "No account yet? Request access" / "Wala pang account? Mag-request ng access".
- **Endpoint.** `POST /api/access-requests` is public, so allow it in `decideProxyAction` for anonymous callers. It validates with zod, rejects a filled honeypot silently, and requires a same-origin `Origin` header. It is rate-limited in the database: at most 1 pending request per email, and at most N requests per hour overall (pick N ≈ 30). Store the request with the server secret-key client.
- **Response.** Always answer the same "Thanks — we'll email you when you're approved", even when the email already exists, so the endpoint doesn't reveal who has requested or signed up.
- **Approve.**
  - The admin approves with `auth.admin.inviteUserByEmail(email, { redirectTo })`, reusing the invite → `/set-password` flow in DEPLOY.md.
  - The request is marked `approved`, with `decided_by` and `decided_at`.
- **Reject.** Marks it `rejected`, and no email goes out. That is fine for the beta; say so in the UI.
- **Closed setting.** `access_open` ("accepting requests") is a platform setting the admin can switch off. When it's off, `/signup` says requests are closed for now.
- **Supabase dashboard.** Its "Allow new users to sign up" setting must be **off**, so the Supabase API can't be used to sign up around the waitlist. Document that in DEPLOY.md; the app can't change it.

## 2. Admin role — cannot be self-granted
- **New migration** `supabase/migrations/20260918000000_admin.sql`. Every table in it is server-only, with RLS on:
  - `admin_users (user_id uuid pk → auth.users on delete cascade, granted_by uuid null, created_at)`. There are **no** insert, update or delete policies for `authenticated`. It must never live on `public.users`: users can update their own row there, so a role column would let anyone make themselves admin.
  - `public.is_admin()`: `security definer`, `stable`, `set search_path = ''`, returns whether `auth.uid()` is in `admin_users`. Grant execute to `authenticated`.
  - `access_requests (id, email citext or lowercased text, name, about, link, status check in ('pending','approved','rejected'), created_at, decided_by, decided_at, ip_hash null)`. No policies for `anon` or `authenticated`; the server secret key only.
  - `admin_audit_log (id, admin_id, action text check in (…), target_user_id null, target_email null, details jsonb default '{}', created_at)`. Append-only: no update or delete for anyone except via the dashboard. Admins select through `is_admin()`, and inserts happen server-side.
  - `platform_settings`: a singleton with `access_open boolean default true` and `updated_at`. Read by the server. The admin writes it through the API.
  - Admin read policies on the existing `feedback` and `usage_events` via `is_admin()`. Keep the users' own-row policies.
- **First admin.** Documented as one SQL line in `docs/ADMIN.md` and DEPLOY.md:
  ```sql
  insert into admin_users (user_id) select id from auth.users where email = '…';
  ```
  After that, admins can grant and revoke admin from the UI.
- **Schema parity.** Add the new tables to `SERVER_ONLY_TABLES` in `schema-parity.test.ts`. RLS is required.

## 3. Server guard
- **`src/lib/supabase/admin.ts`** (`import "server-only"`) creates the secret-key client from `SUPABASE_SECRET_KEY`. It's never imported by client code.
- **`requireAdmin()`** is used by every `/admin` page (server component) and `/api/admin/*` handler. It:
  1. validates the session with `auth.getUser()`, never trusting cookies alone;
  2. checks `is_admin()`;
  3. requires **AAL2** (the Supabase MFA assurance level from the session);
  4. requires a same-origin `Origin` on mutations.

  An admin without MFA is sent to `/admin/security` to enroll. A signed-in non-admin gets 404, which doesn't reveal that the area exists. Unit-test every branch.
- **2-step verification.** `/admin/security` handles TOTP enrollment: QR code and secret, verify code, list and remove factors. It uses Supabase `auth.mfa.*`, and a challenge screen appears when the session is AAL1 but a factor exists.
- **Guard rails:**
  - An admin can't disable, delete or un-admin **themselves**.
  - The **last admin** can't be removed.
  - Every mutation writes one `admin_audit_log` row: action, target id and email, and small `details` such as `{ "from": "active", "to": "disabled" }`, **never** content.

## 4. Admin API (`/api/admin/*`, all behind `requireAdmin`)
| Route | Does |
|---|---|
| `GET /api/admin/overview` | total users; active in 7 and 30 days (`last_sign_in_at`); onboarding completed; pending requests; feedback in 7 days; the onboarding funnel from `usage_events` (views and completions per step, counts only) |
| `GET /api/admin/requests?status=` | list requests |
| `POST /api/admin/requests/:id/approve` | invite, then mark approved |
| `POST /api/admin/requests/:id/reject` | mark rejected |
| `GET /api/admin/users` | `auth.admin.listUsers` (paged) joined with: is_admin; status (invited / active / disabled via `banned_until`); `created_at`, `last_sign_in_at`, `invited_at`; `brand_profiles.onboarding_completed`; **counts only** of ideas, content items and published items |
| `POST /api/admin/users/invite` | invite by email, bypassing the waitlist |
| `POST /api/admin/users/:id/resend-invite` | re-send the invite (only while invited) |
| `POST /api/admin/users/:id/disable` / `enable` | ban: `ban_duration` long / `"none"` |
| `POST /api/admin/users/:id/reset-password` | send a recovery email |
| `DELETE /api/admin/users/:id` | the confirmation body must repeat the email; `auth.admin.deleteUser` (the workspace cascades) |
| `POST /api/admin/users/:id/admin` / `DELETE …/admin` | grant or revoke admin |
| `GET /api/admin/feedback` | feedback rows with the sender's email (feedback was written *to* the team, so reading it is fine) |
| `GET /api/admin/audit` | audit log, newest first, paged |
| `GET/PATCH /api/admin/settings` | `access_open` |

- **Response shape.** Every response is `{ error, message }` on failure with a proper status, plus `Cache-Control: no-store`.
- **Tests.** Handlers are unit-tested with fakes; see how `src/app/api/feedback/route.test.ts` and `src/app/api/push/routes.test.ts` fake Supabase.
- **Shared types.** Put the request and response types in `src/lib/admin/types.ts`, shared by the UI.

## 5. Admin UI (`/admin`)
- **Area layout.** Its own route group, `src/app/(admin)/admin/…`, with a minimal shell: the Orbi mark, "Admin", tabs, the account menu and "Back to my workspace". It does not load the creator's workspace.
- **Tabs:**
  - **Overview:** stat tiles (Users, Active 7d, Finished setup, Pending requests) and the onboarding funnel as horizontal bars (§6 chart rules).
  - **Requests:** pending first, with Approve and Reject (confirm dialog + toast); approved and rejected under a filter; the `access_open` switch.
  - **Users:** a table with search and a status filter; a row menu with Resend invite, Disable/Enable, Send password reset, Make/Remove admin and Delete (typed-email confirm); and an "Invite someone" dialog.
  - **Feedback:** newest first, with kind badges.
  - **Audit log.**
  - **Security:** 2-step verification.
- **Rules.** Follow §5: dense-but-calm, tokens only, empty states, loading and error states, confirm dialogs for destructive actions, toasts. Everything must work at 360px, and wide tables scroll inside `overflow-x-auto`.
- **Entry point.** For admins only, in Supabase mode: an "Admin" item in the account menu (top bar) and an ⌘K entry. It never appears in `NAV_SECTIONS` for everyone.
- **Language.** Every string goes through `defineMessages` (EN + Taglish) in `src/components/features/admin/messages.ts`. Admin data (emails, feedback text) stays as-is.

**Dev-only fixture, for screenshots and click-audits.** The dev server runs in local mode, where the real admin can't render. Add a development-only fixture:
- It is set with `localStorage["pbos:dev-admin"] = "fixture"`, read only when `process.env.NODE_ENV !== "production"`.
- The admin UI then talks to an in-memory fake implementing the same `adminApi` client interface, with a handful of fake requests, users, feedback and audit rows clearly named as samples.
- It must be impossible in production, and must never be shown to users. It's the same idea as the `pbos:dev-seed` QA seed.
- Add `--admin` to `scripts/smoke.mjs` to set it.

## 6. Privacy
- **Privacy notice.** Add a `/privacy` page (public, English + Taglish, simple language) that states only facts true of this implementation:
  - what's stored: the account, the workspace, access requests, feedback, opt-in usage events;
  - who can see what: the admin sees account metadata and counts, never content;
  - how to export or delete;
  - where the data is hosted: Supabase and Vercel.

  Mark it at the top in the source as a draft for the owner to review. Link it from the request form, login and signup.
- **Access-request storage.** Store no IP address in the clear. If you rate-limit by IP, store a salted hash, or skip IP entirely and rely on the per-email and global limits.

## 7. Docs
- **New `docs/ADMIN.md`** for the owner, non-developer friendly:
  1. make yourself admin (the SQL line);
  2. turn off Supabase signups;
  3. set up 2-step verification;
  4. approve a request;
  5. what admins can't see, and why.
- **Update:**
  - `docs/DEPLOY.md`: a new step after accounts work.
  - `docs/SUPABASE.md`: the migration table.
  - `docs/ARCHITECTURE.md`: the directory map, URL conventions (`/admin`, `/privacy`) and a short "§14 Admin & access" section with the rules above.

## Definition of done
- **Type-check and lint:** `npx tsc --noEmit -p .` is clean, and eslint is clean on changed files.
- **Tests:** `npx vitest run` passes in full, including:
  - PGlite tests for the admin migration: a user can't insert into `admin_users`; `is_admin()` is true and false correctly; anon and authenticated can't read `access_requests`; audit is append-only; admins can read feedback; parity passes.
  - Unit tests for `requireAdmin`, the proxy rule for `/api/access-requests`, every admin handler (including the self and last-admin guards) and the access-request validation and rate limits.
- **Screenshots:** of every admin tab using the dev fixture, in EN and TL, light desktop and 390px dark; the request-access form; and the local-mode `/admin` notice. Look at every one.
- **Audits:**
  - `node scripts/route-audit.mjs --only=/admin,/privacy,/signup,/login --seed=demo --modes=light,mobile` shows 0 failures.
  - `node scripts/click-audit.mjs /admin/users` (with the fixture) shows no dead buttons.
- **Regressions:** `node scripts/e2e-flow.mjs` and `node scripts/onboarding-flow.mjs` still pass.
- **Commit:** nothing committed; the lead reviews.

## Contract and ownership (two agents in parallel)
**Frozen contract, written by the lead.** Additive changes are fine. To rename or remove anything, ask the lead.
- `src/lib/admin/types.ts`: every API type, the route table, the error codes, the `AdminApi` client interface and `AdminGate`.
- `src/lib/admin/access-request.ts`: the public form's zod schema, shared by the form and the route.
- `src/lib/admin/gate.ts`: `getAdminGate()`. This is a **stub** until ADMIN-SERVER implements it; the signature is frozen.
- The `public.is_admin()` RPC, which returns a boolean for the signed-in user. The UI may call it through the browser client to decide whether to show the "Admin" entry.

**`server-only` package.** It is not installed. Don't import `"server-only"` unless `node_modules/next/dist/docs/` says Next 16 provides it; otherwise mark server modules by comment and file placement.

| Agent | Owns |
|---|---|
| **ADMIN-SERVER** | `supabase/migrations/20260918000000_admin.sql`<br>`src/lib/admin/**`, except that the three contract files are additive-only; implement `gate.ts`<br>`src/lib/supabase/admin.ts`<br>`src/app/api/admin/**` and `src/app/api/access-requests/**`<br>`src/components/features/auth/auth-paths.ts` + tests and `src/proxy.ts`: public `/privacy` and anonymous `POST /api/access-requests`<br>`src/lib/data/schema-parity.test.ts` (`SERVER_ONLY_TABLES`)<br>PGlite tests<br>docs: `ADMIN.md`, `DEPLOY.md`, `SUPABASE.md`, ARCHITECTURE §14, directory map and URL list |
| **ADMIN-UI** | `src/app/(admin)/**`<br>the `/privacy` page (`src/app/privacy/**` or a public route group)<br>`src/components/features/admin/**`: the HTTP `AdminApi` client, the dev-only fixture, the tabs and dialogs, 2-step verification UI, and `messages.ts`<br>the request-access form: `src/components/features/auth/signup-form.tsx`, `login-form.tsx`, a new `request-access-form.tsx`, auth `messages.ts`<br>the admin-only "Admin" entry in the app-shell account menu and ⌘K<br>`scripts/smoke.mjs` (`--admin`) |

**Coordination:**
- Until ADMIN-SERVER lands the routes, the UI works against the dev fixture. The HTTP client follows the route table in `types.ts` exactly.
- Keep every step compiling. A broken import breaks the dev server for every route.
