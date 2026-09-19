# Collab Circles — build brief

**Status:** the user approved this on 2026-09-19. It is the first networking step after the single-player Collab tracker (docs/COLLABS.md).

**Goal:** small, invite-only groups of creators who know each other (3–8 people, e.g. the beta cohort or a barkada of creators) keep each other posting and find collab partners inside the group:
- a weekly check-in
- streaks
- "collab asks"

It works only in the **online version** (Supabase). Local mode shows an honest notice.

## Principles (non-negotiable)
- **Nothing from a creator's workspace leaves it automatically.** A check-in shares only what the member explicitly submits: a number of posts this week, computed from their own workspace and shown before they submit, plus an optional short note.
- **Contacts are revealed only after acceptance.** This was the user's decision.
  - Each member can store *how to reach them* (e.g. "@mika on IG", an email). Nobody can read it directly.
  - The contact appears to another member only after the author of a collab ask **accepts** that member's interest. Then both see each other's contact.
- **No in-app chat.** No engagement pods, no likes-for-likes, no public directory.
- **Invite-only, small, and easy to leave.**
  - Max 8 members.
  - The owner can rotate the invite link and remove members.
  - Anyone can leave.
  - Deleting an account removes their memberships (cascade).
- **Admins see counts only** (number of circles and members), never check-ins, asks or contacts.
- **Honest states everywhere:** local mode, not signed in, empty circle, and "you're the only member — share the invite link".

## Data (new migration `supabase/migrations/20260919000000_circles.sql`, server-side tables, RLS on)
These are **not** workspace tables, because they span users. List them in `SERVER_ONLY_TABLES` in `schema-parity.test.ts`. RLS is required.

| Table | Columns |
|---|---|
| `circles` | `id`, `name` (≤ 60), `created_by` (→ auth.users), `invite_code_hash`, `created_at` |
| `circle_members` | `circle_id`, `user_id`, `display_name` (≤ 60, chosen per circle), `role` (`owner`/`member`), `joined_at`; PK (`circle_id`, `user_id`); cascade on circle/user delete |
| `circle_contacts` | `circle_id`, `user_id`, `contact` (≤ 200); **no select policy**, read only through the RPC below |
| `circle_checkins` | `id`, `circle_id`, `user_id`, `week_start` (date, from the member's `week_starts_on`), `posts` (int 0–50), `note` (≤ 280), `created_at`; one per member per week (upsert) |
| `circle_asks` | `id`, `circle_id`, `user_id`, `type` (reuse the collab types), `text` (≤ 500), `status` (`open`/`closed`), `created_at` |
| `circle_ask_interests` | `ask_id`, `user_id`, `status` (`pending`/`accepted`), `created_at`; PK (`ask_id`, `user_id`) |

**Functions** (`security definer`, `set search_path = ''`, checked with `auth.uid()`):
- `is_circle_member(circle_id)`
- `create_circle(name, display_name)` → returns id + invite code
- `join_circle(code, display_name)` → validates the code hash, the member cap and "not already a member"
- `rotate_invite(circle_id)` → owner only
- `remove_member(circle_id, user_id)` → owner only, never the last owner
- `leave_circle(circle_id)` → an owner leaving hands the circle to the oldest member, or deletes it if they were alone
- `accept_interest(ask_id, user_id)` → author only
- `circle_contact(circle_id, other_user_id)` → returns the contact only when an accepted interest links the two users, in either direction

**Row-level security:**
- Members can select circles, members, check-ins, asks and interests of circles they belong to.
- Members insert or update only their own check-ins, asks, interests and contact.
- Nobody else can read anything.

Invite codes are random (≥ 128 bits) and stored hashed. The join URL is `/circles/join/<code>`, and signed-out visitors go through the normal `/login?next=`.

**Tests:** PGlite tests for every RLS rule and RPC. See `src/lib/admin/admin-migration.pglite.test.ts` and `src/lib/telemetry/beta-migration.pglite.test.ts` for the pattern.

## UI
- **`/circles`**
  - Your circles, as cards: name, members, this week's check-ins "4/6", your streak.
  - "Create a circle" dialog.
  - "Join with a link" dialog: paste the link or code.
- **`/circles/<id>`**
  - **This week:** your check-in card, with the pre-computed "You published N posts this week" (editable), a note, and "Check in / Mag-check in". Members' check-ins show as a compact list with streak flames. It's calm: no confetti, no leaderboard shaming. Sort by name, not by score.
  - **Collab asks:**
    - Post an ask (type + text).
    - Other members can say "I'm interested / Interesado ako".
    - The author accepts. After acceptance, both see each other's contact, and the author gets **"Add to Collabs"**, which creates a collab in *their own* workspace pre-filled from the ask (partner = member display name, type, notes). Use the Collab tracker's domain actions.
    - Close the ask when done.
  - **Members:**
    - display names, and your own contact field with an explanation of when it's shown;
    - owner-only: invite link copy/rotate and remove member;
    - "Leave circle".
- **Navigation.** Add "Circles" in the "Organize" section after Collabs (`simple: false`). The Collabs page header gets a link "Ask your circle" when the user is in a circle (online only).
- **Streak.** Consecutive weeks, ending with the current or previous week, in which the member checked in with `posts ≥ 1`. It's a pure function with tests.
- **Local mode:** an honest "Circles are part of the online version" notice, same pattern as `/admin`.
- **Dev-only fixture.** Use `localStorage["pbos:dev-circles"] = "fixture"` with the same production guard pattern as the admin fixture (`features/admin/api/dev-fixture.ts`), so the UI can be screenshotted on the local dev server. Add `--circles` to `scripts/smoke.mjs` and `click-audit.mjs`.
- **Design.** §5 design, EN + Taglish via `defineMessages`. It must work at 360px and in dark mode.

## Architecture
- Data access goes through a typed client (`CirclesApi`) with an HTTP or Supabase implementation plus the fixture, following the `features/admin/api/*` pattern.
- Prefer calling Supabase directly from the browser client with RLS and RPCs, rather than new API routes. Add API routes only if something truly needs the secret key; nothing in this design should.
- Update `docs/ARCHITECTURE.md` with a short "§15 Collab Circles" section. You own that section only; other agents are editing other files, so don't touch other sections.

## Definition of done
- **Checks:** `npx tsc --noEmit -p .` is clean, and eslint is clean on changed files.
- **Tests:** `npx vitest run` passes in full, including:
  - the PGlite RLS and RPC tests
  - streak tests
  - check-in pre-compute tests
  - "Add to Collabs" mapping tests
- **Screenshots:** EN + TL, light desktop + 390px dark, with the fixture:
  - the list
  - the detail page (check-in, asks with the accept flow, members)
  - the create and join dialogs
  - the local-mode notice

  Look at every one.
- **Route audit:** `route-audit --only=/circles,/collabs --seed=demo --lang=tl --modes=light,mobile` shows 0 failures.
- **Click audit:** `click-audit /circles --circles` shows no dead buttons.
- **Flows:** `e2e-flow.mjs` still passes.
- **Nothing committed.**
