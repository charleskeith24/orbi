# Profiles — build brief

**Status:** approved by the user on 2026-09-19.

**What:** every account gets a personal profile. The profile belongs to the **person** using Orbi, which is different from Brand HQ, the brand. The difference matters for team workspaces, where a VA signs in as themselves.

**Fields (user's choice):**
- Profile photo
- Display name
- Headline / short bio: one line, ≤ 160 characters
- Location: city/province, ≤ 80 characters
- Social handles and links: up to 6 entries of platform (`PlatformId` or `website`) plus handle or URL
- An opt-in **"Show my niche and main platform"**, taken from Brand HQ

**Visibility (user's choice): connected people only.**
- Members of a circle you're in see your full profile. Team members get the same when team workspaces ship.
- Admins see **name and photo only**.
- There is **no public profile page**; that's for after the beta.
- Email is never part of a profile.

## Online version (Supabase)
- **Data:** new migration `supabase/migrations/20260920000000_profiles.sql`.
  - Extend `public.users`, which already has `full_name` and `avatar_url`. Keep `full_name` as the display name. `avatar_url` holds the **storage path**, not a public URL.
  - Add `headline`, `location`, `links` (jsonb, validated), and `show_niche boolean default false`, each with CHECK limits.
  - Users can already update their own row; keep that. Make sure nobody else can select `public.users` directly, because it contains `email`.
- **Read other people's profiles:** a `security definer` RPC `get_profiles(ids uuid[])` with `set search_path = ''`. It returns only the safe columns: id, display name, avatar path, headline, location, links, and niche plus main platform only when `show_niche`, read from that user's `brand_profiles`. It returns them only for:
  - yourself;
  - people who share a circle with you (`is_circle_member` logic).

  Structure it so team workspaces can add "shares a workspace" in one place.
  - **Never** return email.
  - PGlite tests prove all of this, including that a non-connected user gets nothing.
- **Photos:** a **private** Supabase Storage bucket `avatars`, created in the migration with `public = false`, a file size limit of about 1 MB, and image mime types only.
  - Objects live at `avatars/<user_id>/<random>.webp`.
  - Storage RLS on `storage.objects`: insert, update and delete only inside your own folder. Select for yourself and for connected people (the same rule as `get_profiles`).
  - Clients show photos through **signed URLs** (about 1 hour), cached per session. Admins get signed URLs server-side with the secret key.
  - Deleting an account removes its photos. Use a trigger, or document the cleanup if storage can't cascade.
  - Test storage policies in PGlite if the storage schema can be stubbed, as the auth schema is. Otherwise document a manual test in `docs/ADMIN.md` or DEPLOY.md and say so.
- **Admins:**
  - The Users list shows the photo and display name.
  - Admins can **remove a profile photo** (moderation). This means a new audit action `profile_photo_removed`: add it to `ADMIN_AUDIT_ACTIONS` in `src/lib/admin/types.ts` and to the audit CHECK list in a migration, plus a route `DELETE /api/admin/users/:id/photo` behind `withAdmin`, with tests.
  - Contract changes stay additive.

## Photo upload (both modes)
- Accept JPG, PNG and WebP up to 5 MB, and HEIC only if the browser can decode it; otherwise explain.
- The creator crops to a square: a simple centered crop with zoom/pan is enough. Resize to 512×512 and re-encode as **WebP**, falling back to JPEG, **in the browser**.
- Re-encoding through a canvas **strips EXIF, including GPS location**. Say so in the UI: "We remove hidden location data from your photo."
- Show clear states: uploading (spinner), success (toast), error (message + retry).
- "Remove photo" goes back to initials.

## Local mode
- There are no accounts. The Profile tab still works for this device only: name and photo are stored in this browser's localStorage (`pbos:local-profile`), with the photo as a small WebP data URL of about 60 KB or less. They're used in the account menu and, optionally, the media kit.
- An honest note says: "In the online version your profile is saved to your account and shown to your circles and team."
- In local mode the other fields (headline, location, links, niche) are editable but only used on this device. Keep it simple.

## Where profiles appear
- **Settings → Profile**, a new tab `profile`: the editor, a live preview card ("How your circles see you"), and a visibility explainer. Update `settingsHref` / the tabs list.
- **Account menu (top bar):** photo and display name.
- **Circles:**
  - Members, check-ins and asks show the photo.
  - Clicking a member opens a small profile card: headline, location, links, and niche if shown.
  - The per-circle `display_name` stays, defaulting to the profile name.
- **Admin → Users:** photo, name, and the "Remove profile photo" action.
- **Media kit (optional):** "Use my profile photo in the media kit" if that's a small change in `features/money/media-kit-*`. Otherwise skip it and say so.
- **Team workspaces (next feature):** they'll reuse `get_profiles` and the avatar component. Build a shared `<ProfileAvatar>` / `useProfiles(ids)` in `src/components/common/` or `features/profile/` for that.

## Privacy and Terms
- **`/privacy`:** add a "Your profile" entry covering:
  - what's stored;
  - who sees it (connected people; admins see name and photo);
  - that photos are private and shown through expiring links;
  - that location data is removed from photos;
  - how to remove it.
- **`/terms`:** your photo and profile must be yours and appropriate, and admins may remove a photo.

## Definition of done
- **Checks:** `npx tsc --noEmit -p .` is clean, and eslint is clean on changed files.
- **Tests:** `npx vitest run` passes in full, including:
  - PGlite tests for `get_profiles`: self and circle-mate get the safe fields, a stranger gets nothing, and email is never returned;
  - the new column CHECKs;
  - storage policies, if stubbable;
  - validation for links and lengths;
  - the pure crop/resize math;
  - the admin photo-removal route and its audit row.
- **Screenshots**, in English and Taglish, light desktop and 390px dark. Use the dev fixtures (`--circles`, `--admin`) where the online version is needed.
  - Settings → Profile: empty, filled, the uploading state and an error.
  - The account menu with a photo.
  - A circle's member list and profile card.
  - Admin Users with photos and the remove action.
  - The local-mode note.

  Look at every one.
- **Audits:** `node scripts/route-audit.mjs --seed=demo --lang=tl --modes=light,mobile` over all routes gives 0 failures, and `click-audit` on `/settings?tab=profile` finds no dead buttons.
- **Flows:** `e2e-flow.mjs` and `onboarding-flow.mjs` pass.
- **Commit:** nothing is committed.
