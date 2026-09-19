import { describe, expect, it } from "vitest"
import { circleWeek } from "./streak"
import { createCirclesFake, createCirclesFixture, emptyCirclesState, FIXTURE_JOIN_CODE, FIXTURE_SELF_ID } from "./fixture-api"
import { toISODate } from "@/lib/dates"

const NOW = new Date(2026, 8, 17, 10, 0, 0) // Thursday; Monday week starts 14 Sep
const TODAY = toISODate(NOW)

/** Several "users" acting on one shared state. */
function world() {
  const state = emptyCirclesState()
  const as = (self: string) => createCirclesFake({ self, now: () => NOW, state })
  return { state, ana: as("ana"), mika: as("mika"), jun: as("jun"), olly: as("olly") }
}

describe("circles fake — the same rules as the database", () => {
  it("creates, previews and joins, once, up to 8 members", async () => {
    const { ana, mika, olly, state } = world()
    const { circleId, inviteCode } = await ana.createCircle({ name: " Barkada ", displayName: "Ana" })
    expect(await mika.previewInvite(inviteCode)).toEqual({ circle_id: circleId, name: "Barkada", members: 1, is_member: false, is_full: false })
    expect(await mika.joinCircle({ code: inviteCode, displayName: "Mika" })).toEqual({ circleId, joined: true })
    expect(await mika.joinCircle({ code: inviteCode, displayName: "Mika" })).toEqual({ circleId, joined: false })
    await expect(olly.joinCircle({ code: "x".repeat(43), displayName: "Olly" })).rejects.toMatchObject({ code: "invalid_code" })
    for (let i = 0; i < 6; i++) await createCirclesFake({ self: `extra-${i}`, now: () => NOW, state }).joinCircle({ code: inviteCode, displayName: "X" })
    await expect(olly.joinCircle({ code: inviteCode, displayName: "Olly" })).rejects.toMatchObject({ code: "circle_full" })
  })

  it("shows a circle only to its members", async () => {
    const { ana, olly } = world()
    const { circleId } = await ana.createCircle({ name: "Private", displayName: "Ana" })
    expect(await olly.getCircle(circleId)).toBeNull()
    expect((await olly.listCircles()).circles).toEqual([])
    expect((await ana.listCircles()).circles.map((c) => c.name)).toEqual(["Private"])
  })

  it("reveals contacts only after the author accepts, in both directions", async () => {
    const { ana, mika, jun } = world()
    const { circleId, inviteCode } = await ana.createCircle({ name: "C", displayName: "Ana" })
    await mika.joinCircle({ code: inviteCode, displayName: "Mika" })
    await jun.joinCircle({ code: inviteCode, displayName: "Jun" })
    await ana.setMyContact(circleId, "ana@example.com")
    await mika.setMyContact(circleId, "@mika")
    await jun.setMyContact(circleId, "@jun")
    const ask = await ana.postAsk({ circleId, type: "joint_live", text: "Live?" })
    await expect(ana.showInterest(circleId, ask.id)).rejects.toMatchObject({ code: "invalid" })
    await mika.showInterest(circleId, ask.id)
    await jun.showInterest(circleId, ask.id)
    expect(await ana.contactOf(circleId, "mika")).toBeNull()
    expect(await mika.contactOf(circleId, "mika")).toBe("@mika")
    await expect(mika.acceptInterest(ask.id, "mika")).rejects.toMatchObject({ code: "not_author" })
    await ana.acceptInterest(ask.id, "mika")
    expect(await ana.contactOf(circleId, "mika")).toBe("@mika")
    expect(await mika.contactOf(circleId, "ana")).toBe("ana@example.com")
    expect(await jun.contactOf(circleId, "ana")).toBeNull()
    expect(await jun.contactOf(circleId, "mika")).toBeNull()
    // Accepted interests can't be withdrawn; pending ones can.
    await mika.withdrawInterest(ask.id)
    await jun.withdrawInterest(ask.id)
    expect((await ana.getCircle(circleId))?.interests.map((i) => [i.user_id, i.status])).toEqual([["mika", "accepted"]])
  })

  it("closes asks for the author only and refuses interest in closed asks", async () => {
    const { ana, mika } = world()
    const { circleId, inviteCode } = await ana.createCircle({ name: "C", displayName: "Ana" })
    await mika.joinCircle({ code: inviteCode, displayName: "Mika" })
    const ask = await ana.postAsk({ circleId, type: "giveaway", text: "Giveaway" })
    await expect(mika.closeAsk(ask.id)).rejects.toMatchObject({ code: "not_author" })
    await ana.closeAsk(ask.id)
    await expect(mika.showInterest(circleId, ask.id)).rejects.toMatchObject({ code: "invalid" })
  })

  it("keeps one check-in per week, this or last week only", async () => {
    const { ana } = world()
    const { circleId } = await ana.createCircle({ name: "C", displayName: "Ana" })
    await ana.checkIn({ circleId, weekStart: "2026-09-14", posts: 2, note: "" })
    await ana.checkIn({ circleId, weekStart: "2026-09-14", posts: 3, note: "More" })
    await ana.checkIn({ circleId, weekStart: "2026-09-07", posts: 1, note: "" })
    await expect(ana.checkIn({ circleId, weekStart: "2026-08-31", posts: 1, note: "" })).rejects.toMatchObject({ code: "invalid" })
    await expect(ana.checkIn({ circleId, weekStart: "2026-09-16", posts: 1, note: "" })).rejects.toMatchObject({ code: "invalid" })
    await expect(ana.checkIn({ circleId, weekStart: "2026-09-14", posts: 51, note: "" })).rejects.toMatchObject({ code: "invalid" })
    const snapshot = await ana.getCircle(circleId)
    expect(snapshot?.checkins.map((c) => [c.week_start, c.posts, c.note])).toEqual([
      ["2026-09-14", 3, "More"],
      ["2026-09-07", 1, ""],
    ])
  })

  it("hands over ownership when the owner leaves, removes what they wrote, and deletes an empty circle", async () => {
    const { ana, mika, jun } = world()
    const { circleId, inviteCode } = await ana.createCircle({ name: "C", displayName: "Ana" })
    await mika.joinCircle({ code: inviteCode, displayName: "Mika" })
    await jun.joinCircle({ code: inviteCode, displayName: "Jun" })
    await ana.postAsk({ circleId, type: "other", text: "Mine" })
    await expect(mika.removeMember(circleId, "jun")).rejects.toMatchObject({ code: "not_owner" })
    await expect(ana.removeMember(circleId, "ana")).rejects.toMatchObject({ code: "last_owner" })
    expect(await ana.leaveCircle(circleId)).toBe("left")
    const after = await mika.getCircle(circleId)
    expect(after?.members.map((m) => [m.user_id, m.role])).toEqual([
      ["mika", "owner"],
      ["jun", "member"],
    ])
    expect(after?.asks).toEqual([])
    await mika.removeMember(circleId, "jun")
    expect(await mika.leaveCircle(circleId)).toBe("deleted")
    expect(await mika.getCircle(circleId)).toBeNull()
  })

  it("rotates the invite for the owner only; the old code stops working", async () => {
    const { ana, mika, olly } = world()
    const { circleId, inviteCode } = await ana.createCircle({ name: "C", displayName: "Ana" })
    await mika.joinCircle({ code: inviteCode, displayName: "Mika" })
    await expect(mika.rotateInvite(circleId)).rejects.toMatchObject({ code: "not_owner" })
    const next = await ana.rotateInvite(circleId)
    expect(next).not.toBe(inviteCode)
    expect(await olly.previewInvite(inviteCode)).toBeNull()
    expect((await olly.joinCircle({ code: next, displayName: "Olly" })).joined).toBe(true)
  })
})

describe("circles dev fixture — sample data", () => {
  const fixture = () => createCirclesFixture({ now: () => NOW, latencyMs: 0 })

  it("labels every circle, person and ask as a sample", async () => {
    const api = fixture()
    const overview = await api.listCircles()
    expect(overview.circles.length).toBeGreaterThanOrEqual(2)
    for (const circle of overview.circles) expect(circle.name).toMatch(/\(sample\)$/)
    for (const member of overview.members) expect(member.display_name).toMatch(/\(sample\)$/)
    for (const circle of overview.circles) {
      const snapshot = await api.getCircle(circle.id)
      for (const ask of snapshot?.asks ?? []) expect(ask.text).toMatch(/\(sample\)$/)
    }
  })

  it("shows a busy circle (4 of 6 checked in, you not yet) and a circle with only you", async () => {
    const api = fixture()
    const overview = await api.listCircles()
    const [busy, alone] = [overview.circles.find((c) => c.id === "sample-circle-money")!, overview.circles.find((c) => c.id === "sample-circle-beta")!]
    const week = circleWeek(overview, busy.id, FIXTURE_SELF_ID, TODAY)
    expect(week).toMatchObject({ checkedIn: 4, total: 6, selfRole: "owner" })
    expect(week.self).toMatchObject({ checkin: null, streak: 3 })
    expect(circleWeek(overview, alone.id, FIXTURE_SELF_ID, TODAY).total).toBe(1)
  })

  it("has asks in every state, and contacts only where an interest was accepted", async () => {
    const api = fixture()
    expect(await api.contactOf("sample-circle-money", "sample-ria")).toBe("@ria.sample on TikTok")
    expect(await api.contactOf("sample-circle-money", "sample-jun")).toBeNull()
    expect(await api.contactOf("sample-circle-money", "sample-mika")).toBeNull()
    const snapshot = await api.getCircle("sample-circle-money")
    expect(new Set(snapshot?.asks.map((a) => a.status))).toEqual(new Set(["open", "closed"]))
    expect(new Set(snapshot?.interests.map((i) => i.status))).toEqual(new Set(["pending", "accepted"]))
  })

  it("offers a circle to join at the sample invite link", async () => {
    const api = fixture()
    expect(await api.previewInvite(FIXTURE_JOIN_CODE)).toMatchObject({ name: "QC food creators (sample)", members: 3, is_member: false })
    expect(await api.joinCircle({ code: FIXTURE_JOIN_CODE, displayName: "Ana (sample)" })).toEqual({ circleId: "sample-circle-food", joined: true })
  })
})
