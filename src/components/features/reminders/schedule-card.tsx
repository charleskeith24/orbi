"use client"

import { CalendarDays, Globe } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { NumberField, OptionSelect, SectionCard, TimeInput } from "@/components/common"
import { SettingRow, SettingRows } from "@/components/features/settings/setting-row"
import { settingsHref } from "@/components/features/settings/tabs"
import type { SettingsDraft } from "@/components/features/settings/use-settings-draft"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"
import { SLOT_LEAD_LIMITS, timedSlots } from "@/lib/reminders/schedule"
import { useTable } from "@/lib/store"
import { remindersMessages } from "./messages"
import type { ReminderErrors, ReminderValues } from "./reminder-values"

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const

/** Settings → Reminders: which reminders are on, and when. */
export function ScheduleCard({ draft, errors, timeZone }: { draft: SettingsDraft<ReminderValues>; errors: ReminderErrors; timeZone: string }) {
  const t = useT(remindersMessages)
  const { values, set } = draft
  const slots = useTable("content_calendar")
  const { timed, untimed } = useMemo(() => {
    const active = slots.filter((slot) => slot.is_active)
    const withTime = timedSlots(active).length
    return { timed: withTime, untimed: active.length - withTime }
  }, [slots])
  const dayOptions = useMemo(() => DAYS.map((day) => ({ value: String(day), label: t(`day_${day}`) })), [t])
  const errorText = (kind: "time" | "lead" | undefined) => (kind === "time" ? t("error_time") : kind === "lead" ? t("error_lead") : undefined)

  return (
    <SectionCard
      title={t("schedule_title")}
      info={t("schedule_info")}
      footer={
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Globe className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{t("timezone_note", { zone: timeZone.replace(/_/g, " ") })}</span>
          <Link href={settingsHref("general")} className="font-medium text-foreground underline-offset-4 hover:underline">
            {t("change_timezone")}
          </Link>
        </span>
      }
    >
      <SettingRows>
        <SettingRow label={t("daily_label")} info={t("daily_info")} labelId="reminders-daily-label" error={errorText(errors.reminders_daily_time)}>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={values.reminders_daily_enabled}
              onCheckedChange={(checked) => set("reminders_daily_enabled", checked)}
              aria-labelledby="reminders-daily-label"
            />
            <TimeInput
              value={values.reminders_daily_time || null}
              onChange={(next) => set("reminders_daily_time", next ?? "")}
              disabled={!values.reminders_daily_enabled}
              aria-label={t("daily_time")}
            />
          </div>
        </SettingRow>

        <SettingRow
          label={t("slot_label")}
          info={t("slot_info")}
          labelId="reminders-slot-label"
          error={errorText(errors.reminders_slot_lead_minutes)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={values.reminders_slot_enabled}
              onCheckedChange={(checked) => set("reminders_slot_enabled", checked)}
              aria-labelledby="reminders-slot-label"
            />
            <NumberField
              integer
              min={SLOT_LEAD_LIMITS.min}
              max={SLOT_LEAD_LIMITS.max}
              value={values.reminders_slot_lead_minutes}
              onChange={(next) => set("reminders_slot_lead_minutes", next ?? Number.NaN)}
              suffix={t("slot_lead_suffix")}
              disabled={!values.reminders_slot_enabled}
              className="w-40"
              aria-label={t("slot_lead")}
              aria-invalid={Boolean(errors.reminders_slot_lead_minutes) || undefined}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {timed + untimed === 0
                ? t("slots_none")
                : [t.plural("slots_timed", timed), untimed ? t.plural("slots_untimed", untimed) : ""].filter(Boolean).join(" ")}
            </span>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href="/calendar/schedule">
                <CalendarDays aria-hidden />
                {t("open_schedule")}
              </Link>
            </Button>
          </div>
        </SettingRow>

        <SettingRow label={t("review_label")} info={t("review_info")} labelId="reminders-review-label" error={errorText(errors.reminders_review_time)}>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={values.reminders_review_enabled}
              onCheckedChange={(checked) => set("reminders_review_enabled", checked)}
              aria-labelledby="reminders-review-label"
            />
            <OptionSelect
              options={dayOptions}
              value={String(values.reminders_review_day)}
              onChange={(next) => set("reminders_review_day", Number(next ?? 0))}
              disabled={!values.reminders_review_enabled}
              className="w-36"
              aria-label={t("review_day")}
            />
            <TimeInput
              value={values.reminders_review_time || null}
              onChange={(next) => set("reminders_review_time", next ?? "")}
              disabled={!values.reminders_review_enabled}
              aria-label={t("review_time")}
            />
          </div>
        </SettingRow>
      </SettingRows>
    </SectionCard>
  )
}
