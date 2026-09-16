import { describe, expect, it } from "vitest"
import { TABLE_NAMES } from "@/lib/data/defaults"
import { LOCAL_USER_ID } from "@/lib/data/local-adapter"
import { REFERENCES } from "@/lib/data/relations"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import type { Database } from "@/lib/types"
import {
  alreadyMoved,
  hasWorkToMove,
  isEmptyWorkspace,
  parseLocalSnapshot,
  parseMovedMarker,
  prepareForAccount,
  summarizeWorkspace,
  type LocalSnapshot,
} from "./move-local"
import { rekeyWorkspace } from "./rekey"

const NOW = new Date(2026, 8, 10, 9)
const demo = createDemoDatabase(LOCAL_USER_ID, NOW)
const starter = createStarterDatabase(LOCAL_USER_ID, NOW)
const rowsOf = (db: Database, table: keyof Database) => db[table] as unknown as Record<string, unknown>[]
const total = (db: Database) => TABLE_NAMES.reduce((n, t) => n + db[t].length, 0)

/** Every string anywhere in a value (deep). */
function strings(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") out.add(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out))
  return out
}

describe("parseLocalSnapshot", () => {
  it("reads the local adapter's saved workspace", () => {
    const raw = JSON.stringify({ version: 2, userId: LOCAL_USER_ID, savedAt: "2026-09-10T09:00:00.000Z", db: demo })
    const snapshot = parseLocalSnapshot(raw)!
    expect(snapshot.savedAt).toBe("2026-09-10T09:00:00.000Z")
    expect(snapshot.rows).toBe(total(demo))
    expect(snapshot.onboarded).toBe(true)
    expect(snapshot.brandName).toBe(demo.brand_profiles[0].brand_name || demo.brand_profiles[0].name)
    expect(snapshot.db.content_items).toHaveLength(demo.content_items.length)
  })

  it("returns null for a missing, corrupt or foreign value", () => {
    for (const raw of [null, "", "{", "[]", JSON.stringify({ db: "nope" }), JSON.stringify({ tags: [] })]) {
      expect(parseLocalSnapshot(raw), String(raw)).toBeNull()
    }
  })

  it("skips tables that aren't lists and rows that aren't objects", () => {
    const snapshot = parseLocalSnapshot(JSON.stringify({ savedAt: 5, db: { tags: [starter.tags[0], "junk", null], content_ideas: "nope" } }))!
    expect(snapshot.savedAt).toBeNull()
    expect(snapshot.db.tags).toHaveLength(1)
    expect(snapshot.db.content_ideas).toEqual([])
  })
})

describe("what is worth moving, and what counts as an empty account", () => {
  it("an untouched Starter Kit is empty and not worth moving", () => {
    const summary = summarizeWorkspace(starter)
    expect(summary).toMatchObject({ onboarded: false, ownRows: 0 })
    expect(hasWorkToMove(summary)).toBe(false)
    expect(isEmptyWorkspace(summary)).toBe(true)
  })

  it("finishing onboarding or adding anything of your own makes it worth moving", () => {
    const onboarded = { ...starter, brand_profiles: [{ ...starter.brand_profiles[0], onboarding_completed: true }] }
    expect(hasWorkToMove(summarizeWorkspace(onboarded))).toBe(true)
    expect(isEmptyWorkspace(summarizeWorkspace(onboarded))).toBe(false)
    const withIdea = { ...starter, content_ideas: demo.content_ideas.slice(0, 1) }
    expect(hasWorkToMove(summarizeWorkspace(withIdea))).toBe(true)
    expect(isEmptyWorkspace(summarizeWorkspace(withIdea))).toBe(false)
  })

  it("an account with nothing at all is empty", () => {
    const blank = Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as unknown as Database
    expect(isEmptyWorkspace(summarizeWorkspace(blank))).toBe(true)
  })
})

describe("rekeyWorkspace", () => {
  const { db: out, idMap } = rekeyWorkspace(demo)

  it("gives every row a new, unique id and leaves no old id anywhere", () => {
    expect(idMap.size).toBe(total(demo))
    expect(new Set(idMap.values()).size).toBe(idMap.size)
    const remaining = strings(out)
    expect([...idMap.keys()].filter((id) => remaining.has(id))).toEqual([])
  })

  it("keeps every foreign key, array reference and polymorphic id pointing at the same row", () => {
    const mapped = (value: unknown) => (typeof value === "string" ? (idMap.get(value) ?? value) : value)
    const problems: string[] = []
    const columns = [
      ...Object.values(REFERENCES).flatMap((refs) => (refs ?? []).map((r) => [r.table, r.column] as const)),
      ["content_tags", "entity_id"] as const,
      ["content_ideas", "source_ref_id"] as const,
      ["ai_generations", "entity_id"] as const,
    ]
    for (const [table, column] of columns) {
      rowsOf(demo, table).forEach((row, i) => {
        const before = row[column]
        const after = rowsOf(out, table)[i][column]
        const want = Array.isArray(before) ? before.map(mapped) : mapped(before)
        if (JSON.stringify(after) !== JSON.stringify(want)) problems.push(`${table}.${column} row ${i}`)
      })
    }
    expect(problems).toEqual([])
  })

  it("changes nothing but ids", () => {
    const ids = new Set([...idMap.keys(), ...idMap.values()])
    const strip = (db: Database) =>
      TABLE_NAMES.map((t) => rowsOf(db, t).map((row) => JSON.stringify(row, (_key, value) => (typeof value === "string" && ids.has(value) ? "<id>" : value))))
    expect(strip(out)).toEqual(strip(demo))
  })
})

describe("prepareForAccount", () => {
  it("sets the account as owner, completes every row and keeps row counts", () => {
    let n = 0
    const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
    const out = prepareForAccount(demo, "11111111-1111-4111-8111-111111111111", newId)
    for (const t of TABLE_NAMES) {
      expect(out[t], t).toHaveLength(demo[t].length)
      expect(rowsOf(out, t).every((row) => row.user_id === "11111111-1111-4111-8111-111111111111"), t).toBe(true)
    }
    expect(out.brand_profiles[0].id).toMatch(/^00000000-0000-4000-8000-/)
    // The source workspace is untouched.
    expect(demo.brand_profiles[0].user_id).toBe(LOCAL_USER_ID)
  })
})

describe("moved marker", () => {
  const snapshot = { savedAt: "2026-09-10T09:00:00.000Z" } as LocalSnapshot
  it("parses only well-formed markers", () => {
    expect(parseMovedMarker(JSON.stringify({ userId: "u", movedAt: "2026-09-14T00:00:00.000Z", savedAt: null }))).toEqual({
      userId: "u",
      movedAt: "2026-09-14T00:00:00.000Z",
      savedAt: null,
    })
    for (const raw of [null, "{", "[]", JSON.stringify({ userId: 1, movedAt: "x" })]) expect(parseMovedMarker(raw), String(raw)).toBeNull()
  })

  it("matches the exact snapshot that was moved", () => {
    expect(alreadyMoved(null, snapshot)).toBe(false)
    expect(alreadyMoved({ userId: "u", movedAt: "x", savedAt: "2026-09-10T09:00:00.000Z" }, snapshot)).toBe(true)
    expect(alreadyMoved({ userId: "u", movedAt: "x", savedAt: "2026-09-11T09:00:00.000Z" }, snapshot)).toBe(false)
  })
})
