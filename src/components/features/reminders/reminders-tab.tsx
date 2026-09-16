"use client"

import { toast } from "sonner"
import { useNow } from "@/components/features/today/use-now"
import { SaveBar } from "@/components/features/settings/save-bar"
import { useSettingsDraft } from "@/components/features/settings/use-settings-draft"
import { translate, useUiLang } from "@/lib/i18n"
import { safeTimeZone } from "@/lib/reminders/zoned"
import { updateSettings, useSettings } from "@/lib/store"
import { CalendarCard } from "./calendar-card"
import { remindersMessages } from "./messages"
import { PushCard } from "./push-card"
import { remindersFromSettings, remindersPatch, validateReminders, withReminderValues } from "./reminder-values"
import { ScheduleCard } from "./schedule-card"
import { UpcomingCard } from "./upcoming-card"

/**
 * Settings → Reminders (`/settings?tab=reminders`; settings-view renders `<RemindersTab />`, no props).
 * Choose the daily digest, posting-slot heads-ups and the weekly review; preview what's coming; deliver
 * them as a calendar file (works everywhere, the local-mode path) or as push notifications (online version).
 */
export function RemindersTab() {
  const lang = useUiLang()
  const settings = useSettings()
  const draft = useSettingsDraft(remindersFromSettings)
  const now = useNow()
  const errors = validateReminders(draft.values)
  const valid = Object.keys(errors).length === 0

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.dirty || !valid) return
    updateSettings(remindersPatch(draft.values, draft.saved))
    draft.discard()
    toast.success(translate(remindersMessages, lang, "saved"))
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
        <ScheduleCard draft={draft} errors={errors} timeZone={safeTimeZone(settings.timezone)} />
        <SaveBar dirty={draft.dirty} valid={valid} onDiscard={draft.discard} />
      </form>
      <UpcomingCard settings={withReminderValues(settings, draft.values)} now={now} unsaved={draft.dirty} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <CalendarCard unsaved={draft.dirty} />
        <PushCard />
      </div>
    </div>
  )
}
