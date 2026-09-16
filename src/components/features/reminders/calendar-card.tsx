"use client"

import { CalendarPlus, Info } from "lucide-react"
import { toast } from "sonner"
import { SectionCard, StatusPill } from "@/components/common"
import { downloadFile } from "@/components/features/settings/download"
import { Button } from "@/components/ui/button"
import { useT, useUiLang } from "@/lib/i18n"
import { buildRemindersIcs, remindersIcsFileName } from "@/lib/reminders/ics"
import { anyReminderEnabled } from "@/lib/reminders/schedule"
import { useSettings, useTable } from "@/lib/store"
import { remindersMessages } from "./messages"

/** "Add to my calendar": the saved reminders as an .ics file with recurring events and alarms. */
export function CalendarCard({ unsaved }: { unsaved: boolean }) {
  const t = useT(remindersMessages)
  const lang = useUiLang()
  const settings = useSettings()
  const slots = useTable("content_calendar")
  const enabled = anyReminderEnabled(settings)
  const blocked = unsaved ? t("calendar_needs_save") : !enabled ? t("calendar_needs_reminder") : null

  function download() {
    const now = new Date()
    const ics = buildRemindersIcs({ settings, slots, lang, now, appUrl: window.location.origin })
    if (!ics) {
      toast.error(t("calendar_needs_reminder"))
      return
    }
    downloadFile(remindersIcsFileName(now, settings.timezone), ics, "text/calendar;charset=utf-8")
    const events = ics.split("BEGIN:VEVENT").length - 1
    toast.success(t("calendar_downloaded"), { description: t.plural("calendar_downloaded_body", events) })
  }

  return (
    <SectionCard
      title={t("calendar_title")}
      description={t("calendar_description")}
      action={<StatusPill tone="good">{t("calendar_badge")}</StatusPill>}
      className="h-full"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button type="button" size="sm" onClick={download} disabled={Boolean(blocked)}>
            <CalendarPlus aria-hidden />
            {t("calendar_download")}
          </Button>
          {blocked ? <span className="text-xs text-muted-foreground">{blocked}</span> : null}
        </div>
        <ul className="flex flex-col gap-1.5 text-xs text-pretty text-muted-foreground">
          <li className="flex gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{t("calendar_hint_phone")}</span>
          </li>
          <li className="flex gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{t("calendar_hint_update")}</span>
          </li>
        </ul>
      </div>
    </SectionCard>
  )
}
