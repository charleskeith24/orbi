-- Orbi push reminders: one row per browser/device that turned on push notifications.
--
-- Server-only table (not part of the workspace model / TABLE_NAMES; listed in SERVER_ONLY_TABLES in
-- src/lib/data/schema-parity.test.ts).
--
-- Who writes what:
-- - POST /api/push/subscribe   (user session) → public.save_push_subscription(): claims the endpoint for
--   the signed-in user. A browser endpoint belongs to one account at a time, so re-subscribing after
--   switching accounts moves it.
-- - POST /api/push/unsubscribe (user session) → delete own rows.
-- - GET  /api/cron/reminders   (service role, SUPABASE_SECRET_KEY) → reads every subscription,
--   public.claim_push_reminder() before each send (idempotent: a reminder goes to a device at most
--   once, however often or concurrently the job runs), release_push_reminder() when a send fails
--   temporarily, and records the result (last_sent_at, failure_count, last_error). Subscriptions the
--   push service reports as gone (404/410) are deleted.
--
-- Conventions follow 20260910000000_init.sql: uuid ids, user_id -> auth.users (cascade, default
-- auth.uid()), CHECKs, comments, indexes, the updated_at trigger, RLS, nothing for anon.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  user_agent text not null default '' check (char_length(user_agent) <= 400),
  sent_keys text[] not null default '{}' check (cardinality(sent_keys) <= 200),
  last_sent_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error text not null default '' check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

comment on table public.push_subscriptions is 'Web push subscriptions for reminders (online version). One row per browser endpoint; users read and delete their own rows; the reminders cron job (service role) sends and records deliveries.';
comment on column public.push_subscriptions.endpoint is 'Push service URL from PushSubscription.endpoint (a secret capability URL). Unique: an endpoint belongs to one account.';
comment on column public.push_subscriptions.p256dh is 'PushSubscription keys.p256dh (base64url), used to encrypt payloads.';
comment on column public.push_subscriptions.auth is 'PushSubscription keys.auth (base64url), used to encrypt payloads.';
comment on column public.push_subscriptions.user_agent is 'Browser that subscribed, to tell devices apart.';
comment on column public.push_subscriptions.sent_keys is 'Most recent reminder keys delivered to this device (e.g. daily:2026-09-16, slot:<slot id>:2026-09-16), newest last, capped at 100. Makes the cron job idempotent.';
comment on column public.push_subscriptions.last_sent_at is 'When a reminder was last delivered to the push service for this device.';
comment on column public.push_subscriptions.failure_count is 'Consecutive failed sends (reset on success).';
comment on column public.push_subscriptions.last_error is 'Last send error (status and short message), empty after a success.';
comment on column public.push_subscriptions.created_at is 'When the device subscribed. Reminders due before this are never sent (no backlog).';

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push_subscriptions" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own push_subscriptions" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete their own push_subscriptions" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;

-- ----------------------------------------------------------------------------
-- save_push_subscription: subscribe this browser for the signed-in user
-- ----------------------------------------------------------------------------

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default ''
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_subscriptions as s (user_id, endpoint, p256dh, auth, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 400))
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    failure_count = 0,
    last_error = '',
    -- Same account: keep its history. Another account took over this browser: start fresh.
    sent_keys = case when s.user_id = excluded.user_id then s.sent_keys else '{}' end,
    last_sent_at = case when s.user_id = excluded.user_id then s.last_sent_at else null end,
    created_at = case when s.user_id = excluded.user_id then s.created_at else now() end
  returning s.id into v_id;
  return v_id;
end;
$$;

comment on function public.save_push_subscription(text, text, text, text) is 'Saves this browser''s push subscription for auth.uid(); an endpoint registered by another account moves to the caller (holding the endpoint proves the device).';

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- claim_push_reminder / release_push_reminder: idempotent delivery (service role only)
-- ----------------------------------------------------------------------------

create or replace function public.claim_push_reminder(p_subscription_id uuid, p_key text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.push_subscriptions
     set sent_keys = (array_append(sent_keys, p_key))[greatest(1, cardinality(sent_keys) + 1 - 99):]
   where id = p_subscription_id
     and not (p_key = any (sent_keys));
  return found;
end;
$$;

comment on function public.claim_push_reminder(uuid, text) is 'Marks reminder p_key as sent to a subscription. Returns true only for the first claim, so concurrent or repeated cron runs never send twice.';

create or replace function public.release_push_reminder(p_subscription_id uuid, p_key text)
returns void
language sql
set search_path = ''
as $$
  update public.push_subscriptions
     set sent_keys = array_remove(sent_keys, p_key)
   where id = p_subscription_id;
$$;

comment on function public.release_push_reminder(uuid, text) is 'Undoes a claim after a temporary send failure, so the next cron run retries while the reminder is still relevant.';

revoke all on function public.claim_push_reminder(uuid, text) from public, anon, authenticated;
revoke all on function public.release_push_reminder(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_push_reminder(uuid, text) to service_role;
grant execute on function public.release_push_reminder(uuid, text) to service_role;
