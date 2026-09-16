/**
 * "Add to my calendar" — an iCalendar file (RFC 5545) with the enabled reminders as recurring events
 * with alarms. Works in every calendar app and on every phone, with no server; the default reminder
 * path in local mode. Pure: the settings view downloads the string.
 *
 * - daily digest    FREQ=DAILY at the digest time, alarm at the start
 * - posting slots   FREQ=WEEKLY;BYDAY=<day> at the slot time, alarm `lead` minutes before
 * - weekly review   FREQ=WEEKLY;BYDAY=<day> at the review time, alarm at the start
 *
 * Times use the workspace time zone (TZID + a generated VTIMEZONE), so events stay on the creator's
 * wall clock across daylight-saving changes. UIDs are stable per workspace and slot: importing an
 * updated file into the same calendar updates the events instead of duplicating them where the app
 * supports it.
 */
import { translator, type UiLang } from "@/lib/i18n/core"
import { reminderMessages } from "./messages"
import { clampLead, platformList, timedSlots, type ReminderSettings, type ReminderSlot } from "./schedule"
import { addLocalDays, localDateKey, parseTime, safeTimeZone, zonedParts, zoneOffsetMs, type LocalDay } from "./zoned"

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const
const CRLF = "\r\n"
const DAY_MS = 24 * 3600_000

export interface ReminderIcsInput {
  settings: ReminderSettings & { id: string }
  slots: readonly ReminderSlot[]
  lang: UiLang
  now: Date
  /** The app's origin (e.g. `https://orbi.example.com`), for links in the events. Optional. */
  appUrl?: string
}

/** RFC 5545 §3.3.11 TEXT escaping. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** RFC 5545 §3.1: lines longer than 75 octets are folded (CRLF + space), never inside a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ""
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    const limit = parts.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current)
      current = ""
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join(`${CRLF} `)
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, "0")

function utcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function localStamp(day: LocalDay, hour: number, minute: number, second = 0): string {
  return `${pad(day.year, 4)}${pad(day.month)}${pad(day.day)}T${pad(hour)}${pad(minute)}${pad(second)}`
}

function offsetText(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  const sign = minutes < 0 ? "-" : "+"
  return `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}${pad(Math.abs(minutes) % 60)}`
}

interface Transition {
  at: number
  from: number
  to: number
}

/** Offset changes of `tz` between two instants (found per day, then narrowed to the minute). */
export function zoneTransitions(tz: string, start: number, end: number): Transition[] {
  const out: Transition[] = []
  let prevT = start
  let prevOffset = zoneOffsetMs(start, tz)
  for (let t = start + DAY_MS; t <= end; t += DAY_MS) {
    const offset = zoneOffsetMs(t, tz)
    if (offset !== prevOffset) {
      let lo = prevT
      let hi = t
      while (hi - lo > 60_000) {
        const mid = Math.floor((lo + hi) / 2 / 60_000) * 60_000
        if (mid <= lo || mid >= hi) break
        if (zoneOffsetMs(mid, tz) === prevOffset) lo = mid
        else hi = mid
      }
      out.push({ at: hi, from: prevOffset, to: offset })
      prevOffset = offset
    }
    prevT = t
  }
  return out
}

/** A VTIMEZONE for `tz` covering `fromYear`…`toYear` (explicit onsets, one per offset change). */
export function vtimezone(tz: string, fromYear: number, toYear: number): string[] {
  const start = Date.UTC(fromYear, 0, 1)
  const transitions = zoneTransitions(tz, start, Date.UTC(toYear + 1, 0, 1))
  const lines = ["BEGIN:VTIMEZONE", `TZID:${tz}`]
  const observance = (type: "STANDARD" | "DAYLIGHT", dtstart: string, from: number, to: number) =>
    lines.push(`BEGIN:${type}`, `DTSTART:${dtstart}`, `TZOFFSETFROM:${offsetText(from)}`, `TZOFFSETTO:${offsetText(to)}`, `END:${type}`)

  if (!transitions.length) {
    const offset = zoneOffsetMs(start, tz)
    observance("STANDARD", "19700101T000000", offset, offset)
  } else {
    const firstOffset = transitions[0].from
    observance(transitions[0].to > firstOffset ? "STANDARD" : "DAYLIGHT", "19700101T000000", firstOffset, firstOffset)
    for (const { at, from, to } of transitions) {
      // DTSTART of an onset is the local time just before the change, in the old offset.
      const wall = new Date(at + from)
      const day = { year: wall.getUTCFullYear(), month: wall.getUTCMonth() + 1, day: wall.getUTCDate() }
      observance(to > from ? "DAYLIGHT" : "STANDARD", localStamp(day, wall.getUTCHours(), wall.getUTCMinutes()), from, to)
    }
  }
  lines.push("END:VTIMEZONE")
  return lines
}

/** The first local day on or after `today` that falls on `weekday`. */
function nextWeekday(today: LocalDay & { weekday: number }, weekday: number): LocalDay {
  return addLocalDays(today, (weekday - today.weekday + 7) % 7)
}

function durationBefore(minutes: number): string {
  return minutes > 0 ? `-PT${minutes}M` : "PT0M"
}

/** The calendar file, or null when no reminder is switched on (or none can be scheduled). */
export function buildRemindersIcs({ settings, slots, lang, now, appUrl }: ReminderIcsInput): string | null {
  const t = translator(reminderMessages, lang)
  const tz = safeTimeZone(settings.timezone)
  const today = zonedParts(now, tz)
  const stamp = utcStamp(now)
  const origin = appUrl ? appUrl.replace(/\/+$/, "") : ""
  const uid = (name: string) => `orbi-${name}-${settings.id}@orbi.reminders`
  const events: string[][] = []

  const event = ({
    name,
    day,
    time,
    rrule,
    summary,
    description,
    path,
    alarmMinutesBefore,
  }: {
    name: string
    day: LocalDay
    time: { hour: number; minute: number }
    rrule: string
    summary: string
    description: string
    path: string
    alarmMinutesBefore: number
  }) => {
    const lines = [
      "BEGIN:VEVENT",
      `UID:${uid(name)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${localStamp(day, time.hour, time.minute)}`,
      "DURATION:PT15M",
      `RRULE:${rrule}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(origin ? `${description}\n${origin}${path}` : description)}`,
    ]
    if (origin) lines.push(`URL:${origin}${path}`)
    lines.push(
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(summary)}`,
      `TRIGGER:${durationBefore(alarmMinutesBefore)}`,
      "END:VALARM",
      "END:VEVENT"
    )
    events.push(lines)
  }

  const daily = settings.reminders_daily_enabled ? parseTime(settings.reminders_daily_time) : null
  if (daily) {
    event({
      name: "daily",
      day: today,
      time: daily,
      rrule: "FREQ=DAILY",
      summary: t("ics_daily_summary"),
      description: t("ics_daily_description"),
      path: "/today",
      alarmMinutesBefore: 0,
    })
  }

  if (settings.reminders_slot_enabled) {
    const lead = clampLead(settings.reminders_slot_lead_minutes)
    for (const slot of timedSlots(slots)) {
      const label = slot.label.trim() || t("slot_unnamed")
      event({
        name: `slot-${slot.id}`,
        day: nextWeekday(today, slot.day_of_week),
        time: parseTime(slot.time)!,
        rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[slot.day_of_week] ?? "MO"}`,
        summary: t("ics_slot_summary", { label }),
        description: slot.platforms.length
          ? t("ics_slot_description", { platforms: platformList(slot.platforms) })
          : t("ics_slot_description_no_platforms"),
        path: "/today",
        alarmMinutesBefore: lead,
      })
    }
  }

  const review = settings.reminders_review_enabled ? parseTime(settings.reminders_review_time) : null
  if (review && BYDAY[settings.reminders_review_day]) {
    event({
      name: "review",
      day: nextWeekday(today, settings.reminders_review_day),
      time: review,
      rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[settings.reminders_review_day]}`,
      summary: t("ics_review_summary"),
      description: t("ics_review_description"),
      path: "/reports",
      alarmMinutesBefore: 0,
    })
  }

  if (!events.length) return null
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orbi//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(t("ics_calendar_name"))}`,
    `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz, today.year, today.year + 5),
    ...events.flat(),
    "END:VCALENDAR",
  ]
  return lines.map(foldLine).join(CRLF) + CRLF
}

/** File name for the download, e.g. `orbi-reminders-2026-09-16.ics`. */
export function remindersIcsFileName(now: Date, timeZone: string): string {
  return `orbi-reminders-${localDateKey(zonedParts(now, safeTimeZone(timeZone)))}.ics`
}
