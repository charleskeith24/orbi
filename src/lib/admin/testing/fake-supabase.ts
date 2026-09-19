/**
 * Test-only: an in-memory stand-in for the two Supabase clients the admin routes use.
 *
 * - `sessionClient()` — the signed-in visitor's cookie client: `auth.getUser()`, `auth.mfa.getAuthenticatorAssuranceLevel()`,
 *   `rpc("is_admin")` and `from()` reads with the admin read policies emulated (feedback / audit log: all rows only for an
 *   admin at aal2).
 * - `serviceClient()` — the secret-key client: `from()` without RLS, the server-only RPCs and `auth.admin.*`.
 *
 * The query builder covers the calls the admin code makes (select with count/head, insert/update/upsert/delete,
 * eq/in/gte/lt, order, range/limit, single/maybeSingle). The SQL functions are re-implemented here in a few lines;
 * their real behaviour is proven on Postgres in src/lib/admin/admin-migration.pglite.test.ts.
 * Failures can be injected per call with `fail("select:access_requests" | "rpc:revoke_admin" | "auth:inviteUserByEmail", …)`,
 * and `before(key, fn)` changes the data right before a call (a concurrent action).
 */
import { randomUUID } from "node:crypto"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export type Row = Record<string, unknown>

export interface FakeError {
  message: string
  code?: string
  status?: number
}

interface Result {
  data: unknown
  error: FakeError | null
  count?: number | null
}

export interface FakeCall {
  name: string
  args: unknown[]
}

export interface FakeUserInput {
  id?: string
  email: string
  full_name?: string
  created_at?: string
  invited_at?: string | null
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
  banned_until?: string | null
  mfa?: boolean
  admin?: boolean
}

const PRIMARY_KEYS: Record<string, string> = { admin_users: "user_id", platform_settings: "id" }

function iso(date: Date): string {
  return date.toISOString()
}

function project(row: Row, columns: string | null): Row {
  if (!columns || columns.trim() === "*") return { ...row }
  const out: Row = {}
  for (const column of columns.split(",").map((c) => c.trim()).filter(Boolean)) out[column] = row[column] ?? null
  return out
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  return String(a) < String(b) ? -1 : 1
}

function time(value: unknown): number {
  return new Date(String(value)).getTime()
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {
    users: [],
    admin_users: [],
    access_requests: [],
    admin_audit_log: [],
    platform_settings: [{ id: true, access_open: true, updated_at: "2026-09-01T00:00:00.000Z" }],
    feedback: [],
    usage_events: [],
    brand_profiles: [],
    content_ideas: [],
    content_items: [],
  }
  authUsers: User[] = []
  /** The signed-in visitor of `sessionClient()`. */
  session: { userId: string | null; aal: "aal1" | "aal2" | null } = { userId: null, aal: null }
  calls: FakeCall[] = []
  private failures = new Map<string, FakeError>()
  private hooks = new Map<string, () => void>()

  constructor(readonly now: () => Date = () => new Date("2026-09-18T10:00:00.000Z")) {}

  /* ------------------------------- fixtures -------------------------------- */

  addUser(input: FakeUserInput): User {
    const id = input.id ?? randomUUID()
    const created = input.created_at ?? "2026-09-01T00:00:00.000Z"
    const user = {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: input.email,
      app_metadata: {},
      user_metadata: input.full_name ? { full_name: input.full_name } : {},
      created_at: created,
      invited_at: input.invited_at ?? undefined,
      last_sign_in_at: input.last_sign_in_at === undefined ? created : (input.last_sign_in_at ?? undefined),
      email_confirmed_at: input.email_confirmed_at === undefined ? created : (input.email_confirmed_at ?? undefined),
      banned_until: input.banned_until ?? undefined,
      factors: input.mfa ? [{ id: `f-${id}`, factor_type: "totp", status: "verified", created_at: created, updated_at: created }] : [],
    } as unknown as User
    this.authUsers.push(user)
    this.tables.users.push({ id, email: input.email, full_name: input.full_name ?? "" })
    if (input.admin) this.tables.admin_users.push({ user_id: id, granted_by: null, created_at: created })
    return user
  }

  /** Signs `userId` in on the session client (aal2 = passed 2-step verification). */
  signIn(userId: string | null, aal: "aal1" | "aal2" = "aal2"): void {
    this.session = { userId, aal: userId ? aal : null }
  }

  fail(key: string, error: FakeError = { message: "boom" }): void {
    this.failures.set(key, error)
  }

  /** Runs `fn` once, right before the next call with this key — e.g. another admin acting at the same moment. */
  before(key: string, fn: () => void): void {
    this.hooks.set(key, fn)
  }

  private takeFailure(key: string): FakeError | null {
    const hook = this.hooks.get(key)
    if (hook) {
      this.hooks.delete(key)
      hook()
    }
    const error = this.failures.get(key) ?? null
    if (error) this.failures.delete(key)
    return error
  }

  private record(name: string, ...args: unknown[]): void {
    this.calls.push({ name, args })
  }

  callsTo(name: string): unknown[][] {
    return this.calls.filter((c) => c.name === name).map((c) => c.args)
  }

  isAdmin(userId: string | null): boolean {
    return Boolean(userId) && this.tables.admin_users.some((row) => row.user_id === userId)
  }

  private user(id: string): User | undefined {
    return this.authUsers.find((u) => u.id === id)
  }

  /* -------------------------------- clients -------------------------------- */

  sessionClient(): SupabaseClient {
    return {
      auth: {
        getUser: async () => {
          const failure = this.takeFailure("auth:getUser")
          if (failure) return { data: { user: null }, error: failure }
          const user = this.session.userId ? this.user(this.session.userId) : undefined
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "Auth session missing!", status: 400 } }
        },
        mfa: {
          getAuthenticatorAssuranceLevel: async () => {
            const failure = this.takeFailure("auth:getAuthenticatorAssuranceLevel")
            if (failure) return { data: null, error: failure }
            const user = this.session.userId ? this.user(this.session.userId) : undefined
            const next = user?.factors?.some((f) => f.status === "verified") ? "aal2" : this.session.aal
            return { data: { currentLevel: this.session.aal, nextLevel: next, currentAuthenticationMethods: [] }, error: null }
          },
        },
      },
      rpc: async (name: string) => {
        this.record(`session.rpc:${name}`)
        const failure = this.takeFailure(`rpc:${name}`)
        if (failure) return { data: null, error: failure }
        if (name === "is_admin") return { data: this.isAdmin(this.session.userId), error: null }
        return { data: null, error: { message: `permission denied for function ${name}`, code: "42501" } }
      },
      from: (table: string) =>
        new Query(this, table, (rows) => {
          const admin = this.isAdmin(this.session.userId) && this.session.aal === "aal2"
          if (table === "feedback" || table === "usage_events") return admin ? rows : rows.filter((r) => r.user_id === this.session.userId)
          if (table === "admin_audit_log") return admin ? rows : []
          throw new Error(`session client has no access to ${table} in this fake`)
        }),
    } as unknown as SupabaseClient
  }

  serviceClient(): SupabaseClient {
    return {
      from: (table: string) => new Query(this, table, (rows) => rows),
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        this.record(`rpc:${name}`, args)
        const failure = this.takeFailure(`rpc:${name}`)
        if (failure) return { data: null, error: failure }
        return { data: this.runRpc(name, args), error: null }
      },
      auth: {
        resetPasswordForEmail: async (email: string, options?: unknown) => {
          this.record("auth:resetPasswordForEmail", email, options)
          const failure = this.takeFailure("auth:resetPasswordForEmail")
          return { data: failure ? null : {}, error: failure }
        },
        admin: {
          listUsers: async (params: { page?: number; perPage?: number } = {}) => {
            this.record("auth:listUsers", params)
            const failure = this.takeFailure("auth:listUsers")
            if (failure) return { data: { users: [] }, error: failure }
            const perPage = params.perPage ?? 50
            const page = params.page ?? 1
            const users = this.authUsers.slice((page - 1) * perPage, page * perPage)
            const lastPage = Math.max(1, Math.ceil(this.authUsers.length / perPage))
            return { data: { users, aud: "authenticated", nextPage: page < lastPage ? page + 1 : null, lastPage, total: this.authUsers.length }, error: null }
          },
          getUserById: async (id: string) => {
            this.record("auth:getUserById", id)
            const failure = this.takeFailure("auth:getUserById")
            if (failure) return { data: { user: null }, error: failure }
            const user = this.user(id)
            return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "User not found", status: 404, code: "user_not_found" } }
          },
          inviteUserByEmail: async (email: string, options?: { redirectTo?: string }) => {
            this.record("auth:inviteUserByEmail", email, options)
            const failure = this.takeFailure("auth:inviteUserByEmail")
            if (failure) return { data: { user: null }, error: failure }
            const existing = this.authUsers.find((u) => u.email === email)
            if (existing?.email_confirmed_at) {
              return {
                data: { user: null },
                error: { message: "A user with this email address has already been registered", status: 422, code: "email_exists" },
              }
            }
            const invitedAt = iso(this.now())
            if (existing) {
              ;(existing as { invited_at?: string }).invited_at = invitedAt
              return { data: { user: existing }, error: null }
            }
            const user = this.addUser({ email, created_at: invitedAt, invited_at: invitedAt, last_sign_in_at: null, email_confirmed_at: null })
            return { data: { user }, error: null }
          },
          updateUserById: async (id: string, attributes: { ban_duration?: string }) => {
            this.record("auth:updateUserById", id, attributes)
            const failure = this.takeFailure("auth:updateUserById")
            if (failure) return { data: { user: null }, error: failure }
            const user = this.user(id) as (User & { banned_until?: string }) | undefined
            if (!user) return { data: { user: null }, error: { message: "User not found", status: 404, code: "user_not_found" } }
            if (attributes.ban_duration === "none") delete user.banned_until
            else if (attributes.ban_duration) {
              const hours = Number(/^(\d+)h$/.exec(attributes.ban_duration)?.[1] ?? 0)
              user.banned_until = iso(new Date(this.now().getTime() + hours * 3_600_000))
            }
            return { data: { user }, error: null }
          },
          deleteUser: async (id: string) => {
            this.record("auth:deleteUser", id)
            const failure = this.takeFailure("auth:deleteUser")
            if (failure) return { data: { user: null }, error: failure }
            const user = this.user(id)
            if (!user) return { data: { user: null }, error: { message: "User not found", status: 404, code: "user_not_found" } }
            this.authUsers = this.authUsers.filter((u) => u.id !== id)
            // What the foreign keys do: the workspace and the admin role cascade.
            this.tables.users = this.tables.users.filter((r) => r.id !== id)
            this.tables.admin_users = this.tables.admin_users.filter((r) => r.user_id !== id)
            for (const t of ["feedback", "usage_events", "brand_profiles", "content_ideas", "content_items"]) {
              this.tables[t] = this.tables[t].filter((r) => r.user_id !== id)
            }
            return { data: { user }, error: null }
          },
        },
      },
    } as unknown as SupabaseClient
  }

  /* ---------------------- the SQL functions, in brief ---------------------- */

  private runRpc(name: string, args: Record<string, unknown>): unknown {
    const now = this.now()
    switch (name) {
      case "submit_access_request": {
        const email = String(args.p_email ?? "").trim().toLowerCase()
        if (this.tables.platform_settings[0]?.access_open === false) return "closed"
        const hourAgo = now.getTime() - 3_600_000
        const recent = this.tables.access_requests.filter((r) => time(r.created_at) > hourAgo).length
        if (recent >= Number(args.p_max_per_hour ?? 30)) return "rate_limited"
        if (this.tables.users.some((u) => String(u.email).toLowerCase() === email)) return "exists"
        if (this.tables.access_requests.some((r) => r.email === email && r.status === "pending")) return "duplicate"
        this.tables.access_requests.push({
          id: randomUUID(),
          email,
          name: String(args.p_name ?? "").trim(),
          about: String(args.p_about ?? "").trim(),
          link: String(args.p_link ?? "").trim(),
          status: "pending",
          created_at: iso(now),
          decided_at: null,
          decided_by: null,
          decided_by_email: null,
        })
        return "created"
      }
      case "revoke_admin": {
        const id = args.p_user_id
        if (!this.tables.admin_users.some((r) => r.user_id === id)) return "not_admin"
        if (this.tables.admin_users.length <= 1) return "last_admin"
        this.tables.admin_users = this.tables.admin_users.filter((r) => r.user_id !== id)
        return "revoked"
      }
      case "admin_user_stats": {
        const ids = (args.p_user_ids as string[]) ?? []
        const published = (args.p_published_stages as string[]) ?? []
        return ids.map((id) => ({
          user_id: id,
          onboarding_completed: Boolean(this.tables.brand_profiles.find((r) => r.user_id === id)?.onboarding_completed),
          ideas: this.tables.content_ideas.filter((r) => r.user_id === id).length,
          content_items: this.tables.content_items.filter((r) => r.user_id === id).length,
          published: this.tables.content_items.filter((r) => r.user_id === id && published.includes(String(r.stage))).length,
        }))
      }
      case "admin_onboarding_funnel": {
        const steps = new Map<string, { step: string; step_index: number | null; viewed: Set<unknown>; completed: Set<unknown> }>()
        for (const e of this.tables.usage_events) {
          if (e.name !== "onboarding_step_viewed" && e.name !== "onboarding_step_completed") continue
          const props = (e.props ?? {}) as { step?: string; index?: number }
          if (!props.step) continue
          const entry = steps.get(props.step) ?? { step: props.step, step_index: null, viewed: new Set(), completed: new Set() }
          if (typeof props.index === "number") entry.step_index = entry.step_index === null ? props.index : Math.min(entry.step_index, props.index)
          ;(e.name === "onboarding_step_viewed" ? entry.viewed : entry.completed).add(e.user_id)
          steps.set(props.step, entry)
        }
        return [...steps.values()]
          .sort((a, b) => compare(a.step_index, b.step_index) || compare(a.step, b.step))
          .map((s) => ({ step: s.step, step_index: s.step_index, viewed: s.viewed.size, completed: s.completed.size }))
      }
      default:
        throw new Error(`Unknown rpc ${name}`)
    }
  }

  /** Used by Query: fills the defaults Postgres would. */
  withDefaults(table: string, row: Row): Row {
    const now = iso(this.now())
    const base: Row = table === "admin_users" ? { granted_by: null, created_at: now } : { id: randomUUID(), created_at: now }
    if (table === "admin_audit_log") Object.assign(base, { admin_email: "", target_user_id: null, target_email: null, details: {} })
    return { ...base, ...row }
  }

  takeQueryFailure(op: string, table: string): FakeError | null {
    return this.takeFailure(`${op}:${table}`)
  }
}

type Op = "select" | "insert" | "update" | "upsert" | "delete"

class Query implements PromiseLike<Result> {
  private op: Op = "select"
  private columns: string | null = "*"
  private returning = false
  private countExact = false
  private head = false
  private payload: Row[] = []
  private ignoreDuplicates = false
  private filters: ((row: Row) => boolean)[] = []
  private orders: { column: string; ascending: boolean }[] = []
  private window: { from: number; to: number } | null = null
  private singleMode: "one" | "maybe" | null = null

  constructor(
    private readonly fake: FakeSupabase,
    private readonly table: string,
    private readonly scope: (rows: Row[]) => Row[]
  ) {}

  select(columns = "*", options: { count?: "exact"; head?: boolean } = {}) {
    if (this.op === "select") {
      this.columns = columns
      this.countExact = options.count === "exact"
      this.head = Boolean(options.head)
    } else {
      this.returning = true
      this.columns = columns
    }
    return this
  }
  insert(rows: Row | Row[]) {
    this.op = "insert"
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  upsert(rows: Row | Row[], options: { ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert"
    this.payload = Array.isArray(rows) ? rows : [rows]
    this.ignoreDuplicates = Boolean(options.ignoreDuplicates)
    return this
  }
  update(patch: Row) {
    this.op = "update"
    this.payload = [patch]
    return this
  }
  delete() {
    this.op = "delete"
    return this
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }
  gte(column: string, value: string) {
    this.filters.push((row) => time(row[column]) >= time(value))
    return this
  }
  lt(column: string, value: string) {
    this.filters.push((row) => time(row[column]) < time(value))
    return this
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending ?? true })
    return this
  }
  range(from: number, to: number) {
    this.window = { from, to }
    return this
  }
  limit(count: number) {
    const from = this.window?.from ?? 0
    this.window = { from, to: from + count - 1 }
    return this
  }
  maybeSingle() {
    this.singleMode = "maybe"
    return this
  }
  single() {
    this.singleMode = "one"
    return this
  }

  then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected)
  }

  private rows(): Row[] {
    this.fake.tables[this.table] ??= []
    return this.fake.tables[this.table]
  }

  private finish(rows: Row[], count: number | null = null): Result {
    const data = rows.map((row) => project(row, this.columns))
    if (this.singleMode) {
      if (data.length > 1 || (this.singleMode === "one" && data.length === 0)) {
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count }
      }
      return { data: data[0] ?? null, error: null, count }
    }
    return { data, error: null, count }
  }

  private execute(): Result {
    const failure = this.fake.takeQueryFailure(this.op, this.table)
    if (failure) return { data: null, error: failure }
    const matches = (row: Row) => this.filters.every((f) => f(row))

    if (this.op === "select") {
      let rows = this.scope(this.rows()).filter(matches)
      for (const { column, ascending } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]))
      }
      const count = this.countExact ? rows.length : null
      if (this.window) rows = rows.slice(this.window.from, this.window.to + 1)
      if (this.head) return { data: null, error: null, count }
      return this.finish(rows, count)
    }

    if (this.op === "insert" || this.op === "upsert") {
      const key = PRIMARY_KEYS[this.table] ?? "id"
      const inserted: Row[] = []
      for (const input of this.payload) {
        const row = this.fake.withDefaults(this.table, input)
        if (this.rows().some((r) => r[key] === row[key])) {
          if (this.op === "upsert" && this.ignoreDuplicates) continue
          return { data: null, error: { message: `duplicate key value violates unique constraint "${this.table}_pkey"`, code: "23505" } }
        }
        this.rows().push(row)
        inserted.push(row)
      }
      return this.returning ? this.finish(inserted) : { data: null, error: null }
    }

    if (this.op === "update") {
      const changed = this.rows().filter(matches)
      for (const row of changed) Object.assign(row, this.payload[0])
      return this.returning ? this.finish(changed) : { data: null, error: null }
    }

    const removed = this.rows().filter(matches)
    this.fake.tables[this.table] = this.rows().filter((row) => !matches(row))
    return this.returning ? this.finish(removed) : { data: null, error: null }
  }
}

