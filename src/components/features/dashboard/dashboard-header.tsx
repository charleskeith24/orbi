"use client"

import { Lightbulb, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { firstName, greetingFor, weekRangeLabel } from "./dashboard-utils"
import { dashboardMessages } from "./messages"

export function DashboardHeader({
  ownerName,
  now,
  weekStart,
  weekEnd,
}: {
  ownerName: string
  now: Date
  weekStart: Date
  weekEnd: Date
}) {
  const t = useT(dashboardMessages)
  const lang = useUiLang()
  const name = firstName(ownerName)
  const greeting = greetingFor(now, lang)
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Orbi</p>
        <h1 className="text-lg leading-7 font-semibold tracking-tight text-balance">{name ? t("greeting_name", { greeting, name }) : greeting}</h1>
        <p className="text-sm text-muted-foreground">{t("this_week", { range: weekRangeLabel(weekStart, weekEnd) })}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
          <Lightbulb />
          {t("capture_idea")}
        </Button>
        <Button size="sm" onClick={() => uiActions.openDialog({ type: "new-content" })}>
          <Plus />
          {t("new_content")}
        </Button>
      </div>
    </header>
  )
}
