-- Personal Brand Content OS: initial schema
--
-- Mirrors src/lib/types.ts exactly (snake_case columns, one table per `Database` key).
-- Guarded by src/lib/data/schema-parity.test.ts: columns, types, nullability, enum
-- CHECK lists, defaults, foreign keys (vs src/lib/data/relations.ts), indexes and RLS.
--
-- Conventions
--   * Every workspace table: id uuid pk, user_id -> auth.users (cascade), created_at, updated_at.
--   * Text defaults to '', lists to '{}', optional references are nullable.
--   * Enum-typed columns are text + CHECK (values from types.ts).
--   * Row-level security on every table: a user can only touch rows where user_id = auth.uid().
--   * Tables are created in TABLE_NAMES order (src/lib/data/defaults.ts), parents before children.
--   * Array references (uuid[]) and polymorphic references carry no FK; the app maintains them
--     (relations.ts array_remove + content_tags cleanup in the Supabase adapter).

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger: stamps updated_at on every UPDATE.';

grant usage on schema public to authenticated;

-- ----------------------------------------------------------------------------
-- users: public profile per auth user
-- ----------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Public profile for each auth user. Created by trigger on auth.users; one row per account.';

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create policy "Users can view their own profile" on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert their own profile" on public.users
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.users
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on table public.users from anon;
grant select, insert, update on table public.users to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is 'Trigger: creates the public.users row when an auth user signs up.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users as u
     set email = coalesce(new.email, ''),
         full_name = coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', u.full_name),
         avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', u.avatar_url)
   where u.id = new.id;
  return new;
end;
$$;

comment on function public.handle_user_updated() is 'Trigger: keeps public.users in sync with auth.users email and metadata.';

create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_user_updated();

-- Backfill accounts that existed before this migration.
insert into public.users (id, email, full_name, avatar_url)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- content_goals
-- ----------------------------------------------------------------------------

create table public.content_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'awareness' check (category in ('awareness', 'authority', 'community', 'leads', 'business')),
  name text not null default '',
  description text not null default '',
  kpis text[] not null default '{}',
  target_metric text check (target_metric in ('views', 'reach', 'followers_gained', 'engagements', 'comments', 'shares', 'saves', 'profile_visits', 'link_clicks', 'leads', 'sales', 'posts')),
  target_value integer,
  period text not null default 'monthly' check (period in ('weekly', 'monthly', 'quarterly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_goals is 'Content goals (awareness, authority, community, leads, business) with optional KPI targets.';

create index content_goals_user_id_idx on public.content_goals (user_id);

create trigger set_updated_at before update on public.content_goals
  for each row execute function public.set_updated_at();

alter table public.content_goals enable row level security;

create policy "Users can view their own content_goals" on public.content_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_goals" on public.content_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_goals" on public.content_goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_goals" on public.content_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_goals from anon;
grant select, insert, update, delete on table public.content_goals to authenticated;

-- ----------------------------------------------------------------------------
-- brand_profiles
-- ----------------------------------------------------------------------------

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  brand_name text not null default '',
  role text not null default '',
  industry text not null default '',
  expertise_summary text not null default '',
  years_experience numeric,
  location text not null default '',
  main_platforms text[] not null default '{}' check (main_platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  who_am_i text not null default '',
  known_for text not null default '',
  problems_solved text not null default '',
  why_listen text not null default '',
  point_of_view text not null default '',
  positioning_audience text not null default '',
  positioning_result text not null default '',
  positioning_method text not null default '',
  expertise_areas text[] not null default '{}',
  niche text not null default '',
  interests text[] not null default '{}',
  niche_fit text not null default '',
  personality_traits text[] not null default '{}' check (personality_traits <@ array['educational', 'direct', 'inspirational', 'strategic', 'practical', 'humorous', 'bold', 'professional', 'authentic', 'story_driven']::text[]),
  language text not null default 'english' check (language in ('english', 'tagalog', 'taglish')),
  tones text[] not null default '{conversational}' check (tones <@ array['professional', 'conversational', 'motivational', 'educational', 'challenging', 'casual']::text[]),
  always_do text not null default '',
  never_do text not null default '',
  phrases_used text[] not null default '{}',
  phrases_avoid text[] not null default '{}',
  cta_style text not null default '',
  storytelling_style text not null default '',
  contact_email text not null default '',
  website text not null default '',
  media_kit_bio text not null default '',
  primary_goal_id uuid references public.content_goals (id) on delete set null,
  secondary_goal_id uuid references public.content_goals (id) on delete set null,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_profiles_user_id_key unique (user_id)
);

comment on table public.brand_profiles is 'Brand HQ: identity, positioning, communication style and brand rules. Exactly one row per user.';
comment on column public.brand_profiles.positioning_audience is '"I help [audience] achieve [result] through [method]."';
comment on column public.brand_profiles.contact_email is 'Public contact for brands (shown on the media kit).';
comment on column public.brand_profiles.media_kit_bio is 'Short third-person bio for the media kit; the media kit falls back to who_am_i.';

create index brand_profiles_primary_goal_id_idx on public.brand_profiles (primary_goal_id);
create index brand_profiles_secondary_goal_id_idx on public.brand_profiles (secondary_goal_id);

create trigger set_updated_at before update on public.brand_profiles
  for each row execute function public.set_updated_at();

alter table public.brand_profiles enable row level security;

create policy "Users can view their own brand_profiles" on public.brand_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own brand_profiles" on public.brand_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own brand_profiles" on public.brand_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own brand_profiles" on public.brand_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.brand_profiles from anon;
grant select, insert, update, delete on table public.brand_profiles to authenticated;

-- ----------------------------------------------------------------------------
-- content_platforms
-- ----------------------------------------------------------------------------

create table public.content_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null default 'facebook' check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  is_active boolean not null default true,
  handle text not null default '',
  primary_goal_id uuid references public.content_goals (id) on delete set null,
  posting_frequency numeric not null default 3,
  preferred_format_ids uuid[] not null default '{}',
  preferred_pillar_ids uuid[] not null default '{}',
  audience text not null default '',
  cta_style text not null default '',
  current_followers integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_platforms is 'Platform strategy per social platform: handle, goal, weekly posting frequency, preferred formats and pillars.';
comment on column public.content_platforms.posting_frequency is 'Target posts per week on this platform.';
comment on column public.content_platforms.preferred_format_ids is 'Array reference to content_formats.id. No FK (arrays cannot carry one); the app removes deleted ids (relations.ts: array_remove).';
comment on column public.content_platforms.preferred_pillar_ids is 'Array reference to content_pillars.id. No FK (arrays cannot carry one); the app removes deleted ids (relations.ts: array_remove).';

create index content_platforms_user_id_idx on public.content_platforms (user_id);
create index content_platforms_primary_goal_id_idx on public.content_platforms (primary_goal_id);

create trigger set_updated_at before update on public.content_platforms
  for each row execute function public.set_updated_at();

alter table public.content_platforms enable row level security;

create policy "Users can view their own content_platforms" on public.content_platforms
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_platforms" on public.content_platforms
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_platforms" on public.content_platforms
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_platforms" on public.content_platforms
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_platforms from anon;
grant select, insert, update, delete on table public.content_platforms to authenticated;

-- ----------------------------------------------------------------------------
-- content_pillars
-- ----------------------------------------------------------------------------

create table public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  color text not null default 'blue' check (color in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red')),
  icon text not null default 'Layers',
  target_percentage numeric not null default 0,
  examples text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_pillars is 'Content Pillars: the recurring themes of the brand and their target share of the content mix.';
comment on column public.content_pillars.icon is 'lucide-react icon name, e.g. "GraduationCap".';
comment on column public.content_pillars.target_percentage is 'Target share of the content mix, 0-100.';

create index content_pillars_user_id_idx on public.content_pillars (user_id);

create trigger set_updated_at before update on public.content_pillars
  for each row execute function public.set_updated_at();

alter table public.content_pillars enable row level security;

create policy "Users can view their own content_pillars" on public.content_pillars
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_pillars" on public.content_pillars
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_pillars" on public.content_pillars
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_pillars" on public.content_pillars
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_pillars from anon;
grant select, insert, update, delete on table public.content_pillars to authenticated;

-- ----------------------------------------------------------------------------
-- content_formats
-- ----------------------------------------------------------------------------

create table public.content_formats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  category text not null default 'video' check (category in ('video', 'text', 'visual', 'audio', 'long_form', 'live')),
  description text not null default '',
  script_format text not null default 'custom' check (script_format in ('short_video', 'long_video', 'facebook_post', 'linkedin_post', 'carousel', 'video_brief', 'x_thread', 'threads_post', 'instagram_caption', 'newsletter', 'blog', 'podcast_outline', 'story_sequence', 'custom')),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_formats is 'Content formats (short video, carousel, post...) and the default script structure used by the Content Studio.';

create index content_formats_user_id_idx on public.content_formats (user_id);

create trigger set_updated_at before update on public.content_formats
  for each row execute function public.set_updated_at();

alter table public.content_formats enable row level security;

create policy "Users can view their own content_formats" on public.content_formats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_formats" on public.content_formats
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_formats" on public.content_formats
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_formats" on public.content_formats
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_formats from anon;
grant select, insert, update, delete on table public.content_formats to authenticated;

-- ----------------------------------------------------------------------------
-- angles
-- ----------------------------------------------------------------------------

create table public.angles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  example text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.angles is 'Angle Library: reusable ways to approach a topic.';

create index angles_user_id_idx on public.angles (user_id);

create trigger set_updated_at before update on public.angles
  for each row execute function public.set_updated_at();

alter table public.angles enable row level security;

create policy "Users can view their own angles" on public.angles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own angles" on public.angles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own angles" on public.angles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own angles" on public.angles
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.angles from anon;
grant select, insert, update, delete on table public.angles to authenticated;

-- ----------------------------------------------------------------------------
-- hooks
-- ----------------------------------------------------------------------------

create table public.hooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null default '',
  category text not null default 'custom' check (category in ('curiosity', 'contrarian', 'mistake', 'authority', 'story', 'problem', 'results', 'list', 'warning', 'question', 'custom')),
  is_template boolean not null default false,
  source text not null default 'user' check (source in ('library', 'user', 'ai', 'content')),
  pillar_id uuid references public.content_pillars (id) on delete set null,
  notes text not null default '',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hooks is 'Hook Library: hook templates ("___" marks a blank) and saved hooks.';

create index hooks_user_id_idx on public.hooks (user_id);
create index hooks_pillar_id_idx on public.hooks (pillar_id);

create trigger set_updated_at before update on public.hooks
  for each row execute function public.set_updated_at();

alter table public.hooks enable row level security;

create policy "Users can view their own hooks" on public.hooks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own hooks" on public.hooks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own hooks" on public.hooks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own hooks" on public.hooks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.hooks from anon;
grant select, insert, update, delete on table public.hooks to authenticated;

-- ----------------------------------------------------------------------------
-- tags
-- ----------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  color text not null default 'gray' check (color in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'gray')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tags is 'Tags, stored without the leading "#". Unique per user, case-insensitive.';

create unique index tags_user_id_name_key on public.tags (user_id, lower(name));

create trigger set_updated_at before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

create policy "Users can view their own tags" on public.tags
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own tags" on public.tags
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own tags" on public.tags
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own tags" on public.tags
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.tags from anon;
grant select, insert, update, delete on table public.tags to authenticated;

-- ----------------------------------------------------------------------------
-- audience_personas
-- ----------------------------------------------------------------------------

create table public.audience_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  age_range text not null default '',
  profession text not null default '',
  industry text not null default '',
  experience_level text not null default '',
  location text not null default '',
  goals text[] not null default '{}',
  problems text[] not null default '{}',
  fears text[] not null default '{}',
  frustrations text[] not null default '{}',
  aspirations text[] not null default '{}',
  questions text[] not null default '{}',
  objections text[] not null default '{}',
  buying_motivation text not null default '',
  content_consumed text[] not null default '{}',
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  influencers text[] not null default '{}',
  language_used text[] not null default '{}',
  is_primary boolean not null default false,
  color text not null default 'blue' check (color in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.audience_personas is 'Audience HQ personas: who they are, what they want, fear and ask, and where they spend time.';

create index audience_personas_user_id_idx on public.audience_personas (user_id);

create trigger set_updated_at before update on public.audience_personas
  for each row execute function public.set_updated_at();

alter table public.audience_personas enable row level security;

create policy "Users can view their own audience_personas" on public.audience_personas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own audience_personas" on public.audience_personas
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own audience_personas" on public.audience_personas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own audience_personas" on public.audience_personas
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.audience_personas from anon;
grant select, insert, update, delete on table public.audience_personas to authenticated;

-- ----------------------------------------------------------------------------
-- audience_problems
-- ----------------------------------------------------------------------------

create table public.audience_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  persona_id uuid references public.audience_personas (id) on delete set null,
  problem text not null default '',
  category text not null default 'beginner' check (category in ('beginner', 'intermediate', 'advanced', 'emotional', 'financial', 'career', 'business', 'operational')),
  severity integer not null default 3,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.audience_problems is 'Problem Bank: real audience problems rated by severity and mapped to personas and pillars.';
comment on column public.audience_problems.severity is '1 (minor) to 5 (critical).';

create index audience_problems_user_id_idx on public.audience_problems (user_id);
create index audience_problems_persona_id_idx on public.audience_problems (persona_id);
create index audience_problems_pillar_id_idx on public.audience_problems (pillar_id);

create trigger set_updated_at before update on public.audience_problems
  for each row execute function public.set_updated_at();

alter table public.audience_problems enable row level security;

create policy "Users can view their own audience_problems" on public.audience_problems
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own audience_problems" on public.audience_problems
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own audience_problems" on public.audience_problems
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own audience_problems" on public.audience_problems
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.audience_problems from anon;
grant select, insert, update, delete on table public.audience_problems to authenticated;

-- ----------------------------------------------------------------------------
-- content_campaigns
-- ----------------------------------------------------------------------------

create table public.content_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  objective text not null default '',
  description text not null default '',
  start_date date not null default current_date,
  end_date date not null default current_date,
  persona_id uuid references public.audience_personas (id) on delete set null,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  goal_id uuid references public.content_goals (id) on delete set null,
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  message text not null default '',
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'completed')),
  target_posts integer,
  color text not null default 'blue' check (color in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_campaigns is 'Campaigns: time-boxed content pushes with an objective, a core message and a post target.';

create index content_campaigns_user_id_idx on public.content_campaigns (user_id);
create index content_campaigns_persona_id_idx on public.content_campaigns (persona_id);
create index content_campaigns_pillar_id_idx on public.content_campaigns (pillar_id);
create index content_campaigns_goal_id_idx on public.content_campaigns (goal_id);

create trigger set_updated_at before update on public.content_campaigns
  for each row execute function public.set_updated_at();

alter table public.content_campaigns enable row level security;

create policy "Users can view their own content_campaigns" on public.content_campaigns
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_campaigns" on public.content_campaigns
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_campaigns" on public.content_campaigns
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_campaigns" on public.content_campaigns
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_campaigns from anon;
grant select, insert, update, delete on table public.content_campaigns to authenticated;

-- ----------------------------------------------------------------------------
-- content_series
-- ----------------------------------------------------------------------------

create table public.content_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  day_of_week integer check (day_of_week between 0 and 6),
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  pillar_id uuid references public.content_pillars (id) on delete set null,
  format_id uuid references public.content_formats (id) on delete set null,
  hook_template text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_series is 'Series: recurring content formats with a cadence, platforms and a hook template.';
comment on column public.content_series.day_of_week is '0 = Sunday ... 6 = Saturday.';

create index content_series_user_id_idx on public.content_series (user_id);
create index content_series_pillar_id_idx on public.content_series (pillar_id);
create index content_series_format_id_idx on public.content_series (format_id);

create trigger set_updated_at before update on public.content_series
  for each row execute function public.set_updated_at();

alter table public.content_series enable row level security;

create policy "Users can view their own content_series" on public.content_series
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_series" on public.content_series
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_series" on public.content_series
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_series" on public.content_series
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_series from anon;
grant select, insert, update, delete on table public.content_series to authenticated;

-- ----------------------------------------------------------------------------
-- content_ideas
-- ----------------------------------------------------------------------------

create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  core_topic text not null default '',
  description text not null default '',
  hook text not null default '',
  hook_category text check (hook_category in ('curiosity', 'contrarian', 'mistake', 'authority', 'story', 'problem', 'results', 'list', 'warning', 'question', 'custom')),
  angle_id uuid references public.angles (id) on delete set null,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  persona_id uuid references public.audience_personas (id) on delete set null,
  problem_id uuid references public.audience_problems (id) on delete set null,
  goal_id uuid references public.content_goals (id) on delete set null,
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  format_id uuid references public.content_formats (id) on delete set null,
  funnel_stage text check (funnel_stage in ('tofu', 'mofu', 'bofu')),
  inspiration text not null default '',
  source text not null default 'manual' check (source in ('quick_capture', 'ai_generator', 'matrix', 'problem_bank', 'question_bank', 'research', 'story', 'experience', 'winner', 'repurpose', 'onboarding', 'strategist', 'planner', 'manual')),
  source_ref_id uuid,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'inbox' check (status in ('inbox', 'researching', 'validated', 'selected', 'converted', 'archived')),
  scores jsonb,
  score integer,
  why_it_matters text not null default '',
  talking_points text[] not null default '{}',
  cta text not null default '',
  campaign_id uuid references public.content_campaigns (id) on delete set null,
  series_id uuid references public.content_series (id) on delete set null,
  converted_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_ideas is 'Idea Bank: captured and generated ideas with their Idea Priority Score, before they become content.';
comment on column public.content_ideas.source_ref_id is 'Polymorphic soft reference to the row that produced this idea (story, research item, question, winner...). No FK.';
comment on column public.content_ideas.scores is 'Idea Priority Score dimensions (IdeaScores), each 1-10.';
comment on column public.content_ideas.score is 'Overall Idea Score 0-100 derived from scores.';
comment on column public.content_ideas.converted_item_id is 'Soft reference to content_items.id. No FK: ideas are inserted before items and content_items.idea_id already points back, so a FK here would create an insert cycle. Cleared by trigger clear_converted_item_refs when the item is deleted (relations.ts: set_null).';

create index content_ideas_user_id_idx on public.content_ideas (user_id);
create index content_ideas_angle_id_idx on public.content_ideas (angle_id);
create index content_ideas_pillar_id_idx on public.content_ideas (pillar_id);
create index content_ideas_persona_id_idx on public.content_ideas (persona_id);
create index content_ideas_problem_id_idx on public.content_ideas (problem_id);
create index content_ideas_goal_id_idx on public.content_ideas (goal_id);
create index content_ideas_format_id_idx on public.content_ideas (format_id);
create index content_ideas_campaign_id_idx on public.content_ideas (campaign_id);
create index content_ideas_series_id_idx on public.content_ideas (series_id);
create index content_ideas_converted_item_id_idx on public.content_ideas (converted_item_id);

create trigger set_updated_at before update on public.content_ideas
  for each row execute function public.set_updated_at();

alter table public.content_ideas enable row level security;

create policy "Users can view their own content_ideas" on public.content_ideas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_ideas" on public.content_ideas
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_ideas" on public.content_ideas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_ideas" on public.content_ideas
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_ideas from anon;
grant select, insert, update, delete on table public.content_ideas to authenticated;

-- ----------------------------------------------------------------------------
-- content_items
-- ----------------------------------------------------------------------------

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  idea_id uuid references public.content_ideas (id) on delete set null,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  persona_id uuid references public.audience_personas (id) on delete set null,
  problem_id uuid references public.audience_problems (id) on delete set null,
  goal_id uuid references public.content_goals (id) on delete set null,
  angle_id uuid references public.angles (id) on delete set null,
  hook_id uuid references public.hooks (id) on delete set null,
  hook text not null default '',
  hook_category text check (hook_category in ('curiosity', 'contrarian', 'mistake', 'authority', 'story', 'problem', 'results', 'list', 'warning', 'question', 'custom')),
  platform text not null default 'facebook' check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  format_id uuid references public.content_formats (id) on delete set null,
  funnel_stage text check (funnel_stage in ('tofu', 'mofu', 'bofu')),
  stage text not null default 'idea' check (stage in ('idea', 'selected', 'brief', 'scripting', 'ready_for_production', 'recording', 'editing', 'review', 'revision', 'ready_to_post', 'scheduled', 'published', 'repurpose')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  owner text not null default '',
  due_date date,
  scheduled_at timestamptz,
  published_at timestamptz,
  published_url text not null default '',
  thumbnail_url text not null default '',
  campaign_id uuid references public.content_campaigns (id) on delete set null,
  series_id uuid references public.content_series (id) on delete set null,
  parent_id uuid references public.content_items (id) on delete set null,
  repurpose_type text check (repurpose_type in ('facebook_post', 'linkedin_post', 'carousel', 'x_thread', 'reel_caption', 'youtube_short', 'newsletter', 'follow_up', 'part_2', 'opposite_opinion', 'case_study', 'update_post')),
  quality_score jsonb,
  pinned_winner boolean not null default false,
  why_it_worked text not null default '',
  replication_ideas text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_items is 'Content items: one post on one platform, moving through the 13 Pipeline stages. Repurposed versions link via parent_id.';
comment on column public.content_items.parent_id is 'The content item this was repurposed from.';
comment on column public.content_items.quality_score is 'AI Content Score (ContentQualityScore): a quality evaluation, not a virality prediction.';
comment on column public.content_items.pinned_winner is 'Manually include in the Winning Content Library regardless of tier.';

create index content_items_idea_id_idx on public.content_items (idea_id);
create index content_items_pillar_id_idx on public.content_items (pillar_id);
create index content_items_persona_id_idx on public.content_items (persona_id);
create index content_items_problem_id_idx on public.content_items (problem_id);
create index content_items_goal_id_idx on public.content_items (goal_id);
create index content_items_angle_id_idx on public.content_items (angle_id);
create index content_items_hook_id_idx on public.content_items (hook_id);
create index content_items_format_id_idx on public.content_items (format_id);
create index content_items_campaign_id_idx on public.content_items (campaign_id);
create index content_items_series_id_idx on public.content_items (series_id);
create index content_items_parent_id_idx on public.content_items (parent_id);
create index content_items_user_id_stage_idx on public.content_items (user_id, stage);
create index content_items_user_id_scheduled_at_idx on public.content_items (user_id, scheduled_at);

create trigger set_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;

create policy "Users can view their own content_items" on public.content_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_items" on public.content_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_items" on public.content_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_items" on public.content_items
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_items from anon;
grant select, insert, update, delete on table public.content_items to authenticated;

-- ----------------------------------------------------------------------------
-- Soft reference: content_ideas.converted_item_id -> content_items.id (on delete set null)
-- ----------------------------------------------------------------------------

create or replace function public.clear_converted_item_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.content_ideas
     set converted_item_id = null
   where user_id = old.user_id
     and converted_item_id = old.id;
  return old;
end;
$$;

comment on function public.clear_converted_item_refs() is 'Trigger: emulates ON DELETE SET NULL for the soft reference content_ideas.converted_item_id. Security definer so it also runs when rows are removed by the auth.users cascade; scoped to the deleted row''s user.';

create trigger clear_converted_item_refs
  after delete on public.content_items
  for each row execute function public.clear_converted_item_refs();

-- ----------------------------------------------------------------------------
-- content_briefs
-- ----------------------------------------------------------------------------

create table public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  objective text not null default '',
  main_message text not null default '',
  supporting_points text[] not null default '{}',
  cta text not null default '',
  visual_direction text not null default '',
  reference text not null default '',
  caption text not null default '',
  production_notes text not null default '',
  b_roll text[] not null default '{}',
  on_screen_text text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_briefs is 'Content Briefs: the strategic brief for a content item (1:1).';

create index content_briefs_user_id_idx on public.content_briefs (user_id);
create index content_briefs_content_item_id_idx on public.content_briefs (content_item_id);

create trigger set_updated_at before update on public.content_briefs
  for each row execute function public.set_updated_at();

alter table public.content_briefs enable row level security;

create policy "Users can view their own content_briefs" on public.content_briefs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_briefs" on public.content_briefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_briefs" on public.content_briefs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_briefs" on public.content_briefs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_briefs from anon;
grant select, insert, update, delete on table public.content_briefs to authenticated;

-- ----------------------------------------------------------------------------
-- content_scripts
-- ----------------------------------------------------------------------------

create table public.content_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  format text not null default 'custom' check (format in ('short_video', 'long_video', 'facebook_post', 'linkedin_post', 'carousel', 'video_brief', 'x_thread', 'threads_post', 'instagram_caption', 'newsletter', 'blog', 'podcast_outline', 'story_sequence', 'custom')),
  title text not null default '',
  sections jsonb not null default '[]'::jsonb,
  body text not null default '',
  caption text not null default '',
  hashtags text[] not null default '{}',
  version integer not null default 1,
  is_current boolean not null default true,
  generated_by text not null default 'manual' check (generated_by in ('anthropic', 'openai', 'offline', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_scripts is 'Scripts: versioned drafts per content item and format; is_current marks the active version.';
comment on column public.content_scripts.sections is 'ScriptSection[]: [{ key, label, content }].';
comment on column public.content_scripts.body is 'Full rendered copy (sections joined): what the creator reads or posts.';

create index content_scripts_user_id_idx on public.content_scripts (user_id);
create index content_scripts_content_item_id_idx on public.content_scripts (content_item_id);

create trigger set_updated_at before update on public.content_scripts
  for each row execute function public.set_updated_at();

alter table public.content_scripts enable row level security;

create policy "Users can view their own content_scripts" on public.content_scripts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_scripts" on public.content_scripts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_scripts" on public.content_scripts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_scripts" on public.content_scripts
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_scripts from anon;
grant select, insert, update, delete on table public.content_scripts to authenticated;

-- ----------------------------------------------------------------------------
-- content_calendar
-- ----------------------------------------------------------------------------

create table public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_of_week integer not null default 1 check (day_of_week between 0 and 6),
  label text not null default '',
  pillar_id uuid references public.content_pillars (id) on delete set null,
  format_id uuid references public.content_formats (id) on delete set null,
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  "time" text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_calendar is 'Posting Schedule: recurring weekly posting slots. A dated entry is a content item''s scheduled_at, not a row here.';
comment on column public.content_calendar.day_of_week is '0 = Sunday ... 6 = Saturday.';
comment on column public.content_calendar."time" is 'Optional preferred time "HH:mm".';

create index content_calendar_user_id_idx on public.content_calendar (user_id);
create index content_calendar_pillar_id_idx on public.content_calendar (pillar_id);
create index content_calendar_format_id_idx on public.content_calendar (format_id);

create trigger set_updated_at before update on public.content_calendar
  for each row execute function public.set_updated_at();

alter table public.content_calendar enable row level security;

create policy "Users can view their own content_calendar" on public.content_calendar
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_calendar" on public.content_calendar
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_calendar" on public.content_calendar
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_calendar" on public.content_calendar
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_calendar from anon;
grant select, insert, update, delete on table public.content_calendar to authenticated;

-- ----------------------------------------------------------------------------
-- content_metrics
-- ----------------------------------------------------------------------------

create table public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  platform text not null default 'facebook' check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  recorded_at date not null default current_date,
  views integer not null default 0,
  reach integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  followers_gained integer not null default 0,
  profile_visits integer not null default 0,
  link_clicks integer not null default 0,
  leads integer not null default 0,
  sales integer not null default 0,
  watch_time_seconds numeric,
  avg_retention numeric,
  notes text not null default '',
  source text not null default 'manual' check (source in ('manual', 'import', 'integration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_metrics is 'Analytics snapshots: one row per logging event. Analytics use the latest snapshot per content item.';
comment on column public.content_metrics.avg_retention is 'Average retention / % watched, 0-100.';

create index content_metrics_user_id_idx on public.content_metrics (user_id);
create index content_metrics_content_item_id_recorded_at_idx on public.content_metrics (content_item_id, recorded_at);

create trigger set_updated_at before update on public.content_metrics
  for each row execute function public.set_updated_at();

alter table public.content_metrics enable row level security;

create policy "Users can view their own content_metrics" on public.content_metrics
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_metrics" on public.content_metrics
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_metrics" on public.content_metrics
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_metrics" on public.content_metrics
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_metrics from anon;
grant select, insert, update, delete on table public.content_metrics to authenticated;

-- ----------------------------------------------------------------------------
-- content_experiments
-- ----------------------------------------------------------------------------

create table public.content_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  hypothesis text not null default '',
  variant_a text not null default '',
  variant_b text not null default '',
  metric text not null default 'engagement_rate' check (metric in ('views', 'reach', 'likes', 'comments', 'shares', 'saves', 'followers_gained', 'profile_visits', 'link_clicks', 'leads', 'sales', 'watch_time_seconds', 'avg_retention', 'engagement_rate', 'share_rate', 'save_rate', 'lead_conversion_rate', 'follower_conversion_rate', 'engagements')),
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned', 'running', 'completed', 'cancelled')),
  variant_a_item_ids uuid[] not null default '{}',
  variant_b_item_ids uuid[] not null default '{}',
  result text not null default '',
  winner text check (winner in ('a', 'b', 'inconclusive')),
  lesson text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_experiments is 'Experiments: A/B hypotheses comparing two sets of content items on one metric.';
comment on column public.content_experiments.variant_a_item_ids is 'Array reference to content_items.id. No FK (arrays cannot carry one); the app removes deleted ids (relations.ts: array_remove).';
comment on column public.content_experiments.variant_b_item_ids is 'Array reference to content_items.id. No FK (arrays cannot carry one); the app removes deleted ids (relations.ts: array_remove).';

create index content_experiments_user_id_idx on public.content_experiments (user_id);

create trigger set_updated_at before update on public.content_experiments
  for each row execute function public.set_updated_at();

alter table public.content_experiments enable row level security;

create policy "Users can view their own content_experiments" on public.content_experiments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_experiments" on public.content_experiments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_experiments" on public.content_experiments
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_experiments" on public.content_experiments
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_experiments from anon;
grant select, insert, update, delete on table public.content_experiments to authenticated;

-- ----------------------------------------------------------------------------
-- content_repurposing
-- ----------------------------------------------------------------------------

create table public.content_repurposing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_item_id uuid not null references public.content_items (id) on delete cascade,
  target_item_id uuid references public.content_items (id) on delete set null,
  type text not null default 'facebook_post' check (type in ('facebook_post', 'linkedin_post', 'carousel', 'x_thread', 'reel_caption', 'youtube_short', 'newsletter', 'follow_up', 'part_2', 'opposite_opinion', 'case_study', 'update_post')),
  platform text check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  status text not null default 'suggested' check (status in ('suggested', 'drafted', 'created', 'dismissed')),
  title text not null default '',
  draft text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_repurposing is 'Repurposing Engine: suggested, drafted and created derivatives of a source content item.';

create index content_repurposing_user_id_idx on public.content_repurposing (user_id);
create index content_repurposing_source_item_id_idx on public.content_repurposing (source_item_id);
create index content_repurposing_target_item_id_idx on public.content_repurposing (target_item_id);

create trigger set_updated_at before update on public.content_repurposing
  for each row execute function public.set_updated_at();

alter table public.content_repurposing enable row level security;

create policy "Users can view their own content_repurposing" on public.content_repurposing
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_repurposing" on public.content_repurposing
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_repurposing" on public.content_repurposing
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_repurposing" on public.content_repurposing
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_repurposing from anon;
grant select, insert, update, delete on table public.content_repurposing to authenticated;

-- ----------------------------------------------------------------------------
-- stories
-- ----------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null default 'story' check (type in ('story', 'experience', 'lesson', 'quote', 'opinion', 'framework', 'case_study', 'achievement', 'failure', 'belief')),
  title text not null default '',
  situation text not null default '',
  problem text not null default '',
  action text not null default '',
  result text not null default '',
  lesson text not null default '',
  emotion text not null default '',
  pillar_id uuid references public.content_pillars (id) on delete set null,
  keywords text[] not null default '{}',
  occurred_on date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stories is 'Story Vault: personal stories, lessons and experiences that make content sound like the creator.';

create index stories_user_id_idx on public.stories (user_id);
create index stories_pillar_id_idx on public.stories (pillar_id);

create trigger set_updated_at before update on public.stories
  for each row execute function public.set_updated_at();

alter table public.stories enable row level security;

create policy "Users can view their own stories" on public.stories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own stories" on public.stories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own stories" on public.stories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own stories" on public.stories
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.stories from anon;
grant select, insert, update, delete on table public.stories to authenticated;

-- ----------------------------------------------------------------------------
-- research_items
-- ----------------------------------------------------------------------------

create table public.research_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null default 'post' check (type in ('competitor', 'post', 'trend', 'quote', 'video', 'topic', 'article', 'screenshot')),
  title text not null default '',
  url text not null default '',
  source text not null default '',
  creator text not null default '',
  platform text check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  topic text not null default '',
  hook text not null default '',
  content text not null default '',
  why_attention text not null default '',
  learnings text not null default '',
  adaptation text not null default '',
  analysis jsonb,
  status text not null default 'saved' check (status in ('saved', 'analyzed', 'adapted', 'archived')),
  pillar_id uuid references public.content_pillars (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.research_items is 'Research Library: saved references and their structural analysis. Reference text is analyzed, never republished.';
comment on column public.research_items.content is 'Pasted reference text / transcript, used for analysis and never republished.';
comment on column public.research_items.analysis is 'ReferenceAnalysis: hook, structure, angle, psychology, why it works, patterns.';

create index research_items_user_id_idx on public.research_items (user_id);
create index research_items_pillar_id_idx on public.research_items (pillar_id);

create trigger set_updated_at before update on public.research_items
  for each row execute function public.set_updated_at();

alter table public.research_items enable row level security;

create policy "Users can view their own research_items" on public.research_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own research_items" on public.research_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own research_items" on public.research_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own research_items" on public.research_items
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.research_items from anon;
grant select, insert, update, delete on table public.research_items to authenticated;

-- ----------------------------------------------------------------------------
-- audience_questions
-- ----------------------------------------------------------------------------

create table public.audience_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question text not null default '',
  source_person text not null default '',
  platform text check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  topic text not null default '',
  frequency integer not null default 1,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  persona_id uuid references public.audience_personas (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'idea_created', 'answered', 'dismissed')),
  idea_id uuid references public.content_ideas (id) on delete set null,
  content_item_id uuid references public.content_items (id) on delete set null,
  last_asked_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.audience_questions is 'Question Bank: questions the audience asks, how often, and the idea or content that answers them.';
comment on column public.audience_questions.frequency is 'How many times this (or an equivalent) question was asked.';

create index audience_questions_user_id_idx on public.audience_questions (user_id);
create index audience_questions_pillar_id_idx on public.audience_questions (pillar_id);
create index audience_questions_persona_id_idx on public.audience_questions (persona_id);
create index audience_questions_idea_id_idx on public.audience_questions (idea_id);
create index audience_questions_content_item_id_idx on public.audience_questions (content_item_id);

create trigger set_updated_at before update on public.audience_questions
  for each row execute function public.set_updated_at();

alter table public.audience_questions enable row level security;

create policy "Users can view their own audience_questions" on public.audience_questions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own audience_questions" on public.audience_questions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own audience_questions" on public.audience_questions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own audience_questions" on public.audience_questions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.audience_questions from anon;
grant select, insert, update, delete on table public.audience_questions to authenticated;

-- ----------------------------------------------------------------------------
-- content_tags
-- ----------------------------------------------------------------------------

create table public.content_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  entity_type text not null check (entity_type in ('content_ideas', 'content_items', 'stories', 'hooks', 'research_items', 'content_campaigns')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_tags_tag_id_entity_key unique (tag_id, entity_type, entity_id)
);

comment on table public.content_tags is 'Polymorphic tag links: tag_id applied to one row of entity_type.';
comment on column public.content_tags.entity_type is 'Table of the tagged row (TaggableEntity).';
comment on column public.content_tags.entity_id is 'Polymorphic reference to <entity_type>.id. No FK (Postgres cannot express one); the app deletes links together with the entity.';

create index content_tags_user_id_idx on public.content_tags (user_id);
create index content_tags_entity_idx on public.content_tags (entity_type, entity_id);

create trigger set_updated_at before update on public.content_tags
  for each row execute function public.set_updated_at();

alter table public.content_tags enable row level security;

create policy "Users can view their own content_tags" on public.content_tags
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own content_tags" on public.content_tags
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own content_tags" on public.content_tags
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own content_tags" on public.content_tags
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.content_tags from anon;
grant select, insert, update, delete on table public.content_tags to authenticated;

-- ----------------------------------------------------------------------------
-- weekly_reviews
-- ----------------------------------------------------------------------------

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null default (date_trunc('week', current_date))::date,
  focus text not null default '',
  stats jsonb,
  what_worked text not null default '',
  what_didnt text not null default '',
  learned text not null default '',
  double_down text not null default '',
  stop text not null default '',
  test_next text not null default '',
  planned_item_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'final')),
  generated_by text check (generated_by in ('anthropic', 'openai', 'offline', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weekly_reviews is 'Weekly Reports: a frozen analytics snapshot plus the creator''s reflections and plan for the week.';
comment on column public.weekly_reviews.week_start is 'First day (configured week start) of the reviewed week.';
comment on column public.weekly_reviews.stats is 'Frozen analytics snapshot at generation time.';
comment on column public.weekly_reviews.planned_item_ids is 'Array reference to content_items.id. No FK (arrays cannot carry one); the app removes deleted ids (relations.ts: array_remove).';

create index weekly_reviews_user_id_idx on public.weekly_reviews (user_id);

create trigger set_updated_at before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

alter table public.weekly_reviews enable row level security;

create policy "Users can view their own weekly_reviews" on public.weekly_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own weekly_reviews" on public.weekly_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own weekly_reviews" on public.weekly_reviews
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own weekly_reviews" on public.weekly_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.weekly_reviews from anon;
grant select, insert, update, delete on table public.weekly_reviews to authenticated;

-- ----------------------------------------------------------------------------
-- monthly_reviews
-- ----------------------------------------------------------------------------

create table public.monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null default (date_trunc('month', current_date))::date,
  stats jsonb,
  summary text not null default '',
  continue_doing text[] not null default '{}',
  increase text[] not null default '{}',
  reduce text[] not null default '{}',
  stop text[] not null default '{}',
  experiment text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'final')),
  generated_by text check (generated_by in ('anthropic', 'openai', 'offline', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.monthly_reviews is 'Monthly Reviews: a frozen analytics snapshot plus continue / increase / reduce / stop / experiment decisions.';
comment on column public.monthly_reviews.month is 'First day of the reviewed month.';

create index monthly_reviews_user_id_idx on public.monthly_reviews (user_id);

create trigger set_updated_at before update on public.monthly_reviews
  for each row execute function public.set_updated_at();

alter table public.monthly_reviews enable row level security;

create policy "Users can view their own monthly_reviews" on public.monthly_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own monthly_reviews" on public.monthly_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own monthly_reviews" on public.monthly_reviews
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own monthly_reviews" on public.monthly_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.monthly_reviews from anon;
grant select, insert, update, delete on table public.monthly_reviews to authenticated;

-- ----------------------------------------------------------------------------
-- ai_generations
-- ----------------------------------------------------------------------------

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task text not null default '',
  provider text not null default 'offline' check (provider in ('anthropic', 'openai', 'offline')),
  model text not null default '',
  input jsonb,
  output jsonb,
  entity_type text,
  entity_id uuid,
  status text not null default 'success' check (status in ('success', 'error')),
  error text,
  duration_ms numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_generations is 'Log of AI generations (task, provider, model, input, output, duration) for transparency and debugging.';
comment on column public.ai_generations.entity_id is 'Polymorphic soft reference to the <entity_type> row the generation was for. No FK.';

create index ai_generations_user_id_idx on public.ai_generations (user_id);

create trigger set_updated_at before update on public.ai_generations
  for each row execute function public.set_updated_at();

alter table public.ai_generations enable row level security;

create policy "Users can view their own ai_generations" on public.ai_generations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own ai_generations" on public.ai_generations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own ai_generations" on public.ai_generations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own ai_generations" on public.ai_generations
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.ai_generations from anon;
grant select, insert, update, delete on table public.ai_generations to authenticated;

-- ----------------------------------------------------------------------------
-- engagement_logs
-- ----------------------------------------------------------------------------

create table public.engagement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null default current_date,
  comments_replied integer not null default 0,
  dms_replied integer not null default 0,
  creator_comments integer not null default 0,
  questions_collected integer not null default 0,
  ideas_captured integer not null default 0,
  completed_tasks text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.engagement_logs is 'Daily engagement routine log: replies, DMs, creator comments, questions collected, ideas captured.';
comment on column public.engagement_logs.completed_tasks is 'Keys of app_settings.engagement_tasks completed that day.';

create index engagement_logs_user_id_idx on public.engagement_logs (user_id);

create trigger set_updated_at before update on public.engagement_logs
  for each row execute function public.set_updated_at();

alter table public.engagement_logs enable row level security;

create policy "Users can view their own engagement_logs" on public.engagement_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own engagement_logs" on public.engagement_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own engagement_logs" on public.engagement_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own engagement_logs" on public.engagement_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.engagement_logs from anon;
grant select, insert, update, delete on table public.engagement_logs to authenticated;

-- ----------------------------------------------------------------------------
-- app_settings
-- ----------------------------------------------------------------------------

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekly_post_target integer not null default 10,
  week_starts_on integer not null default 1 check (week_starts_on in (0, 1)),
  timezone text not null default 'Asia/Manila',
  buffer_healthy_days integer not null default 7,
  buffer_warning_days integer not null default 3,
  winner_metric text not null default 'views' check (winner_metric in ('views', 'engagement_rate', 'engagements', 'leads', 'composite')),
  winner_window integer not null default 20,
  winner_min_sample integer not null default 3,
  tier_good numeric not null default 1.5,
  tier_winner numeric not null default 2,
  tier_breakout numeric not null default 3,
  funnel_targets jsonb not null default '{"tofu":50,"mofu":35,"bofu":15}'::jsonb,
  engagement_tasks jsonb not null default '[{"key":"reply_comments","label":"Reply to comments","target":10},{"key":"reply_dms","label":"Reply to DMs","target":5},{"key":"comment_creators","label":"Comment on relevant creators","target":5},{"key":"answer_questions","label":"Answer audience questions","target":3},{"key":"collect_questions","label":"Collect audience questions as content ideas","target":2}]'::jsonb,
  default_owner text not null default '',
  pillar_tolerance numeric not null default 10,
  ui_language text not null default 'en' check (ui_language in ('en', 'tl')),
  simple_mode boolean not null default true,
  currency text not null default 'PHP',
  reminders_daily_enabled boolean not null default false,
  reminders_daily_time text not null default '08:00',
  reminders_slot_enabled boolean not null default false,
  reminders_slot_lead_minutes integer not null default 30 check (reminders_slot_lead_minutes between 0 and 1440),
  reminders_review_enabled boolean not null default false,
  reminders_review_day integer not null default 0 check (reminders_review_day between 0 and 6),
  reminders_review_time text not null default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_user_id_key unique (user_id)
);

comment on table public.app_settings is 'Workspace settings: targets, week start, buffer thresholds, winner detection, funnel targets, language, Simple mode, currency and reminders. Exactly one row per user.';
comment on column public.app_settings.week_starts_on is '0 = Sunday, 1 = Monday.';
comment on column public.app_settings.winner_window is 'Compare against the last N posts on the same platform.';
comment on column public.app_settings.winner_min_sample is 'Minimum comparison posts before performance tiers are assigned.';
comment on column public.app_settings.pillar_tolerance is 'Pillar mix deviation (percentage points) that triggers an imbalance warning.';
comment on column public.app_settings.ui_language is 'Language of the app screens: en = English, tl = Taglish. The content language is brand_profiles.language.';
comment on column public.app_settings.simple_mode is 'Sidebar shows only the everyday modules; every page stays reachable from the command palette.';
comment on column public.app_settings.currency is 'ISO 4217 code: default currency for new brand deals, income entries and rate cards.';
comment on column public.app_settings.reminders_daily_time is 'Local time of the daily digest, HH:mm.';
comment on column public.app_settings.reminders_slot_lead_minutes is 'Minutes before each posting-schedule slot.';
comment on column public.app_settings.reminders_review_day is 'Weekly review day: 0 = Sunday ... 6 = Saturday.';
comment on column public.app_settings.reminders_review_time is 'Local time of the weekly review reminder, HH:mm.';


create trigger set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

create policy "Users can view their own app_settings" on public.app_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own app_settings" on public.app_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own app_settings" on public.app_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own app_settings" on public.app_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.app_settings from anon;
grant select, insert, update, delete on table public.app_settings to authenticated;

-- ----------------------------------------------------------------------------
-- brand_deals
-- ----------------------------------------------------------------------------

create table public.brand_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_name text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  contact_handle text not null default '',
  source text not null default 'inbound' check (source in ('inbound', 'outbound', 'agency', 'referral')),
  status text not null default 'lead' check (status in ('lead', 'pitched', 'negotiating', 'contracted', 'in_progress', 'delivered', 'paid', 'lost')),
  fee numeric,
  currency text not null default 'PHP',
  deliverables text[] not null default '{}',
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads']::text[]),
  content_item_ids uuid[] not null default '{}',
  campaign_id uuid references public.content_campaigns (id) on delete set null,
  start_date date,
  due_date date,
  paid_at date,
  usage_rights text not null default '',
  show_in_media_kit boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.brand_deals is 'Brand deals: sponsorships and collaborations from lead to paid, with contact, fee, deliverables, linked content and usage rights.';
comment on column public.brand_deals.fee is 'Agreed fee in currency; null until quoted.';
comment on column public.brand_deals.content_item_ids is 'Array reference to content_items.id. No FK (arrays cannot carry one); the app removes deleted ids (relations.ts: array_remove).';
comment on column public.brand_deals.show_in_media_kit is 'List the brand under past collaborations on the media kit.';

create index brand_deals_user_id_status_idx on public.brand_deals (user_id, status);
create index brand_deals_campaign_id_idx on public.brand_deals (campaign_id);

create trigger set_updated_at before update on public.brand_deals
  for each row execute function public.set_updated_at();

alter table public.brand_deals enable row level security;

create policy "Users can view their own brand_deals" on public.brand_deals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own brand_deals" on public.brand_deals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own brand_deals" on public.brand_deals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own brand_deals" on public.brand_deals
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.brand_deals from anon;
grant select, insert, update, delete on table public.brand_deals to authenticated;

-- ----------------------------------------------------------------------------
-- income_entries
-- ----------------------------------------------------------------------------

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null default current_date,
  amount numeric not null default 0,
  currency text not null default 'PHP',
  source text not null default 'other' check (source in ('brand_deal', 'affiliate', 'platform_payout', 'product', 'service', 'tip', 'other')),
  affiliate_program text not null default '',
  platform text check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  status text not null default 'received' check (status in ('expected', 'received')),
  brand_deal_id uuid references public.brand_deals (id) on delete set null,
  content_item_id uuid references public.content_items (id) on delete set null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.income_entries is 'Income: money received or expected, by source (brand deals, affiliate, platform payouts, products, services, tips).';
comment on column public.income_entries.affiliate_program is 'Free text for affiliate income, e.g. TikTok Shop, Shopee, Lazada.';

create index income_entries_user_id_date_idx on public.income_entries (user_id, date);
create index income_entries_brand_deal_id_idx on public.income_entries (brand_deal_id);
create index income_entries_content_item_id_idx on public.income_entries (content_item_id);

create trigger set_updated_at before update on public.income_entries
  for each row execute function public.set_updated_at();

alter table public.income_entries enable row level security;

create policy "Users can view their own income_entries" on public.income_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own income_entries" on public.income_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own income_entries" on public.income_entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own income_entries" on public.income_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.income_entries from anon;
grant select, insert, update, delete on table public.income_entries to authenticated;

-- ----------------------------------------------------------------------------
-- rate_cards
-- ----------------------------------------------------------------------------

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  platform text check (platform in ('facebook', 'tiktok', 'instagram', 'youtube', 'linkedin', 'x', 'threads')),
  deliverables text[] not null default '{}',
  price numeric,
  currency text not null default 'PHP',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rate_cards is 'Rate cards: media-kit packages with deliverables and a price (null = ask for a quote).';
comment on column public.rate_cards.platform is 'Null for a multi-platform package.';

create index rate_cards_user_id_idx on public.rate_cards (user_id);

create trigger set_updated_at before update on public.rate_cards
  for each row execute function public.set_updated_at();

alter table public.rate_cards enable row level security;

create policy "Users can view their own rate_cards" on public.rate_cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own rate_cards" on public.rate_cards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own rate_cards" on public.rate_cards
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own rate_cards" on public.rate_cards
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.rate_cards from anon;
grant select, insert, update, delete on table public.rate_cards to authenticated;
