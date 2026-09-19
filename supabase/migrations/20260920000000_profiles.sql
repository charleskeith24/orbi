-- Orbi Profiles: a personal profile for every account — the person using Orbi, not the brand (Brand HQ).
-- docs/PROFILES.md for the brief, docs/ARCHITECTURE.md §16 for the rules.
--
-- What this migration does:
-- - public.users (20260910000000_init.sql) gets the profile fields: full_name stays the display name,
--   avatar_url now holds a STORAGE PATH in the private `avatars` bucket (never a URL), plus headline,
--   location, links and show_niche — each with CHECK limits.
-- - Nobody reads public.users directly except its owner (it holds the email). Other people's profiles are
--   read only through get_profiles(), which returns the safe columns — never the email — and only for
--   yourself and connected people (can_see_profile(): the ONE place that rule lives).
-- - Signed-in users may update only their profile columns on their own row (not email or id).
-- - Profile photos live in the private `avatars` bucket at <user_id>/<random>.webp (or .jpg). Storage
--   policies: write only inside your own folder; read yourself and connected people (the same rule).
--   Apps show photos through signed URLs; the admin server signs them with the secret key.
-- - Admins may remove a profile photo (moderation): audit action `profile_photo_removed`.
--
-- Deleting an account: Storage objects can't be removed from SQL (the Storage API owns the files), so
-- DELETE /api/admin/users/:id removes the account's photos through the Storage API before deleting it.
-- Accounts deleted in the Supabase dashboard leave their folder behind; docs/ADMIN.md has the cleanup.
-- Nobody but the secret key can read such a leftover (the owner shares no circle with anyone any more).
--
-- Conventions follow the earlier migrations: text + CHECK, comments, `set search_path = ''` on every
-- function, nothing for anon, and grants revoked first where Supabase grants by default.

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public.clean_profile_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- One line, trimmed, at most 80 characters.
  select btrim(left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]+', ' ', 'g')), 80));
$$;

comment on function public.clean_profile_name(text) is 'A display name as public.users.full_name stores it: control characters become spaces, trimmed, at most 80 characters. Internal (the sign-up triggers).';

revoke all on function public.clean_profile_name(text) from public, anon, authenticated, service_role;

create or replace function public.profile_links_valid(p_links jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Up to 6 entries of exactly {"platform", "value"}: platform is a PlatformId or "website"; value is an
  -- http(s) URL (at most 200 characters) or, for a platform, a handle without "@" (at most 64 characters).
  select case
    when p_links is null or jsonb_typeof(p_links) <> 'array' then false
    when jsonb_array_length(p_links) > 6 then false
    else not exists (
      select 1
        from jsonb_array_elements(p_links) as e (link)
       where case
               when jsonb_typeof(e.link) <> 'object' then true
               when (select count(*) from jsonb_object_keys(e.link)) <> 2 then true
               when jsonb_typeof(e.link -> 'platform') is distinct from 'string' then true
               when jsonb_typeof(e.link -> 'value') is distinct from 'string' then true
               when (e.link ->> 'platform') not in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads', 'website') then true
               when char_length(e.link ->> 'value') <= 200 and (e.link ->> 'value') ~ '^https?://[^[:space:][:cntrl:]<>"]+$' then false
               when (e.link ->> 'platform') <> 'website' and (e.link ->> 'value') ~ '^[A-Za-z0-9._-]{1,64}$' then false
               else true
             end
    )
  end;
$$;

comment on function public.profile_links_valid(jsonb) is 'CHECK for public.users.links: at most 6 {platform, value} entries; platform is a PlatformId or "website"; value an http(s) URL (≤ 200 chars) or a platform handle without "@" (≤ 64 chars of A–Z, 0–9, ".", "_", "-"). Mirrors src/lib/profiles/links.ts.';

-- The CHECK runs as whoever writes the row, so signed-in users and the server need EXECUTE.
revoke all on function public.profile_links_valid(jsonb) from public, anon;
grant execute on function public.profile_links_valid(jsonb) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- public.users: the profile fields
-- ----------------------------------------------------------------------------

-- Existing rows first, so the new CHECKs hold: names cleaned, and any avatar_url that isn't a path in
-- the avatars bucket (e.g. a URL copied from sign-up metadata) dropped.
update public.users set full_name = public.clean_profile_name(full_name) where full_name <> public.clean_profile_name(full_name);
update public.users set avatar_url = null
 where avatar_url is not null and avatar_url !~ ('^' || id::text || '/[A-Za-z0-9_-]{16,64}\.(webp|jpg)$');

alter table public.users add column headline text not null default '' check (char_length(headline) <= 160 and headline = btrim(headline) and headline !~ '[[:cntrl:]]');
alter table public.users add column location text not null default '' check (char_length(location) <= 80 and location = btrim(location) and location !~ '[[:cntrl:]]');
alter table public.users add column links jsonb not null default '[]'::jsonb check (public.profile_links_valid(links));
alter table public.users add column show_niche boolean not null default false;

alter table public.users add constraint users_full_name_check
  check (char_length(full_name) <= 80 and full_name = btrim(full_name) and full_name !~ '[[:cntrl:]]');
alter table public.users add constraint users_avatar_url_check
  check (avatar_url is null or avatar_url ~ ('^' || id::text || '/[A-Za-z0-9_-]{16,64}\.(webp|jpg)$'));

comment on table public.users is 'One row per account (created by trigger on auth.users): the email, and the person''s profile — display name, photo, headline, location, links, show_niche. Only its owner reads the row; other people read profiles through get_profiles(), which never returns the email.';
comment on column public.users.full_name is 'Profile display name (≤ 80 characters, one line). Empty until the person sets one; the app then falls back to the email''s local part for the owner only.';
comment on column public.users.avatar_url is 'Profile photo: a STORAGE PATH in the private avatars bucket, <user id>/<random>.webp|jpg — never a URL. Apps show it through signed URLs. Null = initials.';
comment on column public.users.headline is 'One-line headline or short bio (≤ 160 characters).';
comment on column public.users.location is 'City or province (≤ 80 characters).';
comment on column public.users.links is 'Social handles and links: up to 6 {"platform": PlatformId | "website", "value": handle or http(s) URL} (public.profile_links_valid).';
comment on column public.users.show_niche is 'Opt-in: get_profiles() shows Brand HQ''s niche and first main platform only when true.';

-- Signed-in users update only their profile columns (not email or id); the own-row policy still applies.
-- (updated_at is stamped by the set_updated_at trigger whatever is sent.)
revoke update on table public.users from authenticated;
grant update (full_name, avatar_url, headline, location, links, show_niche, updated_at) on table public.users to authenticated;

-- ----------------------------------------------------------------------------
-- The sign-up triggers: the profile is the person's own from now on
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- avatar_url stays null: it's a path in the avatars bucket, set only by the person's own upload.
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    public.clean_profile_name(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is 'Trigger: creates the public.users row when an auth user signs up (display name from sign-up metadata, cleaned; no photo).';

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The email follows Auth. The display name is the person's (Settings → Profile): metadata fills it only
  -- while it's empty, and the photo is never taken from metadata.
  update public.users as u
     set email = coalesce(new.email, ''),
         full_name = case
           when u.full_name = '' then public.clean_profile_name(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''))
           else u.full_name
         end
   where u.id = new.id;
  return new;
end;
$$;

comment on function public.handle_user_updated() is 'Trigger: keeps public.users.email in sync with auth.users; fills an empty display name from metadata. Never overwrites the profile.';

-- ----------------------------------------------------------------------------
-- can_see_profile(): who counts as "connected" — the one place this rule lives
-- ----------------------------------------------------------------------------

create or replace function public.can_see_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    -- Yourself.
    p_user_id = (select auth.uid())
    -- Someone who shares a circle with you (Collab Circles, 20260919000000_circles.sql).
    or exists (
      select 1
        from public.circle_members mine
        join public.circle_members theirs on theirs.circle_id = mine.circle_id
       where mine.user_id = (select auth.uid())
         and theirs.user_id = p_user_id
    ),
    -- Team workspaces (docs/TEAM_WORKSPACES.md) add "or shares a workspace with you" here.
    false
  );
$$;

comment on function public.can_see_profile(uuid) is 'True when the signed-in user may see p_user_id''s profile and photo: themselves, or someone who shares a circle with them. Used by get_profiles() and the avatars storage policy, so the rule lives in one place. Security definer so it can read circle_members of circles other than the caller''s own rows.';

revoke all on function public.can_see_profile(uuid) from public, anon, service_role;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- get_profiles(): other people's profiles, safe columns only
-- ----------------------------------------------------------------------------

create or replace function public.get_profiles(p_ids uuid[])
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  headline text,
  location text,
  links jsonb,
  niche text,
  main_platform text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Never the email. Niche and main platform (from that person's Brand HQ) only when they opted in.
  select u.id,
         u.full_name,
         u.avatar_url,
         u.headline,
         u.location,
         u.links,
         case when u.show_niche then nullif(btrim(left(btrim(bp.niche), 160)), '') end,
         case when u.show_niche then bp.main_platforms[1] end
    from public.users u
    left join public.brand_profiles bp on bp.user_id = u.id
   where u.id = any (coalesce(p_ids[1:200], '{}'::uuid[]))
     and public.can_see_profile(u.id)
   order by u.id;
$$;

comment on function public.get_profiles(uuid[]) is 'Profiles for up to 200 ids: id, display name, photo path, headline, location, links, and niche + main platform when show_niche. Only for yourself and connected people (can_see_profile); nothing for anyone else. Never returns the email.';

revoke all on function public.get_profiles(uuid[]) from public, anon, service_role;
grant execute on function public.get_profiles(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Storage: the private avatars bucket and its policies
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Writes: only inside your own folder, only <random>.webp|jpg.
create policy "Profile photos: upload into your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9_-]{16,64}\.(webp|jpg)$'));
create policy "Profile photos: replace your own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/'))
  with check (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9_-]{16,64}\.(webp|jpg)$'));
create policy "Profile photos: delete your own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/'));

-- Reads (signed URLs): yourself and connected people — can_see_profile(), the same rule as get_profiles().
create policy "Profile photos: visible to you and connected people" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and case
      when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then public.can_see_profile(split_part(name, '/', 1)::uuid)
      else false
    end
  );

-- ----------------------------------------------------------------------------
-- Admin audit: removing a profile photo (20260918000000_admin.sql)
-- ----------------------------------------------------------------------------

alter table public.admin_audit_log drop constraint admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (
  action in (
    'request_approved',
    'request_rejected',
    'user_invited',
    'invite_resent',
    'user_disabled',
    'user_enabled',
    'password_reset_sent',
    'user_deleted',
    'admin_granted',
    'admin_revoked',
    'settings_updated',
    'profile_photo_removed'
  )
);
