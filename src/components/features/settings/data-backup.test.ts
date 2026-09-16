import { describe, expect, it } from "vitest"
import { backupReminder, BACKUP_REMINDER_DAYS, daysSince } from "./data-backup"

const now = new Date("2026-09-14T10:00:00.000Z")
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString()

describe("backupReminder", () => {
  it("stays quiet after a recent backup", () => {
    expect(backupReminder({ lastBackupAt: daysAgo(2), workspaceSince: daysAgo(90), snoozedUntil: null, now })).toEqual({
      due: false,
      days: 2,
      never: false,
    })
  })

  it(`is due once ${BACKUP_REMINDER_DAYS} days pass without a backup`, () => {
    expect(backupReminder({ lastBackupAt: daysAgo(6.9), workspaceSince: null, snoozedUntil: null, now }).due).toBe(false)
    expect(backupReminder({ lastBackupAt: daysAgo(7), workspaceSince: null, snoozedUntil: null, now })).toEqual({ due: true, days: 7, never: false })
  })

  it("counts from the workspace's creation when there has never been a backup", () => {
    expect(backupReminder({ lastBackupAt: null, workspaceSince: daysAgo(3), snoozedUntil: null, now })).toEqual({ due: false, days: 3, never: true })
    expect(backupReminder({ lastBackupAt: null, workspaceSince: daysAgo(30), snoozedUntil: null, now })).toEqual({ due: true, days: 30, never: true })
    expect(backupReminder({ lastBackupAt: null, workspaceSince: null, snoozedUntil: null, now })).toEqual({ due: false, days: null, never: true })
  })

  it("stays hidden while snoozed, and comes back when the snooze runs out", () => {
    expect(backupReminder({ lastBackupAt: daysAgo(10), workspaceSince: null, snoozedUntil: inDays(1), now }).due).toBe(false)
    expect(backupReminder({ lastBackupAt: daysAgo(10), workspaceSince: null, snoozedUntil: daysAgo(1), now }).due).toBe(true)
  })

  it("treats unreadable stored dates as missing", () => {
    expect(backupReminder({ lastBackupAt: "not a date", workspaceSince: daysAgo(8), snoozedUntil: "??", now })).toEqual({ due: true, days: 8, never: true })
  })
})

describe("daysSince", () => {
  it("rounds down to whole days and never goes negative", () => {
    expect(daysSince(daysAgo(0.5), now)).toBe(0)
    expect(daysSince(daysAgo(1.2), now)).toBe(1)
    expect(daysSince(inDays(2), now)).toBe(0)
    expect(daysSince("nope", now)).toBeNull()
  })
})
