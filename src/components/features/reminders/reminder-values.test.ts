import { describe, expect, it } from "vitest"
import { remindersPatch, validateReminders, type ReminderValues } from "./reminder-values"

const VALUES: ReminderValues = {
  reminders_daily_enabled: true,
  reminders_daily_time: "08:00",
  reminders_slot_enabled: true,
  reminders_slot_lead_minutes: 30,
  reminders_review_enabled: true,
  reminders_review_day: 0,
  reminders_review_time: "18:00",
}

describe("validateReminders", () => {
  it("accepts valid values", () => {
    expect(validateReminders(VALUES)).toEqual({})
  })

  it("requires a time only while the reminder is on", () => {
    expect(validateReminders({ ...VALUES, reminders_daily_time: "" })).toEqual({ reminders_daily_time: "time" })
    expect(validateReminders({ ...VALUES, reminders_daily_enabled: false, reminders_daily_time: "" })).toEqual({})
    expect(validateReminders({ ...VALUES, reminders_review_time: "99:99" })).toEqual({ reminders_review_time: "time" })
  })

  it("keeps the lead inside the database CHECK (0–1440 whole minutes)", () => {
    expect(validateReminders({ ...VALUES, reminders_slot_lead_minutes: 0 })).toEqual({})
    expect(validateReminders({ ...VALUES, reminders_slot_lead_minutes: 1440 })).toEqual({})
    expect(validateReminders({ ...VALUES, reminders_slot_lead_minutes: 1441 })).toEqual({ reminders_slot_lead_minutes: "lead" })
    expect(validateReminders({ ...VALUES, reminders_slot_lead_minutes: -5 })).toEqual({ reminders_slot_lead_minutes: "lead" })
    expect(validateReminders({ ...VALUES, reminders_slot_lead_minutes: 2.5 })).toEqual({ reminders_slot_lead_minutes: "lead" })
  })
})

describe("remindersPatch", () => {
  it("keeps the saved time when a switched-off reminder's time was cleared", () => {
    const patch = remindersPatch({ ...VALUES, reminders_daily_enabled: false, reminders_daily_time: "" }, VALUES)
    expect(patch).toMatchObject({ reminders_daily_enabled: false, reminders_daily_time: "08:00" })
  })

  it("passes valid edits through", () => {
    expect(remindersPatch({ ...VALUES, reminders_review_day: 5, reminders_review_time: "20:30" }, VALUES)).toMatchObject({
      reminders_review_day: 5,
      reminders_review_time: "20:30",
    })
  })
})
