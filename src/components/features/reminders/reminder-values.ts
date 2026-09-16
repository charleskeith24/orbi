/** Form values for Settings → Reminders ↔ the `reminders_*` columns of app_settings. Pure. */
import { parseTime } from "@/lib/reminders/zoned"
import { SLOT_LEAD_LIMITS, type ReminderSettings } from "@/lib/reminders/schedule"
import type { AppSettings } from "@/lib/types"

export type ReminderValues = Pick<
  AppSettings,
  | "reminders_daily_enabled"
  | "reminders_daily_time"
  | "reminders_slot_enabled"
  | "reminders_slot_lead_minutes"
  | "reminders_review_enabled"
  | "reminders_review_day"
  | "reminders_review_time"
>

export type ReminderErrors = Partial<Record<"reminders_daily_time" | "reminders_slot_lead_minutes" | "reminders_review_time", "time" | "lead">>

/** Module-level, stable selector for `useSettingsDraft`. */
export function remindersFromSettings(settings: AppSettings): ReminderValues {
  return {
    reminders_daily_enabled: settings.reminders_daily_enabled,
    reminders_daily_time: settings.reminders_daily_time,
    reminders_slot_enabled: settings.reminders_slot_enabled,
    reminders_slot_lead_minutes: settings.reminders_slot_lead_minutes,
    reminders_review_enabled: settings.reminders_review_enabled,
    reminders_review_day: settings.reminders_review_day,
    reminders_review_time: settings.reminders_review_time,
  }
}

/** A time is only required while its reminder is on; the lead must fit the database CHECK. */
export function validateReminders(values: ReminderValues): ReminderErrors {
  const errors: ReminderErrors = {}
  if (values.reminders_daily_enabled && !parseTime(values.reminders_daily_time)) errors.reminders_daily_time = "time"
  if (values.reminders_review_enabled && !parseTime(values.reminders_review_time)) errors.reminders_review_time = "time"
  const lead = values.reminders_slot_lead_minutes
  if (!Number.isInteger(lead) || lead < SLOT_LEAD_LIMITS.min || lead > SLOT_LEAD_LIMITS.max) errors.reminders_slot_lead_minutes = "lead"
  return errors
}

/** The patch to save: a switched-off reminder keeps its last valid time (or the default). */
export function remindersPatch(values: ReminderValues, saved: ReminderValues): ReminderValues {
  return {
    ...values,
    reminders_daily_time: parseTime(values.reminders_daily_time) ? values.reminders_daily_time : saved.reminders_daily_time,
    reminders_review_time: parseTime(values.reminders_review_time) ? values.reminders_review_time : saved.reminders_review_time,
    reminders_review_day: Math.min(6, Math.max(0, Math.round(values.reminders_review_day))),
  }
}

/** Settings as the schedule functions read them, with form values applied. */
export function withReminderValues<T extends ReminderSettings>(settings: T, values: ReminderValues): T {
  return { ...settings, ...values }
}
