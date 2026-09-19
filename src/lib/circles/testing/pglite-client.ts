/**
 * Test-only: the slice of supabase-js that `features/circles/api/supabase-api.ts` uses, executed against
 * PGlite the way PostgREST executes a request — one transaction per request, as the `authenticated` role
 * with the user's JWT claims, so row-level security, grants and the circle functions all apply.
 *
 * - `from(t).select(cols)` with `eq` / `in` / `gte` / `order`;
 * - `insert`, `update`, `upsert(row, { onConflict })` and `delete`, optionally followed by `.select(cols)`;
 * - `rpc(fn, args)` with named arguments: set-returning functions answer an array, scalars a value, void null.
 *
 * Errors come back as `{ data: null, error: { code, message } }`, never thrown. A stand-in, not PostgREST.
 */
import type { PGlite } from "@electric-sql/pglite"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ident } from "@/lib/supabase/testing/pglite"

type Row = Record<string, unknown>
type Response = { data: unknown; error: { code: string; message: string } | null }
type Filter = { column: string; op: "in" | "gte"; values: unknown[] }

function toError(error: unknown) {
  const e = error as { code?: string; message?: string }
  return { code: e.code ?? "", message: e.message ?? String(error) }
}

export function createPgliteSupabase(db: PGlite, userId: string | null): SupabaseClient {
  let queue: Promise<unknown> = Promise.resolve()
  /** PGlite is one connection: requests (the API fires some in parallel) run one at a time. */
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn)
    queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  async function asUser<T>(fn: (q: PGlite) => Promise<T>): Promise<Response> {
    return exclusive(async () => {
      try {
        const data = await db.transaction(async (tx) => {
          const claims = JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "authenticated" })
          await tx.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [claims])
          return fn(tx as unknown as PGlite)
        })
        return { data, error: null }
      } catch (error) {
        return { data: null, error: toError(error) }
      }
    })
  }

  const columnList = (list: string) => list.split(",").map((c) => ident(c.trim())).join(", ")

  class Builder implements PromiseLike<Response> {
    private method: "select" | "insert" | "update" | "upsert" | "delete" = "select"
    private columns = ""
    private returning: string | null = null
    private payload: Row[] = []
    private conflict = ""
    private filters: Filter[] = []
    private orders: { column: string; ascending: boolean }[] = []

    constructor(private readonly table: string) {}

    select(columns: string) {
      if (this.method === "select") this.columns = columns
      else this.returning = columns
      return this
    }
    insert(values: Row | Row[]) {
      this.method = "insert"
      this.payload = Array.isArray(values) ? values : [values]
      return this
    }
    upsert(values: Row | Row[], options: { onConflict: string }) {
      this.method = "upsert"
      this.payload = Array.isArray(values) ? values : [values]
      this.conflict = options.onConflict
      return this
    }
    update(values: Row) {
      this.method = "update"
      this.payload = [values]
      return this
    }
    delete() {
      this.method = "delete"
      return this
    }
    eq(column: string, value: unknown) {
      this.filters.push({ column, op: "in", values: [value] })
      return this
    }
    in(column: string, values: unknown[]) {
      this.filters.push({ column, op: "in", values })
      return this
    }
    gte(column: string, value: unknown) {
      this.filters.push({ column, op: "gte", values: [value] })
      return this
    }
    order(column: string, options: { ascending?: boolean } = {}) {
      this.orders.push({ column, ascending: options.ascending ?? true })
      return this
    }

    then<A = Response, B = never>(onfulfilled?: ((value: Response) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return this.execute().then(onfulfilled, onrejected)
    }

    private execute(): Promise<Response> {
      return asUser(async (q) => {
        const t = `public.${ident(this.table)}`
        const params: unknown[] = []
        const param = (value: unknown) => `$${params.push(value)}`
        const where = this.filters.length
          ? `where ${this.filters
              .map((f) =>
                f.op === "in"
                  ? `t.${ident(f.column)}::text in (select json_array_elements_text(${param(JSON.stringify(f.values.map(String)))}::json))`
                  : `t.${ident(f.column)} >= ${param(f.values[0])}`
              )
              .join(" and ")}`
          : ""
        const agg = async (sql: string) => {
          const result = await q.query<{ body: string }>(sql, params)
          return JSON.parse(result.rows[0].body) as unknown
        }

        if (this.method === "select") {
          const order = this.orders.length ? `order by ${this.orders.map((o) => `${ident(o.column)} ${o.ascending ? "asc" : "desc"}`).join(", ")}` : ""
          return agg(`select coalesce(json_agg(x), '[]'::json)::text as body from (select ${columnList(this.columns)} from ${t} as t ${where} ${order}) x`)
        }

        const keys = [...new Set(this.payload.flatMap((row) => Object.keys(row)))]
        const cols = keys.map(ident).join(", ")
        let statement: string
        if (this.method === "insert" || this.method === "upsert") {
          const rows = param(JSON.stringify(this.payload))
          statement = `insert into ${t} as t (${cols}) select ${cols} from json_populate_recordset(null::${t}, ${rows}::json)`
          if (this.method === "upsert") {
            statement += ` on conflict (${columnList(this.conflict)}) do update set ${keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ")}`
          }
        } else if (this.method === "update") {
          const patch = param(JSON.stringify(this.payload[0]))
          statement = `update ${t} as t set ${keys.map((k) => `${ident(k)} = patch.${ident(k)}`).join(", ")} from json_populate_record(null::${t}, ${patch}::json) as patch ${where}`
        } else {
          statement = `delete from ${t} as t ${where}`
        }
        if (!this.returning) {
          await q.query(statement, params)
          return null
        }
        const returning = this.returning.split(",").map((c) => `t.${ident(c.trim())}`).join(", ")
        return agg(`with changed as (${statement} returning ${returning}) select coalesce(json_agg(changed), '[]'::json)::text as body from changed`)
      })
    }
  }

  async function rpc(fn: string, args: Row = {}): Promise<Response> {
    return asUser(async (q) => {
      const { rows } = await q.query<{ proretset: boolean; rettype: string }>(
        "select proretset, prorettype::regtype::text as rettype from pg_proc where pronamespace = 'public'::regnamespace and proname = $1",
        [fn]
      )
      if (!rows.length) throw Object.assign(new Error(`Could not find the function public.${fn}`), { code: "PGRST202" })
      const names = Object.keys(args)
      const call = `public.${ident(fn)}(${names.map((name, i) => `${ident(name)} => $${i + 1}`).join(", ")})`
      const values = names.map((name) => args[name])
      if (rows[0].proretset) {
        const result = await q.query<{ body: string }>(`select coalesce(json_agg(x), '[]'::json)::text as body from ${call} x`, values)
        return JSON.parse(result.rows[0].body) as unknown
      }
      if (rows[0].rettype === "void") {
        await q.query(`select ${call}`, values)
        return null
      }
      const result = await q.query<{ body: string }>(`select to_json(${call})::text as body`, values)
      return JSON.parse(result.rows[0].body) as unknown
    })
  }

  return { from: (table: string) => new Builder(table), rpc } as unknown as SupabaseClient
}
