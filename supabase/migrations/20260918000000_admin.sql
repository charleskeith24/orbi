-- Orbi admin & access: the platform admin role, the "Request access" waitlist, the admin audit log and
-- platform settings (docs/ADMIN.md for the owner, docs/ARCHITECTURE.md §14 for the rules).
--
-- Server-only tables (not part of the workspace model / TABLE_NAMES; listed in SERVER_ONLY_TABLES in
-- src/lib/data/schema-parity.test.ts). Row-level security is on for every one of them.
--
-- Who reads and writes what:
-- - admin_users        Written only by the server with the secret key (Admin → Users → Make admin) or in
--                      the SQL editor (the first admin). Signed-in users have no grants and no policies on
--                      it, so nobody can make themselves admin. The role never lives on public.users:
--                      users may update their own row there.
-- - public.is_admin()  Whether the signed-in user is an admin. Callable by signed-in users; the app uses
--                      it to decide whether to show the Admin entry. The admin area itself also requires
--                      2-step verification (AAL2), checked by the server.
-- - access_requests    The public "Request access" form → POST /api/access-requests (secret key) →
--                      public.submit_access_request(), which applies the limits in one transaction.
--                      No access at all for anon or signed-in users. No IP addresses are stored.
-- - admin_audit_log    One row per admin action, inserted by the server. Append-only: no update or delete
--                      grant for anyone, not even the secret key (only the dashboard can edit it).
--                      Admins with 2-step verification can read it.
-- - platform_settings  One row: access_open ("accepting requests"). Read and written by the server.
-- - feedback, usage_events (20260914000100_beta.sql): admins with 2-step verification can read every row.
--                      Users keep their own-row policies.
--
-- The admin never sees a creator's content: the admin_* functions below return counts only.
--
-- Conventions follow 20260910000000_init.sql: uuid ids, text + CHECK for enums, comments, indexes,
-- RLS on every table, nothing for anon. Supabase grants every new table to anon, authenticated and
-- service_role by default, so each table revokes everything first and grants back only what is used.

-- ----------------------------------------------------------------------------
-- admin_users: who can open /admin
-- ----------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is 'Platform admins (the owner and anyone they promote). Server-only: no policies or grants for signed-in users, so the role cannot be self-granted. First admin: insert into public.admin_users (user_id) select id from auth.users where email = ''you@example.com'';';
comment on column public.admin_users.granted_by is 'The admin who granted the role; null for the first admin (added in the SQL editor).';

create index admin_users_granted_by_idx on public.admin_users (granted_by);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated, service_role;
grant select, insert, delete on table public.admin_users to service_role;

-- ----------------------------------------------------------------------------
-- is_admin(): is the signed-in user an admin?
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;

comment on function public.is_admin() is 'True when auth.uid() is in admin_users. Security definer because signed-in users cannot read admin_users. It does not check 2-step verification; policies that grant admins access also require aal2.';

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- platform_settings: one row of switches the admin controls
-- ----------------------------------------------------------------------------

create table public.platform_settings (
  id boolean primary key default true check (id),
  access_open boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is 'Singleton (id is always true): platform-wide switches set in Admin → Requests. Server-only.';
comment on column public.platform_settings.access_open is 'Whether the public "Request access" form accepts new requests. When false, /signup says requests are closed and the endpoint answers 403 closed.';

insert into public.platform_settings (id) values (true);

create trigger set_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

revoke all on table public.platform_settings from anon, authenticated, service_role;
grant select, update on table public.platform_settings to service_role;

-- ----------------------------------------------------------------------------
-- access_requests: the waitlist
-- ----------------------------------------------------------------------------

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  name text not null check (char_length(name) between 1 and 120),
  about text not null default '' check (char_length(about) <= 300),
  link text not null default '' check (link = '' or (char_length(link) <= 500 and link ~* '^https?://[^[:space:]]+$')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decided_by_email text check (char_length(decided_by_email) <= 254),
  constraint access_requests_decision_check check ((status = 'pending') = (decided_at is null))
);

comment on table public.access_requests is 'Waitlist entries from the public "Request access" form. Server-only (secret key): no access for anon or signed-in users. No IP addresses are stored.';
comment on column public.access_requests.email is 'Lower-cased. At most one pending request per email (access_requests_pending_email_key).';
comment on column public.access_requests.about is '"What do you create?" — optional, at most 300 characters.';
comment on column public.access_requests.link is 'Optional http(s) link to the person''s page.';
comment on column public.access_requests.status is 'pending | approved (invite sent) | rejected (no email is sent).';
comment on column public.access_requests.decided_by is 'The admin who approved or rejected it.';
comment on column public.access_requests.decided_by_email is 'That admin''s email when they decided, so the list stays readable after an admin account is deleted.';

create unique index access_requests_pending_email_key on public.access_requests (email) where (status = 'pending');
create index access_requests_status_created_at_idx on public.access_requests (status, created_at desc);
create index access_requests_created_at_idx on public.access_requests (created_at desc);
create index access_requests_decided_by_idx on public.access_requests (decided_by);

alter table public.access_requests enable row level security;

revoke all on table public.access_requests from anon, authenticated, service_role;
grant select, insert, update on table public.access_requests to service_role;

-- ----------------------------------------------------------------------------
-- submit_access_request: store a request, enforcing the limits atomically (server only)
-- ----------------------------------------------------------------------------

create or replace function public.submit_access_request(
  p_email text,
  p_name text,
  p_about text default '',
  p_link text default '',
  p_max_per_hour integer default 30
) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  -- One submission at a time, so the limits below hold under concurrent requests.
  perform pg_advisory_xact_lock(hashtext('public.submit_access_request'));

  if not coalesce((select s.access_open from public.platform_settings s where s.id), true) then
    return 'closed';
  end if;
  if (select count(*) from public.access_requests r where r.created_at > now() - interval '1 hour') >= p_max_per_hour then
    return 'rate_limited';
  end if;
  -- Already has an account, or already waiting: nothing to store. The caller answers the same either way.
  if exists (select 1 from public.users u where lower(u.email) = v_email) then
    return 'exists';
  end if;
  if exists (select 1 from public.access_requests r where r.email = v_email and r.status = 'pending') then
    return 'duplicate';
  end if;

  insert into public.access_requests (email, name, about, link)
  values (v_email, btrim(coalesce(p_name, '')), btrim(coalesce(p_about, '')), btrim(coalesce(p_link, '')));
  return 'created';
end;
$$;

comment on function public.submit_access_request(text, text, text, text, integer) is 'Stores a waitlist request unless requests are closed (closed), the hourly limit is reached (rate_limited), the email already has an account (exists) or a pending request (duplicate); returns created on success. Serialized by an advisory lock. Service role only.';

revoke all on function public.submit_access_request(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.submit_access_request(text, text, text, text, integer) to service_role;

-- ----------------------------------------------------------------------------
-- admin_audit_log: what admins did (append-only)
-- ----------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  admin_email text not null default '' check (char_length(admin_email) <= 254),
  action text not null check (
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
      'settings_updated'
    )
  ),
  target_user_id uuid,
  target_email text check (char_length(target_email) <= 254),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 1024),
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is 'One row per admin action (approve, invite, disable, delete, grant admin, settings…). Inserted by the server; append-only (no update or delete grants, not even for the secret key). Admins with 2-step verification can read it.';
comment on column public.admin_audit_log.admin_id is 'The admin who acted. No foreign key: the log outlives deleted accounts.';
comment on column public.admin_audit_log.admin_email is 'The admin''s email at the time, so the log stays readable after the account is deleted.';
comment on column public.admin_audit_log.action is 'ADMIN_AUDIT_ACTIONS in src/lib/admin/types.ts (CHECK list kept in sync).';
comment on column public.admin_audit_log.target_user_id is 'The account acted on, if any. No foreign key: deleted accounts stay in the log.';
comment on column public.admin_audit_log.target_email is 'The account or request email acted on, if any.';
comment on column public.admin_audit_log.details is 'Small, content-free facts, e.g. {"from": "active", "to": "disabled"}. Never a creator''s content.';

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc, id desc);
create index admin_audit_log_target_user_id_idx on public.admin_audit_log (target_user_id);

alter table public.admin_audit_log enable row level security;

create policy "Admins can view the audit log" on public.admin_audit_log
  for select to authenticated using ((select public.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2');

revoke all on table public.admin_audit_log from anon, authenticated, service_role;
grant select on table public.admin_audit_log to authenticated;
grant select, insert on table public.admin_audit_log to service_role;

-- ----------------------------------------------------------------------------
-- Admin read access to feedback and usage events (20260914000100_beta.sql)
-- ----------------------------------------------------------------------------

create policy "Admins can view all feedback" on public.feedback
  for select to authenticated using ((select public.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2');
create policy "Admins can view all usage_events" on public.usage_events
  for select to authenticated using ((select public.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- ----------------------------------------------------------------------------
-- revoke_admin: remove an admin, never the last one (server only)
-- ----------------------------------------------------------------------------

create or replace function public.revoke_admin(p_user_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  -- Serialized, so two admins removing each other at the same moment can't leave nobody in charge.
  perform pg_advisory_xact_lock(hashtext('public.admin_users'));
  if not exists (select 1 from public.admin_users a where a.user_id = p_user_id) then
    return 'not_admin';
  end if;
  if (select count(*) from public.admin_users) <= 1 then
    return 'last_admin';
  end if;
  delete from public.admin_users a where a.user_id = p_user_id;
  return 'revoked';
end;
$$;

comment on function public.revoke_admin(uuid) is 'Removes p_user_id from admin_users unless it is the last admin. Returns revoked | not_admin | last_admin. Service role only.';

revoke all on function public.revoke_admin(uuid) from public, anon, authenticated;
grant execute on function public.revoke_admin(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- admin_user_stats / admin_onboarding_funnel: counts only (server only)
-- ----------------------------------------------------------------------------

create or replace function public.admin_user_stats(p_user_ids uuid[], p_published_stages text[])
returns table (user_id uuid, onboarding_completed boolean, ideas integer, content_items integer, published integer)
language sql
stable
set search_path = ''
as $$
  select u.id,
         coalesce((select bp.onboarding_completed from public.brand_profiles bp where bp.user_id = u.id limit 1), false),
         (select count(*)::integer from public.content_ideas i where i.user_id = u.id),
         (select count(*)::integer from public.content_items c where c.user_id = u.id),
         (select count(*)::integer from public.content_items c where c.user_id = u.id and c.stage = any (p_published_stages))
    from unnest(p_user_ids) as u (id);
$$;

comment on function public.admin_user_stats(uuid[], text[]) is 'Admin → Users: per account, whether setup is finished and how many ideas, content items and published items it has. Counts only — never titles or text. Service role only.';

revoke all on function public.admin_user_stats(uuid[], text[]) from public, anon, authenticated;
grant execute on function public.admin_user_stats(uuid[], text[]) to service_role;

create or replace function public.admin_onboarding_funnel()
returns table (step text, step_index integer, viewed integer, completed integer)
language sql
stable
set search_path = ''
as $$
  select e.props ->> 'step',
         min(case when e.props ->> 'index' ~ '^[0-9]{1,6}$' then (e.props ->> 'index')::integer end),
         (count(distinct e.user_id) filter (where e.name = 'onboarding_step_viewed'))::integer,
         (count(distinct e.user_id) filter (where e.name = 'onboarding_step_completed'))::integer
    from public.usage_events e
   where e.name in ('onboarding_step_viewed', 'onboarding_step_completed')
     and coalesce(e.props ->> 'step', '') <> ''
   group by 1
   order by 2 nulls last, 1;
$$;

comment on function public.admin_onboarding_funnel() is 'Admin → Overview: distinct people who viewed and completed each onboarding step, from opt-in usage events (so it undercounts). Counts only. Service role only.';

revoke all on function public.admin_onboarding_funnel() from public, anon, authenticated;
grant execute on function public.admin_onboarding_funnel() to service_role;
