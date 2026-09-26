-- ============================================================================
-- Server grants: exactly what the server's secret key (service_role) uses
-- ============================================================================
--
-- The earlier migrations grant `authenticated` explicitly on every table but left service_role to Supabase's
-- default privileges. Newer projects no longer hand those out: the admin Overview and Users counts, the public
-- Request access form (submit_access_request) and the reminders job failed with "permission denied". Older
-- projects hand out too much: every table, so the secret key could read everything. Like the admin, circles and
-- team migrations, this revokes everything from service_role first and grants back only what the server code
-- reads and writes. service_role bypasses row-level security, so these grants are its only limit.
--
-- The admin never sees a creator's content (docs/ADMIN.md, ARCHITECTURE.md §14):
-- - the two count functions become security definer, so the secret key gets numbers without any grant on
--   content tables (ideas, items, usage events);
-- - the column grants leave out every text a creator writes: brand fields, the profile's headline, location
--   and links, ideas, scripts. The reminders job reads its own columns only (a post's title goes into the
--   owner's own notification).
--
-- Safe to run more than once, on old and new projects alike: it always ends in the same grants.
-- src/lib/supabase/server-grants.pglite.test.ts runs every server query as service_role on a database without
-- default privileges, and checks what stays out of reach.

-- ----------------------------------------------------------------------------
-- Start from nothing: every table in public, except those whose own migration already grants service_role
-- exactly what it needs — the admin tables (20260918000000_admin.sql) and ai_keys (20260926000000_ai_keys.sql),
-- so running this file again later never takes the server's access to them away. Column grants go too:
-- revoking a table privilege revokes its column privileges, so running this file again ends in the same state.
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and c.relname not in ('admin_users', 'platform_settings', 'access_requests', 'admin_audit_log', 'ai_keys')
  loop
    execute format('revoke all on table public.%I from service_role', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- Admin → Overview and Users: counts only
-- ----------------------------------------------------------------------------

alter function public.admin_user_stats(uuid[], text[]) security definer;
alter function public.admin_onboarding_funnel() security definer;

-- "Finished setups" on the Overview (src/lib/admin/server/overview.ts).
grant select (id, onboarding_completed) on table public.brand_profiles to service_role;

-- ----------------------------------------------------------------------------
-- Admin → Feedback: written to the team, so it's readable in full
-- ----------------------------------------------------------------------------

grant select on table public.feedback to service_role;

-- ----------------------------------------------------------------------------
-- Accounts: email and display name (Admin → Users, Feedback), the photo path (moderation), and the email check
-- in submit_access_request(). Never headline, location, links or show_niche; never email updates.
-- ----------------------------------------------------------------------------

grant select (id, email, full_name, avatar_url) on table public.users to service_role;
grant update (avatar_url) on table public.users to service_role;

-- ----------------------------------------------------------------------------
-- Reminders job (src/lib/reminders/server/supabase-store.ts — the column lists there are these)
-- ----------------------------------------------------------------------------

grant select, update, delete on table public.push_subscriptions to service_role;
grant select (user_id, timezone, week_starts_on, weekly_post_target, ui_language,
              reminders_daily_enabled, reminders_daily_time, reminders_slot_enabled, reminders_slot_lead_minutes,
              reminders_review_enabled, reminders_review_day, reminders_review_time)
  on table public.app_settings to service_role;
grant select (id, user_id, day_of_week, label, platforms, time, is_active, sort_order)
  on table public.content_calendar to service_role;
grant select (id, user_id, title, stage, scheduled_at, due_date, published_at)
  on table public.content_items to service_role;
