/**
 * Test-only: the slice of supabase-js the Supabase adapter uses (`from(table)` → `select` / `insert` /
 * `update` / `delete`, `eq`, `in`, `order`, `range`, `select()` after a write), executed against
 * PGlite the way PostgREST executes a request:
 * - one transaction per request, as the `authenticated` role with the user's JWT claims;
 * - rows in as JSON through `json_populate_recordset` (missing keys become null, as with supabase-js'
 *   default `defaultToNull`), rows out through `json_agg`;
 * - keys that aren't columns fail with PostgREST's `PGRST204` before touching the database;
 * - errors come back as `{ data: null, error: { code, message, details, hint } }`, never thrown.
 *
 * It is a stand-in, not PostgREST: no HTTP, no schema cache, no request size limits.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { ident, type JsonRow, type Queryable } from "./pglite"

export interface FakePostgrestError {
  code: string
  message: string
  details: string | null
  hint: string | null
}

export interface FakeRequest {
  table: string
  method: "select" | "insert" | "update" | "delete"
  rows: number
}

export interface FakeSupabaseOptions {
  /**
   * `true` when `q` is a transaction the test will roll back: requests then run inside savepoints
   * instead of their own transactions.
   */
  nested?: boolean
  /** Return an error to fail a request before it reaches Postgres (e.g. a dropped connection). */
  intercept?: (request: FakeRequest, index: number) => FakePostgrestError | null | undefined
}

export interface FakeSupabase {
  client: SupabaseClient
  /** Every request made so far, in order. */
  requests: FakeRequest[]
}

interface Filter {
  column: string
  values: unknown[]
}

type Response = { data: unknown; error: FakePostgrestError | null }

function toPostgrestError(error: unknown): FakePostgrestError {
  const e = error as { code?: string; message?: string; detail?: string; hint?: string }
  return { code: e.code ?? "", message: e.message ?? String(error), details: e.detail ?? null, hint: e.hint ?? null }
}

export function createFakeSupabase(q: Queryable, userId: string, options: FakeSupabaseOptions = {}): FakeSupabase {
  const requests: FakeRequest[] = []
  const columnCache = new Map<string, Set<string>>()
  let queue: Promise<unknown> = Promise.resolve()

  /** PGlite is one connection: requests (the adapter fires some in parallel) run one at a time. */
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn)
    queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  async function columnsOf(table: string): Promise<Set<string> | null> {
    if (!columnCache.has(table)) {
      const result = await q.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
        [table]
      )
      if (!result.rows.length) return null
      columnCache.set(table, new Set(result.rows.map((r) => r.column_name)))
    }
    return columnCache.get(table)!
  }

  async function inRequest(fn: () => Promise<unknown>): Promise<unknown> {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" })
    const setRole = () =>
      q.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [claims])
    if (options.nested) {
      await q.exec("savepoint pgrst_request")
      try {
        await setRole()
        const result = await fn()
        await q.exec("release savepoint pgrst_request")
        return result
      } catch (error) {
        await q.exec("rollback to savepoint pgrst_request; release savepoint pgrst_request")
        throw error
      } finally {
        await q.exec("reset role")
      }
    }
    await q.exec("begin")
    try {
      await setRole()
      const result = await fn()
      await q.exec("commit")
      return result
    } catch (error) {
      await q.exec("rollback")
      throw error
    }
  }

  class Builder implements PromiseLike<Response> {
    private method: FakeRequest["method"] = "select"
    private columns = "*"
    private payload: JsonRow[] = []
    private filters: Filter[] = []
    private orders: { column: string; ascending: boolean }[] = []
    private window: { from: number; to: number } | null = null
    private returning: string | null = null

    constructor(private readonly table: string) {}

    select(columns = "*") {
      if (this.method === "select") this.columns = columns
      else this.returning = columns
      return this
    }
    insert(values: JsonRow | JsonRow[]) {
      this.method = "insert"
      this.payload = Array.isArray(values) ? values : [values]
      return this
    }
    update(values: JsonRow) {
      this.method = "update"
      this.payload = [values]
      return this
    }
    delete() {
      this.method = "delete"
      return this
    }
    eq(column: string, value: unknown) {
      this.filters.push({ column, values: [value] })
      return this
    }
    in(column: string, values: unknown[]) {
      this.filters.push({ column, values })
      return this
    }
    order(column: string, opts: { ascending?: boolean } = {}) {
      this.orders.push({ column, ascending: opts.ascending ?? true })
      return this
    }
    range(from: number, to: number) {
      this.window = { from, to }
      return this
    }

    then<A = Response, B = never>(
      onfulfilled?: ((value: Response) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
      return this.execute().then(onfulfilled, onrejected)
    }

    private selectList(list: string): string {
      return list.trim() === "*" ? "*" : list.split(",").map((c) => ident(c.trim())).join(", ")
    }

    private async execute(): Promise<Response> {
      const request: FakeRequest = { table: this.table, method: this.method, rows: this.payload.length }
      const index = requests.push(request) - 1
      const injected = options.intercept?.(request, index)
      if (injected) return { data: null, error: injected }

      return exclusive(async () => {
        const known = await columnsOf(this.table)
        if (!known) {
          return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${this.table}' in the schema cache`, details: null, hint: null } }
        }
        const keys = [...new Set(this.payload.flatMap((row) => Object.keys(row)))]
        const unknown = keys.find((key) => !known.has(key))
        if (unknown) {
          return { data: null, error: { code: "PGRST204", message: `Could not find the '${unknown}' column of '${this.table}' in the schema cache`, details: null, hint: null } }
        }
        try {
          const body = (await inRequest(() => this.run(keys))) as string | null
          return { data: body === null ? null : JSON.parse(body), error: null }
        } catch (error) {
          return { data: null, error: toPostgrestError(error) }
        }
      })
    }

    private async run(keys: string[]): Promise<string | null> {
      const t = `public.${ident(this.table)}`
      const params: unknown[] = []
      const param = (value: unknown) => `$${params.push(value)}`
      const payload = this.method === "insert" || this.method === "update" ? param(JSON.stringify(this.method === "update" ? this.payload[0] : this.payload)) : ""
      const where = this.filters.length
        ? `where ${this.filters
            .map((f) => `t.${ident(f.column)}::text in (select json_array_elements_text(${param(JSON.stringify(f.values.map(String)))}::json))`)
            .join(" and ")}`
        : ""
      const cols = keys.map(ident).join(", ")

      let statement: string
      if (this.method === "select") {
        const order = this.orders.length ? `order by ${this.orders.map((o) => `${ident(o.column)} ${o.ascending ? "asc" : "desc"}`).join(", ")}` : ""
        const limit = this.window ? `limit ${this.window.to - this.window.from + 1} offset ${this.window.from}` : ""
        const result = await q.query<{ body: string }>(
          `select coalesce(json_agg(x), '[]'::json)::text as body from (select ${this.selectList(this.columns)} from ${t} as t ${where} ${order} ${limit}) x`,
          params
        )
        return result.rows[0].body
      }
      if (this.method === "insert") {
        if (!keys.length) return this.returning ? "[]" : null
        statement = `insert into ${t} as t (${cols}) select ${cols} from json_populate_recordset(null::${t}, ${payload}::json)`
      } else if (this.method === "update") {
        if (!keys.length) return this.returning ? "[]" : null
        const assignments = keys.map((k) => `${ident(k)} = patch.${ident(k)}`).join(", ")
        statement = `update ${t} as t set ${assignments} from json_populate_record(null::${t}, ${payload}::json) as patch ${where}`
      } else {
        statement = `delete from ${t} as t ${where}`
      }

      if (!this.returning) {
        await q.query(statement, params)
        return null
      }
      const result = await q.query<{ body: string }>(
        `with changed as (${statement} returning t.*) select coalesce(json_agg(x), '[]'::json)::text as body from (select ${this.selectList(this.returning)} from changed) x`,
        params
      )
      return result.rows[0].body
    }
  }

  const client = { from: (table: string) => new Builder(table) } as unknown as SupabaseClient
  return { client, requests }
}
