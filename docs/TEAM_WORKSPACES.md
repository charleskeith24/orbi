# Team workspaces — build brief

**Status:** approved by the user on 2026-09-19.

**What it is:** a creator (the **Owner**) invites people into their workspace, such as a VA or editor, a manager or a client.

**Roles (user's decision):**

| Role | Can do |
|---|---|
| **Owner** | Everything. One per workspace; it's the account the workspace belongs to. |
| **Editor** (VA / editor) | Read and write content work: ideas, hooks and angles, content items, briefs, scripts, pipeline, calendar, series, campaigns, stories, research, experiments, analytics logging, collabs. **Read-only** for Brand HQ, audience and pillars. |
| **Viewer** (manager / client) | Read-only everywhere they can see. |

**Money (user's decision):** `brand_deals`, `income_entries` and `rate_cards` are hidden from every member. The owner can turn on **Money access** for a specific member. That lets the member *see* Money, and edit it too if they're an Editor.

**Online version only.** Local mode has no accounts, so it shows an honest notice. It is the riskiest change so far: it touches row-level security on every workspace table. It runs **alone** (no parallel agents) and must be proven with PGlite tests before anything else.

## Non-negotiables
1. **No data leaks between workspaces.**
   - A person must only ever load rows of the workspace they are *in*.
   - The Supabase adapter currently selects `*` per table and relies on RLS to scope rows. Once someone is a member of another workspace, RLS will return **both** workspaces' rows.
   - Every load must therefore filter by the active workspace's owner id (`.eq("user_id", ownerId)`), and every insert must set `user_id` to the active workspace's owner id (not `auth.uid()`).
   - Deletes stay by id, protected by RLS.
2. **RLS is the real guard. The UI only mirrors it.**
   - Add a membership table and a `security definer` helper, e.g. `workspace_role(owner uuid) returns text` (`owner`/`editor`/`viewer`/null) plus `has_money_access(owner uuid)`, both with `set search_path = ''`.
   - Rewrite the policies of every workspace table in a **new migration** (`supabase/migrations/20260921000000_team.sql`, a DO-block loop over the table list is fine):
     - **select:** owner, or any member; money tables only with money access.
     - **insert / update / delete:** owner; editor on the editable tables (money tables only with money access); never viewers.
   - `brand_profiles` and `app_settings` are writable by the owner only.
   - Update `schema-parity.test.ts` to understand the new policies. It currently parses the init migration's RLS.
3. **Members can't escalate.**
   - Only the owner can create memberships, change roles and toggle Money access. Do this through RPCs, not direct table writes.
   - A member can leave. The owner can remove anyone.
   - Owner-ness is never a row a member can write.
4. **Personal preferences stay personal.**
   - UI language, Simple mode and reminders belong to the *person*, not the workspace they're visiting.
   - A member toggling the language must not change the owner's `app_settings`; RLS forbids it anyway.
   - Choose the smallest honest place for a member's personal prefs when they're in someone else's workspace (e.g. their own `app_settings`, loaded separately), and explain the choice.
   - Reminders and push go only to the owner of a workspace.
5. **Owner-only operations:**
   - Settings → Data: import, "start fresh", move local → cloud, export (the export contains Money);
   - Settings → Integrations and AI settings;
   - team management;
   - deleting the workspace.

   Members see these disabled, with an explanation.
6. **Admins still see counts only.** Nothing in §14 changes. Member counts per workspace may be added to the admin Users list as numbers only; this is optional.

## Profiles
Profiles ship first (docs/PROFILES.md). Team UI shows members through `get_profiles` and the shared avatar component: the members list, workspace switcher and the "You're in …" strip. Extend `get_profiles` so people who share a workspace can see each other's profile, in the single place that rule lives, with PGlite tests.

## Invites
- The owner invites by **email** from **Settings → Team** (a new tab).
- **Beta rule: the invitee must already have an Orbi account.** Accounts come only through the admin waitlist (§14). If there's no account, the UI says "Ask them to request access first", with the `/signup` link to share. Team invites never bypass admin approval.
- **Pending invites:**
  - An invite stays pending until the invitee accepts it in the app. They get a small banner/menu item: "Mika invited you to their workspace as Editor — Accept / Decline".
  - The same message appears whether or not the email has an account, so invites don't reveal who has an account. The owner-side UI may say "If they have an account, they'll see your invite."
- **Limits:** up to **5 members** per workspace during the beta.

## Using a shared workspace
- **Workspace switcher** in the account menu: "My workspace" plus each workspace you're a member of, showing the owner's brand name and your role.
  - Switching reloads the store from that workspace, and the choice is remembered per device.
  - A persistent, subtle **"You're in Mika's workspace · Editor"** strip keeps it obvious.
- **Role-aware UI.**
  - Viewers get read-only views: no create/edit/delete controls. Disabled controls explain "Viewers can't edit" instead of vanishing where that would confuse.
  - Editors see Brand HQ/Audience/Pillars read-only.
  - Money is hidden from navigation, ⌘K and Home cards unless the member has Money access.
  - Use one helper, e.g. `useWorkspaceRole()` / `can(action, table)`, backed by the same rules as RLS. Unit-test that helper against the RLS matrix.
- **Concurrent edits.** Writes are per-row, and last write wins. Reload the workspace when the tab regains focus after ≥ 2 minutes away, and give Settings → Team a manual "Refresh" action. Say honestly in docs/UI that two people editing the same item at once can overwrite each other. Realtime sync is a later step.
- **Onboarding.** A member landing in someone else's workspace never sees Quick setup for it. Their own workspace still has its own first run.

## Tests (must pass before UI work is considered done)
- **PGlite RLS matrix.** Cover owner, editor, viewer, editor with money access, and a non-member, across every workspace table:
  - select, insert, update and delete, including money tables, Brand HQ and settings;
  - a member can't write another workspace's rows or change their role;
  - removing a member revokes access immediately;
  - deleting the owner account cascades memberships.
- **Adapter tests.** Load filters by the active owner id; insert stamps the owner id; a member of two workspaces never mixes rows.
- **Permission helper tests** that mirror the RLS matrix.

## UI and docs
- **Settings → Team.** Members list (role, Money access, joined, remove), invite form, pending invites, "Leave workspace" for members.
- **Local mode** shows an honest notice. A dev-only fixture (`pbos:dev-team` = `fixture`, with the same production guard pattern as `features/admin/api/dev-fixture.ts`) is used for screenshots. Add `--team` to `smoke.mjs` and `click-audit.mjs`.
- **Strings.** English + Taglish via `defineMessages`. Works at 360px and in dark mode.
- **Docs:**
  - `docs/ARCHITECTURE.md`: a new "§16 Team workspaces" section, plus the necessary updates to §3 (the adapter scoping rule) and §14 (admins unchanged).
  - `docs/SUPABASE.md`: the migration table.
  - `docs/DEPLOY.md`: run the new migration.
  - `/privacy`: members of your workspace can see what their role allows; Money only with access.
  - `/terms`: you're responsible for who you invite.

## Definition of done
- **Checks:**
  - `npx tsc --noEmit -p .` is clean, and eslint is clean on changed files.
  - `npx vitest run` passes in full.
- **Screenshots** (EN + TL, light desktop + 390px dark, fixture):
  - Settings → Team (owner)
  - the invite dialog
  - a pending-invite banner
  - the workspace switcher
  - an Editor's view of Brand HQ (read-only) and of the sidebar with Money hidden
  - a Viewer's view of the Pipeline (no edit controls)
  - the local-mode notice

  Look at every one.
- **Route audit:** `node scripts/route-audit.mjs --seed=demo --lang=tl --modes=light,mobile` over all routes gives 0 failures. Local mode must be unchanged.
- **Flows:** `e2e-flow.mjs` and `onboarding-flow.mjs` pass.
- **Nothing committed.**
