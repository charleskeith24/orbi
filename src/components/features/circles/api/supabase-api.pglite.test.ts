/**
 * The browser implementation (`supabase-api.ts`) end to end against the real migration in PGlite, through a
 * PostgREST-like stand-in (src/lib/circles/testing/pglite-client.ts): every read goes through row-level
 * security and every write through the policies or the circle functions, as it will in production.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { circleWeek } from "@/lib/circles/streak"
import { createPgliteSupabase } from "@/lib/circles/testing/pglite-client"
import type { CirclesApi } from "@/lib/circles/types"
import { toISODate } from "@/lib/dates"
import { startOfWeek } from "@/lib/dates"
import { createAuthUser, createSupabaseTestDb } from "@/lib/supabase/testing/pglite"
import { createSupabaseCirclesApi } from "./supabase-api"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

const ANA = "a0000000-0000-4000-8000-0000000000a1"
const MIKA = "b0000000-0000-4000-8000-0000000000b1"
const OLLY = "d0000000-0000-4000-8000-0000000000d1"

let db: PGlite
let ana: CirclesApi
let mika: CirclesApi
let olly: CirclesApi

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  await createAuthUser(db, { id: ANA, email: "ana@example.com" })
  await createAuthUser(db, { id: MIKA, email: "mika@example.com" })
  await createAuthUser(db, { id: OLLY, email: "olly@example.com" })
  ana = createSupabaseCirclesApi(createPgliteSupabase(db, ANA), ANA)
  mika = createSupabaseCirclesApi(createPgliteSupabase(db, MIKA), MIKA)
  olly = createSupabaseCirclesApi(createPgliteSupabase(db, OLLY), OLLY)
}, 180_000)

afterAll(async () => {
  await db?.close()
})

describe("createSupabaseCirclesApi against the migration", () => {
  let circleId: string
  let code: string

  it("creates a circle and lists it for its members only", async () => {
    ;({ circleId, inviteCode: code } = await ana.createCircle({ name: "Barkada", displayName: "Ana" }))
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect((await ana.listCircles()).circles.map((c) => c.name)).toEqual(["Barkada"])
    expect(await olly.listCircles()).toEqual({ circles: [], members: [], checkins: [] })
    expect(await olly.getCircle(circleId)).toBeNull()
  })

  it("previews and joins with the code", async () => {
    expect(await mika.previewInvite(code)).toEqual({ circle_id: circleId, name: "Barkada", members: 1, is_member: false, is_full: false })
    expect(await mika.previewInvite("x".repeat(43))).toBeNull()
    await expect(mika.joinCircle({ code: "x".repeat(43), displayName: "Mika" })).rejects.toMatchObject({ code: "invalid_code" })
    expect(await mika.joinCircle({ code, displayName: "Mika" })).toEqual({ circleId, joined: true })
    expect(await mika.joinCircle({ code, displayName: "Mika" })).toEqual({ circleId, joined: false })
  })

  it("checks in (upsert: one per week) and computes the week from the rows", async () => {
    const weekStart = toISODate(startOfWeek(new Date(), 1))
    await mika.checkIn({ circleId, weekStart, posts: 2, note: " First " })
    const row = await mika.checkIn({ circleId, weekStart, posts: 3, note: "Updated" })
    expect(row).toMatchObject({ circle_id: circleId, user_id: MIKA, week_start: weekStart, posts: 3, note: "Updated" })
    const overview = await ana.listCircles()
    expect(overview.checkins).toHaveLength(1)
    const week = circleWeek(overview, circleId, ANA, toISODate(new Date()))
    expect(week).toMatchObject({ checkedIn: 1, total: 2 })
    await expect(mika.checkIn({ circleId, weekStart: "2020-01-06", posts: 1, note: "" })).rejects.toMatchObject({ code: "invalid" })
    await expect(olly.checkIn({ circleId, weekStart, posts: 1, note: "" })).rejects.toMatchObject({ code: "invalid" })
  })

  it("runs the ask → interest → accept → contact flow", async () => {
    await ana.setMyContact(circleId, "ana@example.com")
    await mika.setMyContact(circleId, "@mika")
    const ask = await ana.postAsk({ circleId, type: "joint_live", text: " Joint Live? " })
    expect(ask).toMatchObject({ text: "Joint Live?", status: "open", user_id: ANA })
    await expect(ana.showInterest(circleId, ask.id)).rejects.toMatchObject({ code: "invalid" })
    await mika.showInterest(circleId, ask.id)
    expect(await ana.contactOf(circleId, MIKA)).toBeNull()
    expect(await mika.contactOf(circleId, MIKA)).toBe("@mika")
    await expect(mika.acceptInterest(ask.id, MIKA)).rejects.toMatchObject({ code: "not_author" })
    await ana.acceptInterest(ask.id, MIKA)
    expect(await ana.contactOf(circleId, MIKA)).toBe("@mika")
    expect(await mika.contactOf(circleId, ANA)).toBe("ana@example.com")
    const snapshot = await mika.getCircle(circleId)
    expect(snapshot?.interests).toEqual([expect.objectContaining({ ask_id: ask.id, user_id: MIKA, status: "accepted" })])
    await expect(mika.closeAsk(ask.id)).rejects.toMatchObject({ code: "not_author" })
    await ana.closeAsk(ask.id)
    expect((await ana.getCircle(circleId))?.asks[0].status).toBe("closed")
  })

  it("withdraws a pending interest", async () => {
    const ask = await mika.postAsk({ circleId, type: "giveaway", text: "Giveaway?" })
    await ana.showInterest(circleId, ask.id)
    await ana.withdrawInterest(ask.id)
    expect((await ana.getCircle(circleId))?.interests.filter((i) => i.ask_id === ask.id)).toEqual([])
  })

  it("renames yourself, rotates the invite, removes and leaves", async () => {
    await mika.renameSelf(circleId, " Mika R. ")
    expect((await ana.getCircle(circleId))?.members.find((m) => m.user_id === MIKA)?.display_name).toBe("Mika R.")
    await expect(mika.rotateInvite(circleId)).rejects.toMatchObject({ code: "not_owner" })
    const next = await ana.rotateInvite(circleId)
    expect(await olly.previewInvite(code)).toBeNull()
    await olly.joinCircle({ code: next, displayName: "Olly" })
    await expect(mika.removeMember(circleId, OLLY)).rejects.toMatchObject({ code: "not_owner" })
    await ana.removeMember(circleId, OLLY)
    expect(await olly.getCircle(circleId)).toBeNull()
    expect(await ana.leaveCircle(circleId)).toBe("left")
    expect((await mika.getCircle(circleId))?.members.map((m) => m.role)).toEqual(["owner"])
    expect(await mika.leaveCircle(circleId)).toBe("deleted")
  })
})
