/**
 * Guards supabase/migrations against drift from the TypeScript model:
 * columns, SQL types, nullability, enum CHECK lists and literal defaults
 * (vs types.ts + TABLE_DEFAULTS), foreign keys (vs relations.ts), indexes,
 * RLS and triggers — and that the demo workspace imports into Postgres as-is.
 */
import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { TABLE_DEFAULTS, TABLE_NAMES } from "@/lib/data/defaults"
import { REFERENCES } from "@/lib/data/relations"
import { createDemoDatabase } from "@/lib/data/seed"
import type { TableName } from "@/lib/types"

const MIGRATIONS_DIR = new URL("../../../supabase/migrations/", import.meta.url)
const TYPES_FILE = new URL("../types.ts", import.meta.url)

const META_COLUMNS = ["id", "user_id", "created_at", "updated_at"]
/** References that deliberately have no FK (documented with a COMMENT in the migration). */
const SOFT_REFERENCES = new Set(["content_ideas.converted_item_id"])
/** Polymorphic references: no FK possible, must be documented. */
const POLYMORPHIC_REFERENCES = ["content_tags.entity_id", "content_ideas.source_ref_id", "ai_generations.entity_id"]
const RULE_SQL: Record<string, string> = { cascade: "cascade", set_null: "set null" }
/**
 * `number` fields that legitimately hold fractions (rates, multipliers, durations, user-typed
 * quantities such as 1.5 years or 0.5 posts a week). An integer column would reject them in
 * Supabase mode only, which local mode never exercises.
 */
const FRACTIONAL_FIELDS = [
  "brand_profiles.years_experience",
  "content_platforms.posting_frequency",
  "content_pillars.target_percentage",
  "content_metrics.watch_time_seconds",
  "content_metrics.avg_retention",
  "ai_generations.duration_ms",
  "app_settings.tier_good",
  "app_settings.tier_winner",
  "app_settings.tier_breakout",
  "app_settings.pillar_tolerance",
]

/* ------------------------------ SQL parsing ------------------------------ */

interface SqlColumn {
  name: string
  type: string
  notNull: boolean
  defaultExpr: string | null
  references: { schema: string; table: string; onDelete: string } | null
  check: string | null
}

interface SqlTable {
  name: string
  columns: SqlColumn[]
  /** Column lists of the primary key and table-level unique constraints. */
  uniqueKeys: string[][]
}

/** Removes `-- …` comments outside string literals. */
function stripComments(sql: string): string {
  let out = ""
  let inString = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (inString) {
      out += ch
      if (ch === "'") inString = false
    } else if (ch === "'") {
      inString = true
      out += ch
    } else if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++
      out += "\n"
    } else out += ch
  }
  return out
}

/** Index of the parenthesis closing the one at `open`, skipping string literals. */
function matchingParen(text: string, open: number): number {
  let depth = 0
  let inString = false
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === "'") inString = false
    } else if (ch === "'") inString = true
    else if (ch === "(") depth++
    else if (ch === ")" && --depth === 0) return i
  }
  throw new Error(`Unbalanced parentheses at ${open}`)
}

/** Splits on commas that are not nested in (), [] or string literals. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let inString = false
  let current = ""
  for (const ch of body) {
    if (inString) {
      current += ch
      if (ch === "'") inString = false
      continue
    }
    if (ch === "'") inString = true
    else if (ch === "(" || ch === "[") depth++
    else if (ch === ")" || ch === "]") depth--
    else if (ch === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** Reads one default expression: a literal (with optional cast), a parenthesised expression or a bare token. */
function readDefault(rest: string): string | null {
  const m = /\bdefault\s+/i.exec(rest)
  if (!m) return null
  let i = m.index + m[0].length
  const start = i
  if (rest[i] === "'") {
    i++
    while (i < rest.length && !(rest[i] === "'" && rest[i + 1] !== "'")) i += rest[i] === "'" ? 2 : 1
    i++
  } else if (rest[i] === "(") i = matchingParen(rest, i) + 1
  else while (i < rest.length && !/\s/.test(rest[i])) i++
  const cast = /^::\w+(\[\])?/.exec(rest.slice(i))
  return rest.slice(start, i + (cast ? cast[0].length : 0))
}

const COLUMN_RE =
  /^("?)(\w+)\1\s+(uuid\[\]|text\[\]|timestamptz|integer|smallint|bigint|numeric|boolean|jsonb|date|text|uuid)(?=\s|$)([\s\S]*)$/i

function parseColumn(definition: string): SqlColumn {
  const m = COLUMN_RE.exec(definition)
  if (!m) throw new Error(`Unrecognised column definition: ${definition}`)
  const rest = m[4]
  const ref = /\breferences\s+(\w+)\.(\w+)\s*\(\s*id\s*\)(?:\s+on delete\s+(cascade|set null|restrict|no action))?/i.exec(rest)
  const checkAt = rest.search(/\bcheck\s*\(/i)
  let check: string | null = null
  if (checkAt >= 0) {
    const open = rest.indexOf("(", checkAt)
    check = rest.slice(open + 1, matchingParen(rest, open))
  }
  return {
    name: m[2],
    type: m[3].toLowerCase(),
    notNull: /\bnot null\b/i.test(rest) || /\bprimary key\b/i.test(rest),
    defaultExpr: readDefault(rest),
    references: ref ? { schema: ref[1], table: ref[2], onDelete: (ref[3] ?? "no action").toLowerCase() } : null,
    check,
  }
}

function parseTables(sql: string): Map<string, SqlTable> {
  const tables = new Map<string, SqlTable>()
  const re = /create table public\.(\w+)\s*\(/gi
  for (const m of sql.matchAll(re)) {
    const open = m.index + m[0].length - 1
    const body = sql.slice(open + 1, matchingParen(sql, open))
    const table: SqlTable = { name: m[1], columns: [], uniqueKeys: [] }
    for (const entry of splitTopLevel(body)) {
      const constraint = /^(?:constraint\s+\w+\s+)?(unique|primary key|check|foreign key)\b\s*(?:\(([^)]*)\))?/i.exec(entry)
      if (constraint) {
        if (/unique|primary key/i.test(constraint[1]) && constraint[2]) {
          table.uniqueKeys.push(constraint[2].split(",").map((c) => c.trim()))
        }
        continue
      }
      const column = parseColumn(entry)
      if (/\bprimary key\b|\bunique\b/i.test(entry.replace(/check\s*\([\s\S]*$/i, ""))) table.uniqueKeys.push([column.name])
      table.columns.push(column)
    }
    tables.set(table.name, table)
  }
  // Later migrations may add columns.
  for (const m of sql.matchAll(/alter table public\.(\w+)\s+add column\s+(?:if not exists\s+)?([^;]+);/gi)) {
    tables.get(m[1])?.columns.push(parseColumn(m[2].trim()))
  }
  return tables
}

interface SqlIndex {
  table: string
  unique: boolean
  columns: string[]
}

function parseIndexes(sql: string, tables: Map<string, SqlTable>): SqlIndex[] {
  const indexes: SqlIndex[] = []
  for (const m of sql.matchAll(/create (unique )?index (?:if not exists )?\w+ on public\.(\w+)(?: using \w+)?\s*\(([^;]*)\);/gi)) {
    indexes.push({ table: m[2], unique: Boolean(m[1]), columns: splitTopLevel(m[3]).map((c) => c.trim()) })
  }
  for (const table of tables.values()) {
    for (const key of table.uniqueKeys) indexes.push({ table: table.name, unique: true, columns: key })
  }
  return indexes
}

const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"))
  .join("\n")
const SQL = stripComments(MIGRATION_SQL)
const TABLES = parseTables(SQL)
const INDEXES = parseIndexes(SQL, TABLES)

function sqlTable(name: string): SqlTable {
  const table = TABLES.get(name)
  if (!table) throw new Error(`Table public.${name} is missing from supabase/migrations`)
  return table
}

function sqlColumn(table: string, column: string): SqlColumn {
  const found = sqlTable(table).columns.find((c) => c.name === column)
  if (!found) throw new Error(`Column public.${table}.${column} is missing from supabase/migrations`)
  return found
}

/* ---------------------------- types.ts parsing --------------------------- */

const TYPES_SOURCE = readFileSync(TYPES_FILE, "utf8")

function parseAliases(src: string): Map<string, string> {
  const aliases = new Map<string, string>()
  const lines = src.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const m = /^export type (\w+)\s*=\s*(.*)$/.exec(lines[i])
    if (!m) continue
    let rhs = m[2]
    while (i + 1 < lines.length && /^\s+\|/.test(lines[i + 1])) rhs += ` ${lines[++i].trim()}`
    aliases.set(m[1], rhs.trim())
  }
  return aliases
}

function parseInterfaces(src: string): Map<string, Map<string, string>> {
  const interfaces = new Map<string, Map<string, string>>()
  for (const m of src.matchAll(/export interface (\w+)(?: extends (\w+))? \{\n([\s\S]*?)\n\}/g)) {
    const fields = new Map<string, string>(m[2] ? interfaces.get(m[2]) : undefined)
    for (const line of m[3].split("\n")) {
      const field = /^ {2}(\w+)\??: (.+?)\s*(?:\/\/.*)?$/.exec(line)
      if (field) fields.set(field[1], field[2].trim())
    }
    interfaces.set(m[1], fields)
  }
  return interfaces
}

const ALIASES = parseAliases(TYPES_SOURCE)
const INTERFACES = parseInterfaces(TYPES_SOURCE)

/** Literal values of a union such as `"a" | "b" | OtherAlias`, or null when it isn't a pure literal union. */
function unionValues(expr: string, seen: ReadonlySet<string> = new Set()): (string | number)[] | null {
  const values: (string | number)[] = []
  for (const member of expr.split("|").map((s) => s.trim()).filter(Boolean)) {
    const literal = /^"([^"]*)"$/.exec(member)
    if (literal) values.push(literal[1])
    else if (/^\d+$/.test(member)) values.push(Number(member))
    else if (/^[A-Z]\w*$/.test(member) && ALIASES.has(member) && !seen.has(member)) {
      const inner = unionValues(ALIASES.get(member)!, new Set([...seen, member]))
      if (!inner) return null
      values.push(...inner)
    } else return null
  }
  return values.length ? values : null
}

interface Expectation {
  types: string[]
  nullable: boolean
  values?: (string | number)[]
}

const NUMERIC_TYPES = ["integer", "smallint", "bigint", "numeric"]

function expectationFor(tsType: string): Expectation {
  let type = tsType.trim()
  const nullable = /\|\s*null$/.test(type) || type === "unknown"
  type = type.replace(/\s*\|\s*null$/, "").trim()
  if (type === "unknown") return { types: ["jsonb"], nullable }
  const isArray = type.endsWith("[]")
  const base = isArray ? type.slice(0, -2) : type
  if (base === "string") return { types: [isArray ? "text[]" : "text"], nullable }
  if (base === "ID") return { types: [isArray ? "uuid[]" : "uuid"], nullable }
  if (!isArray && base === "number") return { types: NUMERIC_TYPES, nullable }
  if (!isArray && base === "boolean") return { types: ["boolean"], nullable }
  if (!isArray && base === "ISODate") return { types: ["date"], nullable }
  if (!isArray && base === "ISODateTime") return { types: ["timestamptz"], nullable }
  const values = unionValues(base)
  if (values) {
    const numeric = values.every((v) => typeof v === "number")
    return { types: numeric ? NUMERIC_TYPES : [isArray ? "text[]" : "text"], nullable, values }
  }
  return { types: ["jsonb"], nullable }
}

function tsFields(table: TableName): Map<string, string> {
  const rowType = INTERFACES.get("Database")?.get(table)?.replace(/\[\]$/, "")
  const fields = rowType ? INTERFACES.get(rowType) : undefined
  if (!fields) throw new Error(`No row interface found in types.ts for ${table}`)
  return fields
}

/** Allowed values from a CHECK: quoted strings (`in (...)`, `<@ array[...]`) or a numeric `in (...)` list. */
function checkValues(check: string | null): (string | number)[] | null {
  if (!check) return null
  const strings = [...check.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))
  if (strings.length) return strings
  const list = /\bin\s*\(([^)]*)\)/i.exec(check)
  return list ? list[1].split(",").map((s) => Number(s.trim())) : null
}

/** JS value of a literal SQL default, or undefined for expressions (now(), current_date, auth.uid()…). */
function literalDefault(column: SqlColumn): unknown {
  const expr = column.defaultExpr
  if (expr === null) return undefined
  const quoted = /^'((?:[^']|'')*)'(?:::(\w+)(?:\[\])?)?$/.exec(expr)
  if (quoted) {
    const raw = quoted[1].replace(/''/g, "'")
    if (column.type === "jsonb") return JSON.parse(raw)
    if (column.type.endsWith("[]")) {
      const inner = raw.replace(/^\{|\}$/g, "")
      return inner ? inner.split(",").map((s) => s.trim().replace(/^"|"$/g, "")) : []
    }
    return raw
  }
  if (expr === "true" || expr === "false") return expr === "true"
  if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr)
  return undefined
}

const sorted = <T,>(values: Iterable<T>) => [...values].sort()

/* --------------------------------- Tests --------------------------------- */

describe("schema parity: supabase/migrations vs src/lib", () => {
  it("creates exactly one table per TABLE_NAMES entry, plus public.users", () => {
    expect(sorted(TABLES.keys())).toEqual(sorted([...TABLE_NAMES, "users"]))
  })

  it("creates tables in TABLE_NAMES order (the adapter's insert order)", () => {
    const created = [...TABLES.keys()].filter((t) => t !== "users")
    expect(created).toEqual(TABLE_NAMES)
  })

  it.each(TABLE_NAMES)("%s: columns match TABLE_DEFAULTS plus meta columns", (table) => {
    const expected = [...Object.keys(TABLE_DEFAULTS[table]), ...META_COLUMNS]
    expect(sorted(sqlTable(table).columns.map((c) => c.name))).toEqual(sorted(expected))
  })

  it.each(TABLE_NAMES)("%s: SQL types, nullability and enum CHECK values match types.ts", (table) => {
    const problems: string[] = []
    for (const [field, tsType] of tsFields(table)) {
      const column = sqlColumn(table, field)
      const want = expectationFor(tsType)
      if (!want.types.includes(column.type)) problems.push(`${field}: ${column.type}, expected ${want.types.join("|")} (${tsType})`)
      if (column.notNull === want.nullable) {
        problems.push(`${field}: ${column.notNull ? "NOT NULL" : "nullable"} but types.ts says ${tsType}`)
      }
      if (want.values) {
        const allowed = checkValues(column.check)
        if (!allowed) problems.push(`${field}: missing CHECK for ${tsType}`)
        else if (JSON.stringify(sorted(allowed.map(String))) !== JSON.stringify(sorted(want.values.map(String)))) {
          problems.push(`${field}: CHECK allows [${sorted(allowed.map(String))}], types.ts has [${sorted(want.values.map(String))}]`)
        }
        // `text[] in (...)` fails when the migration runs; arrays need containment.
        const isArray = column.type.endsWith("[]")
        const shape = isArray ? /^"?\w+"?\s*<@\s*array\[/i : /^"?\w+"?\s+in\s*\(/i
        if (column.check && !shape.test(column.check.trim())) {
          problems.push(`${field}: CHECK on ${column.type} must use ${isArray ? "<@ array[...]" : "in (...)"}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it("stores fractional quantities in numeric columns", () => {
    const notNumeric = FRACTIONAL_FIELDS.filter((key) => {
      const [table, column] = key.split(".")
      return sqlColumn(table, column).type !== "numeric"
    })
    expect(notNumeric).toEqual([])
  })

  it.each(TABLE_NAMES)("%s: literal SQL defaults match TABLE_DEFAULTS", (table) => {
    const defaults = TABLE_DEFAULTS[table] as Record<string, unknown>
    const problems: string[] = []
    for (const column of sqlTable(table).columns) {
      if (META_COLUMNS.includes(column.name)) continue
      const value = literalDefault(column)
      if (value === undefined) continue
      if (JSON.stringify(value) !== JSON.stringify(defaults[column.name])) {
        problems.push(`${column.name}: SQL default ${JSON.stringify(value)} vs TABLE_DEFAULTS ${JSON.stringify(defaults[column.name])}`)
      }
    }
    expect(problems).toEqual([])
  })

  it("scopes every workspace row to an auth user (user_id → auth.users, cascade)", () => {
    for (const table of TABLE_NAMES) {
      const userId = sqlColumn(table, "user_id")
      expect(userId, table).toMatchObject({ type: "uuid", notNull: true, defaultExpr: "auth.uid()" })
      expect(userId.references, table).toEqual({ schema: "auth", table: "users", onDelete: "cascade" })
      expect(sqlColumn(table, "id").defaultExpr, table).toBe("gen_random_uuid()")
    }
  })

  it("has a foreign key with the same ON DELETE rule for every relations.ts reference", () => {
    const problems: string[] = []
    for (const [parent, refs] of Object.entries(REFERENCES)) {
      for (const ref of refs ?? []) {
        const key = `${ref.table}.${ref.column}`
        const column = sqlColumn(ref.table, ref.column)
        if (ref.onDelete === "array_remove") {
          if (column.type !== "uuid[]" || column.references) problems.push(`${key}: array reference must be uuid[] without FK`)
        } else if (SOFT_REFERENCES.has(key)) {
          if (column.references) problems.push(`${key}: documented soft reference must not have a FK`)
        } else if (
          column.references?.schema !== "public" ||
          column.references.table !== parent ||
          column.references.onDelete !== RULE_SQL[ref.onDelete]
        ) {
          problems.push(`${key}: expected references public.${parent} on delete ${RULE_SQL[ref.onDelete]}, got ${JSON.stringify(column.references)}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it("mirrors every foreign key in relations.ts (so local mode cascades identically)", () => {
    const problems: string[] = []
    for (const table of TABLE_NAMES) {
      for (const column of sqlTable(table).columns) {
        if (!column.references || column.references.schema !== "public") continue
        const parent = column.references.table as TableName
        const ref = REFERENCES[parent]?.find((r) => r.table === table && r.column === column.name)
        if (!ref) problems.push(`${table}.${column.name} → ${parent} is not listed in REFERENCES.${parent}`)
        else if (RULE_SQL[ref.onDelete] !== column.references.onDelete) {
          problems.push(`${table}.${column.name}: SQL on delete ${column.references.onDelete}, relations.ts ${ref.onDelete}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it("documents references that cannot carry a FK", () => {
    const arrayRefs = Object.values(REFERENCES)
      .flat()
      .filter((ref) => ref?.onDelete === "array_remove")
      .map((ref) => `${ref!.table}.${ref!.column}`)
    for (const key of [...arrayRefs, ...SOFT_REFERENCES, ...POLYMORPHIC_REFERENCES]) {
      const [table, column] = key.split(".")
      expect(sqlColumn(table, column).references, key).toBeNull()
      expect(MIGRATION_SQL, key).toMatch(new RegExp(`comment on column public\\.${table}\\.${column} is '`))
    }
    // The soft reference still behaves like ON DELETE SET NULL, via trigger.
    expect(SQL).toMatch(
      /create trigger clear_converted_item_refs\s+after delete on public\.content_items\s+for each row execute function public\.clear_converted_item_refs\(\);/
    )
    expect(SQL).toMatch(/set converted_item_id = null/)
  })

  it("lists parents before children in TABLE_NAMES (import order satisfies every FK)", () => {
    const problems: string[] = []
    for (const table of TABLE_NAMES) {
      for (const column of sqlTable(table).columns) {
        if (column.references?.schema !== "public") continue
        const parent = column.references.table as TableName
        if (TABLE_NAMES.indexOf(parent) > TABLE_NAMES.indexOf(table)) {
          problems.push(`${table}.${column.name} references ${parent}, which is inserted later`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it("indexes user_id and every foreign key column", () => {
    const problems: string[] = []
    for (const table of TABLE_NAMES) {
      const leading = new Set(INDEXES.filter((ix) => ix.table === table).map((ix) => ix.columns[0]))
      const needed = ["user_id", ...sqlTable(table).columns.filter((c) => c.references?.schema === "public").map((c) => c.name)]
      for (const column of needed) if (!leading.has(column)) problems.push(`${table}.${column} has no index`)
    }
    expect(problems).toEqual([])
  })

  it("has the lookup and uniqueness indexes the app relies on", () => {
    const has = (table: string, columns: string[], unique = false) =>
      INDEXES.some((ix) => ix.table === table && ix.unique === unique && JSON.stringify(ix.columns) === JSON.stringify(columns))
    expect(has("content_metrics", ["content_item_id", "recorded_at"])).toBe(true)
    expect(has("content_items", ["user_id", "stage"])).toBe(true)
    expect(has("content_items", ["user_id", "scheduled_at"])).toBe(true)
    expect(has("brand_profiles", ["user_id"], true)).toBe(true)
    expect(has("app_settings", ["user_id"], true)).toBe(true)
    expect(has("content_tags", ["tag_id", "entity_type", "entity_id"], true)).toBe(true)
    expect(has("tags", ["user_id", "lower(name)"], true)).toBe(true)
  })

  it("enables row-level security with own-row policies on every table", () => {
    const policies = [
      ...SQL.matchAll(/create policy "[^"]+" on public\.(\w+)\s+for (select|insert|update|delete) to (\w+)\s+([\s\S]*?);/gi),
    ].map((m) => ({ table: m[1], command: m[2], role: m[3], body: m[4] }))
    const expectPolicies = (table: string, owner: string, commands: string[]) => {
      expect(SQL, table).toContain(`alter table public.${table} enable row level security;`)
      const own = `(select auth.uid()) = ${owner}`
      const found = policies.filter((p) => p.table === table)
      expect(sorted(found.map((p) => p.command)), table).toEqual(sorted(commands))
      for (const p of found) {
        expect(p.role, `${table} ${p.command}`).toBe("authenticated")
        if (p.command !== "insert") expect(p.body, `${table} ${p.command} using`).toContain(`using (${own})`)
        if (p.command === "insert" || p.command === "update") {
          expect(p.body, `${table} ${p.command} check`).toContain(`with check (${own})`)
        }
      }
    }
    for (const table of TABLE_NAMES) {
      expectPolicies(table, "user_id", ["select", "insert", "update", "delete"])
      expect(SQL, table).toContain(`grant select, insert, update, delete on table public.${table} to authenticated;`)
    }
    expectPolicies("users", "id", ["select", "insert", "update"])
  })

  it("stamps updated_at and documents every table", () => {
    for (const table of [...TABLE_NAMES, "users"]) {
      expect(SQL, table).toMatch(
        new RegExp(`create trigger set_updated_at before update on public\\.${table}\\s+for each row execute function public\\.set_updated_at\\(\\);`)
      )
      expect(MIGRATION_SQL, table).toContain(`comment on table public.${table} is '`)
    }
  })

  it("creates a public.users profile for every new auth user", () => {
    expect(SQL).toMatch(/create trigger on_auth_user_created\s+after insert on auth\.users/)
    expect(SQL).toMatch(/create or replace function public\.handle_new_user\(\)[\s\S]*?security definer\s+set search_path = ''/)
  })
})

/* --------------------------- Demo workspace fit -------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INT32_MAX = 2147483647

function typeProblem(column: SqlColumn, value: unknown): string | null {
  const isUuid = (v: unknown) => typeof v === "string" && UUID_RE.test(v)
  switch (column.type) {
    case "uuid":
      return isUuid(value) ? null : "is not a uuid"
    case "uuid[]":
      return Array.isArray(value) && value.every(isUuid) ? null : "is not a uuid[]"
    case "text":
      return typeof value === "string" ? null : "is not a string"
    case "text[]":
      return Array.isArray(value) && value.every((v) => typeof v === "string") ? null : "is not a string[]"
    case "integer":
    case "smallint":
      return Number.isInteger(value) && Math.abs(value as number) <= INT32_MAX ? null : "is not a 32-bit integer"
    case "bigint":
      return Number.isSafeInteger(value) ? null : "is not an integer"
    case "numeric":
      return typeof value === "number" && Number.isFinite(value) ? null : "is not a finite number"
    case "boolean":
      return typeof value === "boolean" ? null : "is not a boolean"
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : "is not a YYYY-MM-DD date"
    case "timestamptz":
      return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? null : "is not an ISO timestamp"
    default:
      return null
  }
}

function checkProblem(column: SqlColumn, value: unknown): string | null {
  if (!column.check) return null
  const range = /\bbetween\s+(-?\d+)\s+and\s+(-?\d+)/i.exec(column.check)
  if (range) {
    const n = value as number
    return n >= Number(range[1]) && n <= Number(range[2]) ? null : `is outside ${range[1]}..${range[2]}`
  }
  const allowed = checkValues(column.check)
  if (!allowed) return null
  const items = Array.isArray(value) ? value : [value]
  const bad = items.filter((v) => !allowed.map(String).includes(String(v)))
  return bad.length ? `has values outside the CHECK list: ${bad.join(", ")}` : null
}

describe("demo workspace fits the schema (Settings → Data import into Supabase)", () => {
  it("satisfies column types, NOT NULL, CHECKs, primary/unique keys and foreign keys", () => {
    const userId = "00000000-0000-4000-8000-000000000001"
    const db = createDemoDatabase(userId, new Date("2026-09-10T09:00:00.000Z"))
    const rowsOf = (table: TableName) => db[table] as unknown as Record<string, unknown>[]
    const ids = new Map(TABLE_NAMES.map((t) => [t, new Set(rowsOf(t).map((r) => r.id))]))
    const problems: string[] = []

    for (const table of TABLE_NAMES) {
      const rows = rowsOf(table)
      if (ids.get(table)!.size !== rows.length) problems.push(`${table}: duplicate ids`)
      for (const row of rows) {
        for (const column of sqlTable(table).columns) {
          const value = row[column.name]
          const where = `${table}.${column.name} (${String(row.id)})`
          if (value === undefined) {
            if (column.notNull && column.defaultExpr === null) problems.push(`${where}: missing required value`)
            continue
          }
          if (value === null) {
            if (column.notNull) problems.push(`${where}: null in a NOT NULL column`)
            continue
          }
          const problem = typeProblem(column, value) ?? checkProblem(column, value)
          if (problem) problems.push(`${where} ${problem}`)
          const ref = column.references
          if (ref?.schema === "public" && !ids.get(ref.table as TableName)?.has(value)) {
            problems.push(`${where} references a missing ${ref.table} row`)
          }
        }
      }
    }

    // Unique keys beyond primary keys.
    for (const table of ["brand_profiles", "app_settings"] as const) {
      if (db[table].length > 1) problems.push(`${table}: more than one row for the user`)
    }
    const tagNames = db.tags.map((t) => t.name.toLowerCase())
    if (new Set(tagNames).size !== tagNames.length) problems.push("tags: duplicate names (case-insensitive)")
    const links = db.content_tags.map((l) => `${l.tag_id}:${l.entity_type}:${l.entity_id}`)
    if (new Set(links).size !== links.length) problems.push("content_tags: duplicate tag links")

    expect(problems).toEqual([])
  })
})
