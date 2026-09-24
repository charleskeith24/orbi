-- Orbi Team workspaces: a creator (the Owner) invites people into their workspace — a VA or editor, a
-- manager or a client (docs/TEAM_WORKSPACES.md for the brief, docs/ARCHITECTURE.md §17 for the rules).
--
-- This migration REWRITES row-level security on every workspace table. Until now a row belonged to one
-- account and every policy read `auth.uid() = user_id`. From here a workspace is still "every row with
-- user_id = <the owner's id>", but other accounts can be let into it with a role:
--
--   Owner   everything (the account the workspace belongs to; one per workspace)
--   Editor  reads everything they can see; writes the content work. Brand HQ, audience, pillars,
--           formats and settings stay read-only.
--   Viewer  read-only everywhere they can see.
--
--   Money   brand_deals, income_entries and rate_cards are invisible to members unless the owner turns
--           on Money access for that member; an Editor with access may also write them.
--
-- The rule lives in three security-definer helpers — workspace_role(), can_edit_workspace() and
-- has_money_access() — and the policies below are built from them in one loop, so there is exactly one
-- definition of each rule. src/lib/team/permissions.ts mirrors the same three table lists for the UI, and
-- src/lib/team/permissions.test.ts parses THIS FILE to prove the two never drift.
--
-- Cost note: the helpers take the row's user_id, so they run per row rather than once per query. The
-- Supabase adapter always narrows a load with `.eq("user_id", <active owner>)` (ARCHITECTURE §3), which
-- uses each table's user_id index, so the helper only ever runs for rows of one workspace.
--
-- Membership can never be written directly: workspace_members has no insert, update or delete grant, and
-- every change goes through a function that checks auth.uid(). Owner-ness is not a row at all — it is
-- `user_id = auth.uid()`, which nobody can forge.
--
-- Conventions follow the earlier migrations: text + CHECK for enums, comments on everything, indexes, RLS
-- on every table, nothing for anon, and the default grants Supabase hands out revoked first.

-- ----------------------------------------------------------------------------
-- workspace_members: who else is in a workspace
-- ----------------------------------------------------------------------------

create table public.workspace_members (
  owner_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  money_access boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, user_id),
  constraint workspace_members_not_owner_check check (owner_id <> user_id)
);

comment on table public.workspace_members is 'Team workspaces: the people the owner of a workspace (owner_id) has let in, with their role and whether they can see Money. The owner is never a row here — owning a workspace is user_id = auth.uid(). Written only by the workspace functions below (no insert/update/delete grant).';
comment on column public.workspace_members.owner_id is 'The workspace: every row of every workspace table with user_id = owner_id.';
comment on column public.workspace_members.role is 'editor (writes the content work) | viewer (read-only). Never "owner" — that is not a membership.';
comment on column public.workspace_members.money_access is 'Off by default: Money (brand deals, income, rate cards) is invisible to a member until the owner turns this on.';
comment on column public.workspace_members.joined_at is 'When the member accepted the invite.';

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create trigger set_updated_at before update on public.workspace_members
  for each row execute function public.set_updated_at();

alter table public.workspace_members enable row level security;

-- ----------------------------------------------------------------------------
-- workspace_invites: an invite by email, pending until the invitee answers
-- ----------------------------------------------------------------------------

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  role text not null check (role in ('editor', 'viewer')),
  money_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_invites_email_key unique (owner_id, email)
);

comment on table public.workspace_invites is 'Pending team invites, by email (stored lower-cased). The invitee sees theirs through my_workspace_invites() and answers with respond_to_invite(); the owner reads and cancels their own rows. An invite is stored whether or not that email has an account, so the owner never learns who is signed up.';
comment on column public.workspace_invites.email is 'The invited email, lower-cased and trimmed. Matched against the account email in my_workspace_invites().';
comment on column public.workspace_invites.role is 'The role the invitee gets when they accept.';
comment on column public.workspace_invites.money_access is 'Money access the invitee gets when they accept.';

create index workspace_invites_email_idx on public.workspace_invites (email);

create trigger set_updated_at before update on public.workspace_invites
  for each row execute function public.set_updated_at();

alter table public.workspace_invites enable row level security;

-- ----------------------------------------------------------------------------
-- Grants and policies for the two team tables
-- ----------------------------------------------------------------------------

revoke all on table public.workspace_members from anon, authenticated, service_role;
revoke all on table public.workspace_invites from anon, authenticated, service_role;

-- Members: the owner sees their whole team; a member sees only their own membership row (not the others').
grant select on table public.workspace_members to authenticated;
create policy "Workspace owners and members can view membership" on public.workspace_members
  for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = user_id);

-- Invites: only the owner reads and cancels their own. Creating and answering go through the functions.
grant select, delete on table public.workspace_invites to authenticated;
create policy "Workspace owners can view their invites" on public.workspace_invites
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Workspace owners can cancel their invites" on public.workspace_invites
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- ----------------------------------------------------------------------------
-- The three rules — the only place each one is written down
-- ----------------------------------------------------------------------------

create or replace function public.workspace_role(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_owner is null or (select auth.uid()) is null then null
    when p_owner = (select auth.uid()) then 'owner'
    else (select m.role from public.workspace_members m where m.owner_id = p_owner and m.user_id = (select auth.uid()))
  end;
$$;

comment on function public.workspace_role(uuid) is 'The signed-in user''s role in the workspace owned by p_owner: owner (it is their own), editor, viewer, or null when they are not in it. The one definition of "who is in this workspace"; mirrored for the UI by src/lib/team/permissions.ts.';

create or replace function public.can_edit_workspace(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.workspace_role(p_owner) in ('owner', 'editor');
$$;

comment on function public.can_edit_workspace(uuid) is 'True when the signed-in user may write the content tables of this workspace: its owner, or an editor. Viewers never write anything.';

create or replace function public.has_money_access(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_owner is null or (select auth.uid()) is null then false
    when p_owner = (select auth.uid()) then true
    else coalesce(
      (select m.money_access from public.workspace_members m where m.owner_id = p_owner and m.user_id = (select auth.uid())),
      false
    )
  end;
$$;

comment on function public.has_money_access(uuid) is 'True when the signed-in user may see this workspace''s Money (brand_deals, income_entries, rate_cards): its owner, or a member the owner gave Money access. Writing Money also needs can_edit_workspace().';

revoke all on function public.workspace_role(uuid) from public, anon, service_role;
revoke all on function public.can_edit_workspace(uuid) from public, anon, service_role;
revoke all on function public.has_money_access(uuid) from public, anon, service_role;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.can_edit_workspace(uuid) to authenticated;
grant execute on function public.has_money_access(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Row-level security on every workspace table, rebuilt from the three rules
--
-- The table lists below are the contract. src/lib/team/permissions.ts holds the same three lists and
-- src/lib/team/permissions.test.ts parses them out of this file, so adding a table to TABLE_NAMES
-- without placing it in exactly one group fails the test suite.
-- ----------------------------------------------------------------------------

do $$
declare
  -- Owner writes, every member reads: Brand HQ, goals, platforms, pillars, audience, formats, settings.
  owner_tables text[] := array[
    'brand_profiles',
    'app_settings',
    'content_goals',
    'content_platforms',
    'content_pillars',
    'content_formats',
    'audience_personas',
    'audience_problems',
    'audience_questions'
  ];
  -- Owner and Editor write, every member reads: the content work.
  editor_tables text[] := array[
    'angles',
    'hooks',
    'tags',
    'content_campaigns',
    'content_series',
    'content_ideas',
    'content_items',
    'content_briefs',
    'content_scripts',
    'content_calendar',
    'content_metrics',
    'content_experiments',
    'content_repurposing',
    'stories',
    'research_items',
    'content_tags',
    'weekly_reviews',
    'monthly_reviews',
    'ai_generations',
    'engagement_logs',
    'collabs'
  ];
  -- Money: invisible without Money access; Owner and Editor with access write.
  money_tables text[] := array[
    'brand_deals',
    'income_entries',
    'rate_cards'
  ];
  t text;
  p record;
  v_read text;
  v_write text;
begin
  foreach t in array owner_tables || editor_tables || money_tables loop
    -- Start from a clean slate: the per-user policies of 20260910000000_init.sql go.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    if t = any (money_tables) then
      v_read := 'public.has_money_access(user_id)';
      v_write := 'public.has_money_access(user_id) and public.can_edit_workspace(user_id)';
    elsif t = any (editor_tables) then
      v_read := 'public.workspace_role(user_id) is not null';
      v_write := 'public.can_edit_workspace(user_id)';
    else
      v_read := 'public.workspace_role(user_id) is not null';
      v_write := '(select auth.uid()) = user_id';
    end if;

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      'Workspace members can view ' || t, t, v_read
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      'Workspace writers can insert ' || t, t, v_write
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      'Workspace writers can update ' || t, t, v_write, v_write
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      'Workspace writers can delete ' || t, t, v_write
    );
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- Profiles: sharing a workspace makes two people "connected" (20260920000000_profiles.sql)
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
    )
    -- Someone who shares a workspace with you (Team workspaces): the owner of a workspace you're in,
    -- a member of a workspace you own, or another member of a workspace you're both in.
    or exists (
      select 1
        from public.workspace_members m
       where (m.owner_id = (select auth.uid()) and m.user_id = p_user_id)
          or (m.user_id = (select auth.uid()) and m.owner_id = p_user_id)
          or (
            m.user_id = (select auth.uid())
            and exists (
              select 1 from public.workspace_members other
               where other.owner_id = m.owner_id and other.user_id = p_user_id
            )
          )
    ),
    false
  );
$$;

comment on function public.can_see_profile(uuid) is 'True when the signed-in user may see p_user_id''s profile and photo: themselves, someone who shares a circle with them, or someone who shares a team workspace with them. Used by get_profiles() and the avatars storage policy, so the rule lives in one place.';

revoke all on function public.can_see_profile(uuid) from public, anon, service_role;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Workspace labels (internal): what a member sees in the switcher and in an invite
-- ----------------------------------------------------------------------------

create or replace function public.workspace_label(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- The brand name, else the creator's name, else the account's display name. Never the email.
  select coalesce(
    nullif(btrim(left(btrim(bp.brand_name), 80)), ''),
    nullif(btrim(left(btrim(bp.name), 80)), ''),
    nullif(btrim(u.full_name), ''),
    'Orbi workspace'
  )
    from public.users u
    left join public.brand_profiles bp on bp.user_id = u.id
   where u.id = p_owner;
$$;

comment on function public.workspace_label(uuid) is 'One short label for a workspace (brand name, else creator name, else display name). Internal: used by my_workspaces() and my_workspace_invites(), which a member or invitee is entitled to see. Never the email.';

revoke all on function public.workspace_label(uuid) from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Team functions (signed-in users; each checks auth.uid())
--
-- Limits: 5 members per workspace during the beta (invites count towards it), and at most 10 workspaces
-- a person can be a member of.
--
-- Errors are raised with a short code as the message (PostgREST passes it through as error.message):
-- not_signed_in, invalid_email, invalid_role, self_invite, already_member, workspace_full,
-- too_many_workspaces, not_member, not_found.
-- ----------------------------------------------------------------------------

create or replace function public.invite_to_workspace(p_email text, p_role text, p_money_access boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := btrim(coalesce(p_role, ''));
  v_money boolean := coalesce(p_money_access, false);
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if char_length(v_email) not between 3 and 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;
  if v_role not in ('editor', 'viewer') then raise exception 'invalid_role'; end if;
  if exists (select 1 from public.users u where u.id = v_user and lower(btrim(u.email)) = v_email) then
    raise exception 'self_invite';
  end if;

  -- Members and pending invites share the one seat count, so the beta limit can't be sidestepped by
  -- sending twenty invites. Re-inviting an email that is already pending takes no new seat.
  if (select count(*) from public.workspace_members m where m.owner_id = v_user)
     + (select count(*) from public.workspace_invites i where i.owner_id = v_user and i.email <> v_email)
     >= 5 then
    raise exception 'workspace_full';
  end if;

  -- The invite is stored whether or not that email has an account, so the owner never learns who is
  -- signed up; the UI says "If they have an account, they'll see your invite."
  insert into public.workspace_invites (owner_id, email, role, money_access)
  values (v_user, v_email, v_role, v_money)
  on conflict (owner_id, email) do update set role = excluded.role, money_access = excluded.money_access, updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.invite_to_workspace(text, text, boolean) is 'Invites an email into the caller''s own workspace as editor or viewer (re-inviting updates the role). Stored whether or not the email has an account. Errors: not_signed_in, invalid_email, invalid_role, self_invite, workspace_full.';

create or replace function public.my_workspace_invites()
returns table (owner_id uuid, workspace_name text, role text, money_access boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- Invites addressed to the signed-in account's own email. Nothing about other people's invites.
  select i.owner_id,
         public.workspace_label(i.owner_id),
         i.role,
         i.money_access,
         i.created_at
    from public.workspace_invites i
    join public.users me on me.id = (select auth.uid())
   where i.email = lower(btrim(me.email))
     and not exists (
       select 1 from public.workspace_members m where m.owner_id = i.owner_id and m.user_id = me.id
     )
   order by i.created_at;
$$;

comment on function public.my_workspace_invites() is 'The pending invites addressed to the signed-in account''s email: who invited them (workspace label, never the email), the role and whether Money access comes with it.';

create or replace function public.respond_to_invite(p_owner uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_invite public.workspace_invites%rowtype;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select lower(btrim(u.email)) into v_email from public.users u where u.id = v_user;
  if v_email is null then raise exception 'not_found'; end if;

  select * into v_invite from public.workspace_invites i where i.owner_id = p_owner and i.email = v_email;
  if not found then raise exception 'not_found'; end if;

  delete from public.workspace_invites i where i.id = v_invite.id;
  if not coalesce(p_accept, false) then return 'declined'; end if;

  -- Already in? Nothing to do (the invite is gone either way).
  if exists (select 1 from public.workspace_members m where m.owner_id = p_owner and m.user_id = v_user) then
    return 'accepted';
  end if;
  if (select count(*) from public.workspace_members m where m.owner_id = p_owner) >= 5 then
    raise exception 'workspace_full';
  end if;
  if (select count(*) from public.workspace_members m where m.user_id = v_user) >= 10 then
    raise exception 'too_many_workspaces';
  end if;

  insert into public.workspace_members (owner_id, user_id, role, money_access)
  values (p_owner, v_user, v_invite.role, v_invite.money_access);
  return 'accepted';
end;
$$;

comment on function public.respond_to_invite(uuid, boolean) is 'The invitee accepts or declines an invite addressed to their email; the invite row is removed either way. Accepting adds the membership with the role and Money access the owner chose — never a role the invitee picked. Errors: not_signed_in, not_found, workspace_full, too_many_workspaces.';

create or replace function public.set_workspace_member(p_user uuid, p_role text, p_money_access boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_role text := btrim(coalesce(p_role, ''));
begin
  if v_owner is null then raise exception 'not_signed_in'; end if;
  if v_role not in ('editor', 'viewer') then raise exception 'invalid_role'; end if;
  update public.workspace_members m
     set role = v_role, money_access = coalesce(p_money_access, false)
   where m.owner_id = v_owner and m.user_id = p_user;
  if not found then raise exception 'not_member'; end if;
end;
$$;

comment on function public.set_workspace_member(uuid, text, boolean) is 'The owner changes a member''s role and Money access in their OWN workspace (auth.uid() is always the owner_id, so no member can touch anyone''s role, including their own). Errors: not_signed_in, invalid_role, not_member.';

create or replace function public.remove_workspace_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
begin
  if v_owner is null then raise exception 'not_signed_in'; end if;
  delete from public.workspace_members m where m.owner_id = v_owner and m.user_id = p_user;
  if not found then raise exception 'not_member'; end if;
end;
$$;

comment on function public.remove_workspace_member(uuid) is 'The owner removes a member from their own workspace. Access stops the moment the row is gone. Errors: not_signed_in, not_member.';

create or replace function public.leave_workspace(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  delete from public.workspace_members m where m.owner_id = p_owner and m.user_id = v_user;
  if not found then raise exception 'not_member'; end if;
end;
$$;

comment on function public.leave_workspace(uuid) is 'A member leaves a workspace they were invited into. An owner never "leaves" their own workspace. Errors: not_signed_in, not_member.';

create or replace function public.my_workspaces()
returns table (owner_id uuid, workspace_name text, role text, money_access boolean, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- The workspaces the signed-in user was invited into. Their own workspace is not a membership.
  select m.owner_id, public.workspace_label(m.owner_id), m.role, m.money_access, m.joined_at
    from public.workspace_members m
   where m.user_id = (select auth.uid())
   order by m.joined_at;
$$;

comment on function public.my_workspaces() is 'Every workspace the signed-in user is a member of, with its label, their role, Money access and when they joined — what the workspace switcher shows.';

revoke all on function public.invite_to_workspace(text, text, boolean) from public, anon, service_role;
revoke all on function public.my_workspace_invites() from public, anon, service_role;
revoke all on function public.respond_to_invite(uuid, boolean) from public, anon, service_role;
revoke all on function public.set_workspace_member(uuid, text, boolean) from public, anon, service_role;
revoke all on function public.remove_workspace_member(uuid) from public, anon, service_role;
revoke all on function public.leave_workspace(uuid) from public, anon, service_role;
revoke all on function public.my_workspaces() from public, anon, service_role;
grant execute on function public.invite_to_workspace(text, text, boolean) to authenticated;
grant execute on function public.my_workspace_invites() to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;
grant execute on function public.set_workspace_member(uuid, text, boolean) to authenticated;
grant execute on function public.remove_workspace_member(uuid) to authenticated;
grant execute on function public.leave_workspace(uuid) to authenticated;
grant execute on function public.my_workspaces() to authenticated;
