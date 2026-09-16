-- Orbi beta toolkit: in-app feedback and opt-in usage analytics.
--
-- Server-only tables (not part of the workspace model / TABLE_NAMES; listed in
-- SERVER_ONLY_TABLES in src/lib/data/schema-parity.test.ts). Written by
-- POST /api/feedback and POST /api/events with the signed-in user's session, so
-- row-level security applies: a user can add rows for themselves and read their own
-- rows back. Nobody can update or delete through the API; the project owner reads
-- everything in the Supabase dashboard (SQL editor / Table editor bypass RLS).
-- docs/BETA_TEST.md has the queries for reading feedback and the onboarding funnel.
--
-- Conventions follow 20260910000000_init.sql: uuid ids, user_id -> auth.users
-- (cascade, default auth.uid()), enum-typed columns as text + CHECK, comments,
-- indexes, RLS on every table, nothing for anon.

-- ----------------------------------------------------------------------------
-- feedback: what beta testers tell us from the in-app Feedback dialog
-- ----------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'idea' check (kind in ('bug', 'idea', 'confusing', 'praise')),
  message text not null default '' check (char_length(message) between 1 and 4000),
  page text not null default '' check (char_length(page) <= 300),
  ui_language text not null default 'en' check (ui_language in ('en', 'tl')),
  app_version text not null default '' check (char_length(app_version) <= 40),
  viewport text not null default '' check (viewport in ('', 'mobile', 'tablet', 'desktop')),
  user_agent text not null default '' check (char_length(user_agent) <= 400),
  status text not null default 'new' check (status in ('new', 'reviewed', 'planned', 'done', 'wont_fix')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feedback is 'In-app feedback from the top-bar Feedback dialog (online version). Insert/select own rows; the owner triages in the dashboard.';
comment on column public.feedback.kind is 'bug | idea | confusing | praise — picked by the tester.';
comment on column public.feedback.page is 'Path the tester was on, without query string or hash, e.g. /ideas or /studio/<item id>.';
comment on column public.feedback.viewport is 'Screen size bucket when sent: mobile (<768px), tablet (<1024px) or desktop.';
comment on column public.feedback.status is 'Triage state for the project owner (dashboard only; the app never changes it).';

create index feedback_user_id_idx on public.feedback (user_id);
create index feedback_created_at_idx on public.feedback (created_at desc);
create index feedback_kind_status_idx on public.feedback (kind, status);

create trigger set_updated_at before update on public.feedback
  for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;

create policy "Users can view their own feedback" on public.feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own feedback" on public.feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on table public.feedback from anon;
grant select, insert on table public.feedback to authenticated;

-- ----------------------------------------------------------------------------
-- usage_events: opt-in, content-free product analytics (off by default)
-- ----------------------------------------------------------------------------

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (
    name in (
      'onboarding_step_viewed',
      'onboarding_step_completed',
      'onboarding_completed',
      'page_viewed',
      'idea_captured',
      'content_created',
      'post_published',
      'metrics_logged'
    )
  ),
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 2048),
  path text not null default '' check (char_length(path) <= 200),
  session_id text not null default '' check (char_length(session_id) <= 64),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.usage_events is 'Opt-in usage analytics (online version, off by default, per device). Event names and small enum props only — never titles, text or other personal content.';
comment on column public.usage_events.name is 'Event name from src/lib/telemetry/events.ts (CHECK list kept in sync).';
comment on column public.usage_events.props is 'Whitelisted, non-personal properties (step key, module, platform, stage, counts). Validated by /api/events.';
comment on column public.usage_events.path is 'Normalised path (ids replaced by [id], no query string), e.g. /studio/[id].';
comment on column public.usage_events.session_id is 'Random id per browser tab session — groups one visit; not linked to anything else.';
comment on column public.usage_events.occurred_at is 'When it happened in the browser (clamped by the API to the last 7 days); created_at is when it arrived.';

create index usage_events_user_id_idx on public.usage_events (user_id);
create index usage_events_name_occurred_at_idx on public.usage_events (name, occurred_at desc);
create index usage_events_occurred_at_idx on public.usage_events (occurred_at desc);

alter table public.usage_events enable row level security;

create policy "Users can view their own usage_events" on public.usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own usage_events" on public.usage_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on table public.usage_events from anon;
grant select, insert on table public.usage_events to authenticated;
