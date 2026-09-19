-- Orbi Collab Circles: small invite-only groups of creators (3–8 people) with a weekly check-in, streaks and
-- collab asks (docs/CIRCLES.md for the brief, docs/ARCHITECTURE.md §15 for the rules).
--
-- Server-only tables (they span users, so they are not part of the workspace model / TABLE_NAMES; listed
-- in SERVER_ONLY_TABLES in src/lib/data/schema-parity.test.ts). Row-level security is on for every one.
--
-- Privacy rules the SQL enforces:
-- - Nothing from a workspace is copied here. A check-in holds only what the member submitted: a number of
--   posts and an optional short note.
-- - Members read the circles they belong to — the circle, its members, check-ins, asks and interests.
--   Nobody else reads anything: not anon, not other signed-in users, not the server's secret key
--   (service_role has no grants), and there are no admin policies.
-- - circle_contacts has no grants and no policies at all. A member writes their own contact through
--   set_circle_contact() and reads contacts through circle_contact(), which answers only for yourself or
--   for a member linked to you by an accepted interest (either direction).
-- - Membership rows are the parent of everything a member wrote in a circle (composite foreign keys), so
--   leaving, being removed or deleting the account removes their check-ins, asks, interests and contact.
-- - Invite codes are random (244 bits) and only their SHA-256 is stored.
--
-- Conventions follow the earlier migrations: uuid ids, text + CHECK for enums, comments, indexes, RLS on
-- every table, nothing for anon. Supabase grants every new table and function to anon, authenticated and
-- service_role by default, so everything is revoked first and only what is used is granted back.

-- ----------------------------------------------------------------------------
-- circles
-- ----------------------------------------------------------------------------

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  created_by uuid references auth.users (id) on delete set null,
  invite_code_hash text not null check (invite_code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint circles_invite_code_hash_key unique (invite_code_hash)
);

comment on table public.circles is 'Collab Circles: small invite-only groups of creators (max 8 members). Members read their circles; every change goes through the circle functions below.';
comment on column public.circles.created_by is 'Who created the circle; null after that account is deleted. Ownership lives in circle_members.role.';
comment on column public.circles.invite_code_hash is 'SHA-256 (hex) of the current invite code. The code itself is never stored; rotate_invite() replaces it. Not readable by members (column grant).';

create index circles_created_by_idx on public.circles (created_by);

alter table public.circles enable row level security;

-- ----------------------------------------------------------------------------
-- circle_members
-- ----------------------------------------------------------------------------

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60 and display_name = btrim(display_name)),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

comment on table public.circle_members is 'Who is in which circle. Written by create_circle, join_circle, remove_member and leave_circle; a member may change only their own display_name. Deleting an account removes its memberships.';
comment on column public.circle_members.display_name is 'The name this member chose for this circle (not their account name).';
comment on column public.circle_members.role is 'owner | member. Exactly one owner per circle; when the owner leaves, the longest-standing member takes over.';

create index circle_members_user_id_idx on public.circle_members (user_id);
create unique index circle_members_one_owner_key on public.circle_members (circle_id) where (role = 'owner');

alter table public.circle_members enable row level security;

-- ----------------------------------------------------------------------------
-- is_circle_member(): is the signed-in user in this circle? (used by the policies)
-- ----------------------------------------------------------------------------

create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_circle_member(uuid) is 'True when auth.uid() is a member of the circle. Security definer so the circle policies can check membership without recursing into circle_members'' own policy.';

revoke all on function public.is_circle_member(uuid) from public, anon, service_role;
grant execute on function public.is_circle_member(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- circle_contacts: how to reach a member (never selectable)
-- ----------------------------------------------------------------------------

create table public.circle_contacts (
  circle_id uuid not null,
  user_id uuid not null,
  contact text not null check (char_length(contact) between 1 and 200 and contact = btrim(contact)),
  updated_at timestamptz not null default now(),
  primary key (circle_id, user_id),
  constraint circle_contacts_member_fkey foreign key (circle_id, user_id)
    references public.circle_members (circle_id, user_id) on delete cascade
);

comment on table public.circle_contacts is 'How to reach a member (e.g. "@mika on IG", an email), per circle. No grants and no policies: written through set_circle_contact(), read only through circle_contact() — yourself, or a member linked to you by an accepted interest.';

create trigger set_updated_at before update on public.circle_contacts
  for each row execute function public.set_updated_at();

alter table public.circle_contacts enable row level security;

-- ----------------------------------------------------------------------------
-- circle_checkins: the weekly check-in
-- ----------------------------------------------------------------------------

create table public.circle_checkins (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null,
  user_id uuid not null default auth.uid(),
  week_start date not null check (extract(isodow from week_start) in (1, 7)),
  posts integer not null check (posts between 0 and 50),
  note text not null default '' check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circle_checkins_week_key unique (circle_id, user_id, week_start),
  constraint circle_checkins_member_fkey foreign key (circle_id, user_id)
    references public.circle_members (circle_id, user_id) on delete cascade
);

comment on table public.circle_checkins is 'One check-in per member per week (upsert on circle_id, user_id, week_start). Holds only what the member submitted: a number of posts and an optional note.';
comment on column public.circle_checkins.week_start is 'First day of the member''s week (their week_starts_on: a Monday or a Sunday). Only the current or the previous week can be written.';
comment on column public.circle_checkins.posts is 'Posts published that week, as submitted by the member (pre-filled from their own workspace, editable).';

create index circle_checkins_circle_week_idx on public.circle_checkins (circle_id, week_start desc);

create trigger set_updated_at before update on public.circle_checkins
  for each row execute function public.set_updated_at();

alter table public.circle_checkins enable row level security;

-- ----------------------------------------------------------------------------
-- circle_asks: "who wants to do a joint Live about …?"
-- ----------------------------------------------------------------------------

create table public.circle_asks (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null,
  user_id uuid not null default auth.uid(),
  type text not null check (
    type in ('duet_stitch', 'guesting', 'joint_live', 'shoutout_swap', 'giveaway', 'co_created', 'group_brand_deal', 'other')
  ),
  text text not null check (char_length(text) between 1 and 500 and text = btrim(text)),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  constraint circle_asks_id_circle_key unique (id, circle_id),
  constraint circle_asks_member_fkey foreign key (circle_id, user_id)
    references public.circle_members (circle_id, user_id) on delete cascade
);

comment on table public.circle_asks is 'Collab asks posted to a circle. Members read them; the author edits or closes their own.';
comment on column public.circle_asks.type is 'The Collab tracker''s collab types (CollabType in src/lib/types.ts).';
comment on column public.circle_asks.status is 'open | closed (the author is done with it).';

create index circle_asks_circle_created_idx on public.circle_asks (circle_id, created_at desc);
create index circle_asks_member_idx on public.circle_asks (circle_id, user_id);

alter table public.circle_asks enable row level security;

-- ----------------------------------------------------------------------------
-- circle_ask_interests: "I'm interested", accepted by the ask's author
-- ----------------------------------------------------------------------------

create table public.circle_ask_interests (
  ask_id uuid not null,
  circle_id uuid not null,
  user_id uuid not null default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (ask_id, user_id),
  constraint circle_ask_interests_ask_fkey foreign key (ask_id, circle_id)
    references public.circle_asks (id, circle_id) on delete cascade,
  constraint circle_ask_interests_member_fkey foreign key (circle_id, user_id)
    references public.circle_members (circle_id, user_id) on delete cascade
);

comment on table public.circle_ask_interests is 'A member saying "I''m interested" in an ask. Accepted only by the ask''s author (accept_interest); an accepted interest is what lets the two see each other''s contact.';
comment on column public.circle_ask_interests.circle_id is 'The ask''s circle (kept in step by the foreign key to circle_asks), so leaving a circle removes the interests there.';
comment on column public.circle_ask_interests.status is 'pending | accepted.';

create index circle_ask_interests_member_idx on public.circle_ask_interests (circle_id, user_id);

alter table public.circle_ask_interests enable row level security;

-- ----------------------------------------------------------------------------
-- Grants and policies
-- ----------------------------------------------------------------------------

revoke all on table public.circles from anon, authenticated, service_role;
revoke all on table public.circle_members from anon, authenticated, service_role;
revoke all on table public.circle_contacts from anon, authenticated, service_role;
revoke all on table public.circle_checkins from anon, authenticated, service_role;
revoke all on table public.circle_asks from anon, authenticated, service_role;
revoke all on table public.circle_ask_interests from anon, authenticated, service_role;

-- circles: members read everything but the invite hash.
grant select (id, name, created_by, created_at) on table public.circles to authenticated;
create policy "Members can view their circles" on public.circles
  for select to authenticated using ((select public.is_circle_member(id)));

-- circle_members: members read each other; each member may rename themselves.
grant select on table public.circle_members to authenticated;
grant update (display_name) on table public.circle_members to authenticated;
create policy "Members can view their circle's members" on public.circle_members
  for select to authenticated using ((select public.is_circle_member(circle_id)));
create policy "Members can update their own membership" on public.circle_members
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- circle_checkins: members read the circle's check-ins; each writes their own, for this or last week only.
grant select, insert, update on table public.circle_checkins to authenticated;
create policy "Members can view their circle's check-ins" on public.circle_checkins
  for select to authenticated using ((select public.is_circle_member(circle_id)));
create policy "Members can insert their own check-ins" on public.circle_checkins
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (select public.is_circle_member(circle_id))
    and week_start between current_date - 13 and current_date + 1
  );
create policy "Members can update their own check-ins" on public.circle_checkins
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and (select public.is_circle_member(circle_id))
    and week_start between current_date - 13 and current_date + 1
  );

-- circle_asks: members read the circle's asks; each posts, edits and closes their own.
grant select, insert on table public.circle_asks to authenticated;
grant update (type, text, status) on table public.circle_asks to authenticated;
create policy "Members can view their circle's asks" on public.circle_asks
  for select to authenticated using ((select public.is_circle_member(circle_id)));
create policy "Members can post their own asks" on public.circle_asks
  for insert to authenticated with check (
    (select auth.uid()) = user_id and status = 'open' and (select public.is_circle_member(circle_id))
  );
create policy "Members can update their own asks" on public.circle_asks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- circle_ask_interests: members read the circle's interests; each says "I'm interested" in someone else's
-- open ask and may take a pending interest back. Accepting is accept_interest() (the author only).
grant select, insert, delete on table public.circle_ask_interests to authenticated;
create policy "Members can view their circle's interests" on public.circle_ask_interests
  for select to authenticated using ((select public.is_circle_member(circle_id)));
create policy "Members can show interest in others' open asks" on public.circle_ask_interests
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and (select public.is_circle_member(circle_id))
    -- (The foreign key to circle_asks (id, circle_id) keeps circle_id equal to the ask's circle.)
    and exists (
      select 1 from public.circle_asks a
       where a.id = ask_id and a.status = 'open' and a.user_id <> (select auth.uid())
    )
  );
create policy "Members can withdraw their own pending interest" on public.circle_ask_interests
  for delete to authenticated using ((select auth.uid()) = user_id and status = 'pending');

-- circle_contacts: nothing (see set_circle_contact / circle_contact).

-- ----------------------------------------------------------------------------
-- Invite codes (internal helpers)
-- ----------------------------------------------------------------------------

create or replace function public.circle_invite_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
$$;

comment on function public.circle_invite_hash(text) is 'SHA-256 (hex) of an invite code — what circles.invite_code_hash stores. Internal.';

create or replace function public.new_circle_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 32 random bytes from two v4 UUIDs (244 random bits, pg_strong_random), base64url without padding: 43 characters.
  select translate(
    encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
    '+/=',
    '-_'
  );
$$;

comment on function public.new_circle_invite_code() is 'A new random invite code (43 base64url characters, 244 random bits). Internal.';

revoke all on function public.circle_invite_hash(text) from public, anon, authenticated, service_role;
revoke all on function public.new_circle_invite_code() from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Leaving: hand the circle over, or delete it when nobody is left
-- ----------------------------------------------------------------------------

create or replace function public.circle_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The whole circle is being deleted: nothing to hand over.
  if not exists (select 1 from public.circles c where c.id = old.circle_id) then
    return null;
  end if;
  if not exists (select 1 from public.circle_members m where m.circle_id = old.circle_id) then
    delete from public.circles c where c.id = old.circle_id;
  elsif old.role = 'owner' and not exists (select 1 from public.circle_members m where m.circle_id = old.circle_id and m.role = 'owner') then
    update public.circle_members m
       set role = 'owner'
     where m.circle_id = old.circle_id
       and m.user_id = (
         select m2.user_id from public.circle_members m2 where m2.circle_id = old.circle_id order by m2.joined_at, m2.user_id limit 1
       );
  end if;
  return null;
end;
$$;

comment on function public.circle_members_after_delete() is 'Trigger: when the owner leaves (or their account is deleted), the longest-standing member becomes owner; when the last member leaves, the circle is deleted.';

revoke all on function public.circle_members_after_delete() from public, anon, authenticated, service_role;

create trigger circle_members_after_delete after delete on public.circle_members
  for each row execute function public.circle_members_after_delete();

-- ----------------------------------------------------------------------------
-- Circle functions (signed-in users; each checks auth.uid())
--
-- Errors are raised with a short code as the message (PostgREST passes it through as error.message):
-- not_signed_in, invalid_name, invalid_display_name, invalid_code, invalid_contact, too_many_circles,
-- circle_full, not_member, not_owner, last_owner, not_author, not_found.
-- ----------------------------------------------------------------------------

create or replace function public.create_circle(p_name text, p_display_name text)
returns table (circle_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_display text := btrim(coalesce(p_display_name, ''));
  v_code text := public.new_circle_invite_code();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if char_length(v_display) not between 1 and 60 then raise exception 'invalid_display_name'; end if;
  if (select count(*) from public.circle_members m where m.user_id = v_user) >= 10 then
    raise exception 'too_many_circles';
  end if;

  insert into public.circles (name, created_by, invite_code_hash)
  values (v_name, v_user, public.circle_invite_hash(v_code))
  returning id into v_id;
  insert into public.circle_members (circle_id, user_id, display_name, role) values (v_id, v_user, v_display, 'owner');

  return query select v_id, v_code;
end;
$$;

comment on function public.create_circle(text, text) is 'Creates a circle with the caller as owner and returns its id and invite code (shown once; only the hash is stored). At most 10 circles per person.';

create or replace function public.preview_invite(p_code text)
returns table (circle_id uuid, name text, members integer, is_member boolean, is_full boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{43}$' then return; end if;
  return query
    select c.id,
           c.name,
           (select count(*)::integer from public.circle_members m where m.circle_id = c.id),
           exists (select 1 from public.circle_members m where m.circle_id = c.id and m.user_id = auth.uid()),
           (select count(*) from public.circle_members m where m.circle_id = c.id) >= 8
      from public.circles c
     where c.invite_code_hash = public.circle_invite_hash(p_code);
end;
$$;

comment on function public.preview_invite(text) is 'What an invite link opens: the circle''s name and member count (no names, check-ins or asks), whether the caller is already in it and whether it is full. No row for an unknown or rotated code.';

create or replace function public.join_circle(p_code text, p_display_name text)
returns table (circle_id uuid, joined boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_display text := btrim(coalesce(p_display_name, ''));
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'invalid_code'; end if;

  -- Locks the circle so the member cap holds under concurrent joins.
  select c.id into v_id from public.circles c where c.invite_code_hash = public.circle_invite_hash(p_code) for update;
  if v_id is null then raise exception 'invalid_code'; end if;

  if exists (select 1 from public.circle_members m where m.circle_id = v_id and m.user_id = v_user) then
    return query select v_id, false;
    return;
  end if;
  if char_length(v_display) not between 1 and 60 then raise exception 'invalid_display_name'; end if;
  if (select count(*) from public.circle_members m where m.circle_id = v_id) >= 8 then raise exception 'circle_full'; end if;
  if (select count(*) from public.circle_members m where m.user_id = v_user) >= 10 then raise exception 'too_many_circles'; end if;

  insert into public.circle_members (circle_id, user_id, display_name, role) values (v_id, v_user, v_display, 'member');
  return query select v_id, true;
end;
$$;

comment on function public.join_circle(text, text) is 'Joins the circle an invite code belongs to. joined = false when the caller already is a member (nothing changes). Errors: invalid_code, circle_full (8 members), too_many_circles (10 per person).';

create or replace function public.rotate_invite(p_circle_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.new_circle_invite_code();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (
    select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  update public.circles c set invite_code_hash = public.circle_invite_hash(v_code) where c.id = p_circle_id;
  return v_code;
end;
$$;

comment on function public.rotate_invite(uuid) is 'Owner only: replaces the invite code (the old link stops working) and returns the new one.';

create or replace function public.remove_member(p_circle_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform 1 from public.circles c where c.id = p_circle_id for update;
  if not exists (
    select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  -- The owner is the only owner: they leave with leave_circle(), which hands the circle over.
  if exists (select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = p_user_id and m.role = 'owner') then
    raise exception 'last_owner';
  end if;
  delete from public.circle_members m where m.circle_id = p_circle_id and m.user_id = p_user_id;
  if not found then raise exception 'not_member'; end if;
end;
$$;

comment on function public.remove_member(uuid, uuid) is 'Owner only: removes a member (their check-ins, asks, interests and contact in this circle go with them). Never the owner (last_owner).';

create or replace function public.leave_circle(p_circle_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform 1 from public.circles c where c.id = p_circle_id for update;
  delete from public.circle_members m where m.circle_id = p_circle_id and m.user_id = auth.uid();
  if not found then raise exception 'not_member'; end if;
  -- circle_members_after_delete handed the circle over or deleted it.
  return case when exists (select 1 from public.circles c where c.id = p_circle_id) then 'left' else 'deleted' end;
end;
$$;

comment on function public.leave_circle(uuid) is 'Leaves a circle (everything the caller wrote there goes too). An owner hands the circle to the longest-standing member; the last member deletes it. Returns left | deleted.';

create or replace function public.accept_interest(p_ask_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.circle_asks a where a.id = p_ask_id and a.user_id = auth.uid()) then
    raise exception 'not_author';
  end if;
  update public.circle_ask_interests i set status = 'accepted' where i.ask_id = p_ask_id and i.user_id = p_user_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

comment on function public.accept_interest(uuid, uuid) is 'The ask''s author accepts a member''s interest; from then on both can read each other''s contact (circle_contact).';

create or replace function public.set_circle_contact(p_circle_id uuid, p_contact text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact text := btrim(coalesce(p_contact, ''));
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = auth.uid()) then
    raise exception 'not_member';
  end if;
  if char_length(v_contact) > 200 then raise exception 'invalid_contact'; end if;
  if v_contact = '' then
    delete from public.circle_contacts c where c.circle_id = p_circle_id and c.user_id = auth.uid();
  else
    insert into public.circle_contacts (circle_id, user_id, contact)
    values (p_circle_id, auth.uid(), v_contact)
    on conflict on constraint circle_contacts_pkey do update set contact = excluded.contact;
  end if;
end;
$$;

comment on function public.set_circle_contact(uuid, text) is 'Saves (or, when empty, removes) the caller''s own contact in a circle. The only way to write circle_contacts.';

create or replace function public.circle_contact(p_circle_id uuid, p_other_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.contact
    from public.circle_contacts c
   where c.circle_id = p_circle_id
     and c.user_id = p_other_user_id
     and exists (select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = (select auth.uid()))
     and (
       p_other_user_id = (select auth.uid())
       or exists (
         select 1
           from public.circle_ask_interests i
           join public.circle_asks a on a.id = i.ask_id and a.circle_id = i.circle_id
          where i.circle_id = p_circle_id
            and i.status = 'accepted'
            and (
              (a.user_id = (select auth.uid()) and i.user_id = p_other_user_id)
              or (a.user_id = p_other_user_id and i.user_id = (select auth.uid()))
            )
       )
     );
$$;

comment on function public.circle_contact(uuid, uuid) is 'A member''s contact — only your own, or that of a member linked to you by an accepted interest on an ask in this circle (either direction). Null otherwise, and null when they haven''t added one.';

revoke all on function public.create_circle(text, text) from public, anon, service_role;
revoke all on function public.preview_invite(text) from public, anon, service_role;
revoke all on function public.join_circle(text, text) from public, anon, service_role;
revoke all on function public.rotate_invite(uuid) from public, anon, service_role;
revoke all on function public.remove_member(uuid, uuid) from public, anon, service_role;
revoke all on function public.leave_circle(uuid) from public, anon, service_role;
revoke all on function public.accept_interest(uuid, uuid) from public, anon, service_role;
revoke all on function public.set_circle_contact(uuid, text) from public, anon, service_role;
revoke all on function public.circle_contact(uuid, uuid) from public, anon, service_role;

grant execute on function public.create_circle(text, text) to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.join_circle(text, text) to authenticated;
grant execute on function public.rotate_invite(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_circle(uuid) to authenticated;
grant execute on function public.accept_interest(uuid, uuid) to authenticated;
grant execute on function public.set_circle_contact(uuid, text) to authenticated;
grant execute on function public.circle_contact(uuid, uuid) to authenticated;
