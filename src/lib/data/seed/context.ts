/**
 * Shared state for one seed run: the clock ("now"), deterministic randomness,
 * a named-id registry (so rows can reference each other before they exist) and
 * a row builder that stamps realistic timestamps.
 */
import { addDays, addMinutes, startOfDay } from "date-fns"
import { buildRow } from "@/lib/data/defaults"
import { toISODate } from "@/lib/dates"
import type { ID, InsertRow, ISODate, ISODateTime, Row, TableName } from "@/lib/types"
import { createRng, hashString, type Rng } from "./rng"

export interface SeedContext {
  userId: string
  now: Date
  /** Local midnight of `now`. */
  today: Date
  /** Content randomness (noise, counts, picks). */
  rng: Rng
  /** Stable id for a named entity, e.g. `id("pillar:education")`. Created on first use. */
  id(key: string): ID
  /** Anonymous id for rows nobody references by name. */
  newId(): ID
  /** Local calendar day `offset` days from today (negative = past). */
  day(offset: number): ISODate
  /** Local date-time on day `offset` at "HH:mm". */
  date(offset: number, time: string): Date
  /** Same as `date` but as an ISO timestamp. */
  at(offset: number, time: string): ISODateTime
  /** `buildRow` with explicit created/updated timestamps and a deterministic id when none is given. */
  build<T extends TableName>(table: T, values: InsertRow<T>, createdAt: Date, updatedAt?: Date): Row<T>
}

function parseTime(time: string): [number, number] {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10))
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0]
}

export function createContext(userId: string, now: Date): SeedContext {
  const today = startOfDay(now)
  const seed = hashString(`${userId}|${toISODate(now)}`)
  const rng = createRng(seed)
  // Ids come from their own stream so tweaking content randomness never reshuffles ids.
  const idRng = createRng(hashString(`ids|${seed}`))
  const named = new Map<string, ID>()

  const date = (offset: number, time: string) => {
    const [h, m] = parseTime(time)
    const d = addDays(today, offset)
    d.setHours(h, m, 0, 0)
    return d
  }

  return {
    userId,
    now,
    today,
    rng,
    id(key) {
      let value = named.get(key)
      if (!value) {
        value = idRng.uuid()
        named.set(key, value)
      }
      return value
    },
    newId: () => idRng.uuid(),
    day: (offset) => toISODate(addDays(today, offset)),
    date,
    at: (offset, time) => date(offset, time).toISOString(),
    build(table, values, createdAt, updatedAt) {
      // buildRow falls back to crypto.randomUUID, which would break determinism.
      const withId = (values as { id?: ID }).id ? values : { ...values, id: idRng.uuid() }
      const row = buildRow(table, withId, userId, createdAt)
      if (updatedAt) (row as { updated_at: string }).updated_at = updatedAt.toISOString()
      return row
    },
  }
}

/** `now` minus `minutes`, but never before local midnight (keeps "created today" true). */
export function earlierToday(ctx: SeedContext, minutes: number): Date {
  const t = addMinutes(ctx.now, -minutes)
  return t < ctx.today ? ctx.today : t
}
