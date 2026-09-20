"use client"

import { BellRing, CalendarClock, ClipboardCheck, Sunrise } from "lucide-react"
import { useMemo } from "react"
import { EmptyState, SectionCard, type IconComponent } from "@/components/common"
import { useT, useUiLang } from "@/lib/i18n"
import { describeReminder, upcomingReminders, type ReminderKind, type ReminderSettings } from "@/lib/reminders/schedule"
import { localDateKey, safeTimeZone, zonedParts } from "@/lib/reminders/zoned"
import { useTable } from "@/lib/store"
import { remindersMessages } from "./messages"

const KIND_ICON: Record<ReminderKind, IconComponent> = { daily: Sunrise, slot: CalendarClock, review: ClipboardCheck }

/** The next reminders from the current form values, with the text each would show right now. */
export function UpcomingCard({ settings, now, unsaved }: { settings: ReminderSettings; now: Date; unsaved: boolean }) {
  const t = useT(remindersMessages)
  const lang = useUiLang()
  const slots = useTable("content_calendar")
  const items = useTable("content_items")
  const tz = safeTimeZone(settings.timezone)

  const rows = useMemo(() => {
    const today = localDateKey(zonedParts(now, tz))
    const tomorrow = localDateKey(zonedParts(new Date(now.getTime() + 24 * 3600_000), tz))
    const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
    const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
    return upcomingReminders(settings, slots, now, 5).map((reminder) => {
      const day = localDateKey(zonedParts(reminder.fireAt, tz))
      const dayLabel = day === today ? t("today") : day === tomorrow ? t("tomorrow") : dayFormat.format(reminder.fireAt)
      return {
        reminder,
        when: `${dayLabel} · ${timeFormat.format(reminder.fireAt)}`,
        message: describeReminder(reminder, { settings, slots, items, lang }),
      }
    })
  }, [settings, slots, items, now, tz, lang, t])

  return (
    <SectionCard
      title={t("upcoming_title")}
      description={unsaved ? t("upcoming_unsaved") : undefined}
      info={t("upcoming_info")}
      contentClassName={rows.length ? "px-0 pb-0" : undefined}
    >
      {rows.length ? (
        <ol className="divide-y border-t">
          {rows.map(({ reminder, when, message }) => {
            const Icon = KIND_ICON[reminder.kind]
            return (
              <li key={reminder.key} className="flex min-w-0 items-start gap-3 px-4 py-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium">{message.title}</p>
                    <p className="text-xs text-muted-foreground num">{when}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-pretty whitespace-pre-line text-muted-foreground">{message.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState compact icon={BellRing} title={t("upcoming_empty")} />
      )}
    </SectionCard>
  )
}
