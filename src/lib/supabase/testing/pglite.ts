/**
 * Test-only harness: the Supabase migrations on a real Postgres engine — PGlite, Postgres compiled to
 * WASM, running in memory inside the test process.
 *
 * A stub stands in for what the hosted platform provides before any migration runs:
 * - the `auth` schema with `auth.users` (the columns the migrations use) and `auth.uid()`,
 *   `auth.role()` and `auth.jwt()` reading the request's JWT claims from the transaction-local
 *   settings PostgREST sets (`request.jwt.claims`);
 * - the `storage` schema's `buckets` and `objects` tables (row-level security on, the platform's grants),
 *   so storage policies can be tested as SQL;
 * - the `anon`, `authenticated` and `service_role` roles;
 * - Supabase's default privileges on `public` (every new table granted to all three roles, which is
 *   why the migrations revoke `anon` explicitly).
 *
 * Proves the SQL: tables, types, CHECKs, foreign keys, triggers, grants and row-level security.
 * Doesn't prove PostgREST, Supabase Auth or hosted-project settings.
 */
import { readdirSync, readFileSync } from "node:fs"
import { PGlite, type Transaction } from "@electric-sql/pglite"

export const MIGRATIONS_DIR = new URL("../../../../supabase/migrations/", import.meta.url)

export type Queryable = Pick<Transaction, "query" | "exec">
export type RequestRole = "anon" | "authenticated" | "service_role"
export type JsonRow = Record<string, unknown>

export const SUPABASE_STUB_SQL = `
create schema if not exists auth;
create schema if not exists extensions;

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

-- Supabase Storage: the two tables the migrations and policies touch (buckets, objects), with RLS on and the
-- platform's grants. The Storage API itself (uploads, signed URLs, file bytes) isn't stubbed.
create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  owner_id text,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  owner_id text,
  metadata jsonb,
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

set timezone to 'UTC';
`

export interface Migration {
  file: string
  sql: string
}

/** Every `supabase/migrations/*.sql` file, in the order Supabase applies them (by file name). */
export function readMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(new URL(file, MIGRATIONS_DIR), "utf8") }))
}

function sqlErrorMessage(file: string, sql: string, error: unknown): string {
  const e = error as { message?: string; position?: string; detail?: string }
  const offset = Number(e.position)
  const line = Number.isFinite(offset) && offset > 0 ? sql.slice(0, offset).split("\n").length : null
  const excerpt = line ? `\n  → line ${line}: ${sql.split("\n")[line - 1]?.trim()}` : ""
  return `Migration ${file} failed: ${e.message ?? String(error)}${e.detail ? ` (${e.detail})` : ""}${excerpt}`
}

/** Applies the migrations one file at a time and returns the file names that ran. */
export async function applyMigrations(db: PGlite, migrations: Migration[] = readMigrations()): Promise<string[]> {
  const applied: string[] = []
  for (const { file, sql } of migrations) {
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(sqlErrorMessage(file, sql, error))
    }
    applied.push(file)
  }
  return applied
}

/** A fresh in-memory Postgres with the Supabase stub and every migration applied. */
export async function createSupabaseTestDb(): Promise<{ db: PGlite; migrations: string[] }> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB_SQL)
  const migrations = await applyMigrations(db)
  return { db, migrations }
}

/** Inserts an auth user the way sign-up does (the `on_auth_user_created` trigger fires). */
export async function createAuthUser(q: Queryable, user: { id: string; email: string; fullName?: string }): Promise<string> {
  const meta = JSON.stringify(user.fullName ? { full_name: user.fullName } : {})
  await q.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [user.id, user.email, meta])
  return user.id
}

/** Switches the current transaction to a request role with the user's JWT claims — what PostgREST does per request. */
export async function setRequestRole(q: Queryable, role: RequestRole, userId: string | null): Promise<void> {
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role })
  await q.query("select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)", [role, claims])
}

/** Runs `fn` in its own transaction as `role` (committed unless `fn` throws or rolls back). */
export async function withRole<T>(db: PGlite, role: RequestRole, userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await setRequestRole(tx, role, userId)
    return fn(tx)
  })
}

/** Quotes an identifier after checking it is a plain lower-case name (tests never build SQL from free text). */
export function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected identifier: ${name}`)
  return `"${name}"`
}

/** Inserts rows as JSON, like PostgREST (`json_populate_recordset`): Postgres does every type conversion. */
export async function insertJson(q: Queryable, table: string, rows: readonly JsonRow[]): Promise<number> {
  if (!rows.length) return 0
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].map(ident).join(", ")
  const t = ident(table)
  const result = await q.query(
    `insert into public.${t} (${columns}) select ${columns} from json_populate_recordset(null::public.${t}, $1::json)`,
    [JSON.stringify(rows)]
  )
  return result.affectedRows ?? 0
}

/** Rows as PostgREST would return them (`json_agg`: timestamps as ISO strings, numerics as numbers), ordered by id. */
export async function selectJson(q: Queryable, table: string, where = "", params: unknown[] = []): Promise<JsonRow[]> {
  const result = await q.query<{ body: string }>(
    `select coalesce(json_agg(x order by x.id), '[]'::json)::text as body from (select * from public.${ident(table)} ${where}) x`,
    params
  )
  return JSON.parse(result.rows[0].body) as JsonRow[]
}

/** Every listed table in one round trip (chunked: json_build_object takes at most 100 arguments). */
export async function snapshotTables(q: Queryable, tables: readonly string[]): Promise<Record<string, JsonRow[]>> {
  const out: Record<string, JsonRow[]> = {}
  for (let i = 0; i < tables.length; i += 40) {
    const parts = tables
      .slice(i, i + 40)
      .map((t) => `'${t}', (select coalesce(json_agg(x order by x.id), '[]'::json) from public.${ident(t)} x)`)
    const result = await q.query<{ body: string }>(`select json_build_object(${parts.join(", ")})::text as body`)
    Object.assign(out, JSON.parse(result.rows[0].body) as Record<string, JsonRow[]>)
  }
  return out
}

/** `udt_name` of every column of every table in `public` (e.g. `timestamptz`, `numeric`, `_uuid`). */
export async function columnTypes(q: Queryable): Promise<Map<string, Map<string, string>>> {
  const result = await q.query<{ table_name: string; column_name: string; udt_name: string }>(
    "select table_name, column_name, udt_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position"
  )
  const out = new Map<string, Map<string, string>>()
  for (const { table_name, column_name, udt_name } of result.rows) {
    const table = out.get(table_name) ?? new Map<string, string>()
    table.set(column_name, udt_name)
    out.set(table_name, table)
  }
  return out
}

/**
 * A row in a form that compares equal whether it came from the app (`…T09:00:00.000Z`) or from
 * Postgres (`…T09:00:00+00:00`). `omit` drops columns that legitimately differ (e.g. `updated_at`).
 */
export function canonicalRow(row: JsonRow, types: Map<string, string> | undefined, omit: readonly string[] = []): JsonRow {
  const out: JsonRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (omit.includes(key) || value === undefined) continue
    out[key] = value !== null && types?.get(key) === "timestamptz" ? new Date(value as string).toISOString() : value
  }
  return out
}

export function canonicalRows(rows: readonly JsonRow[], types: Map<string, string> | undefined, omit: readonly string[] = []): JsonRow[] {
  return rows
    .map((row) => canonicalRow(row, types, omit))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}
