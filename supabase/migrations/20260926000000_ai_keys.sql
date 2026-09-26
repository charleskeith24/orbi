-- ============================================================================
-- Your own AI key (bring your own key): one per account, encrypted, server only
-- ============================================================================
--
-- Online, AI runs on each person's own provider key — Claude, OpenAI or Gemini — so nobody's AI is billed to
-- the site owner (ARCHITECTURE §7). The server encrypts the key with AI_KEY_SECRET (an environment variable,
-- never stored here) before it reaches this table, bound to the account id: a copy of the database alone
-- can't reveal anyone's key.
--
-- Gemini also joins the engines a draft can come from: the CHECK lists on generated_by / provider below
-- gain 'gemini' (new databases get them from the init migration; this updates existing ones).
--
-- Nobody signed in can read or write this table, not even their own row: after saving, the browser never
-- sees a key again. Only the server's secret key (service_role) uses it, through /api/ai/key and the AI
-- gateway. Deleting the account deletes the key.

create table public.ai_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'gemini')),
  model text not null check (char_length(model) between 1 and 120),
  model_meta jsonb not null default '{}'::jsonb check (jsonb_typeof(model_meta) = 'object'),
  key_hint text not null default '' check (char_length(key_hint) <= 8),
  key_ciphertext text not null check (key_ciphertext like 'v1.%' and char_length(key_ciphertext) <= 2000),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_keys is 'Each account''s own AI provider key (bring your own key), encrypted by the server with AI_KEY_SECRET. Server only: no grants or policies for signed-in users.';
comment on column public.ai_keys.key_ciphertext is 'AES-256-GCM as v1.<iv>.<ciphertext>.<tag>, bound to user_id. Never returned to the browser.';
comment on column public.ai_keys.key_hint is 'The key''s last four characters, so a person can tell their keys apart.';
comment on column public.ai_keys.model_meta is 'What Orbi keeps about the chosen model, e.g. {"effort": ["low", "medium", "high"]} for Claude.';

alter table public.ai_keys enable row level security;

revoke all on table public.ai_keys from anon, authenticated, service_role;
grant select, insert, update, delete on table public.ai_keys to service_role;

create trigger ai_keys_set_updated_at
  before update on public.ai_keys
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Gemini-written drafts: the engine lists on scripts, reviews and the AI log
-- ----------------------------------------------------------------------------

alter table public.content_scripts drop constraint if exists content_scripts_generated_by_check;
alter table public.content_scripts add constraint content_scripts_generated_by_check
  check (generated_by in ('anthropic', 'openai', 'gemini', 'offline', 'manual'));

alter table public.weekly_reviews drop constraint if exists weekly_reviews_generated_by_check;
alter table public.weekly_reviews add constraint weekly_reviews_generated_by_check
  check (generated_by in ('anthropic', 'openai', 'gemini', 'offline', 'manual'));

alter table public.monthly_reviews drop constraint if exists monthly_reviews_generated_by_check;
alter table public.monthly_reviews add constraint monthly_reviews_generated_by_check
  check (generated_by in ('anthropic', 'openai', 'gemini', 'offline', 'manual'));

alter table public.ai_generations drop constraint if exists ai_generations_provider_check;
alter table public.ai_generations add constraint ai_generations_provider_check
  check (provider in ('anthropic', 'openai', 'gemini', 'offline'));
