"use client"

import { Compass, Lightbulb, Sparkles, TrendingUp, TriangleAlert, Wrench, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState, SectionCard, TONE_SOFT, TONE_TEXT, type StatusTone } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { InsightType, StrategicInsight } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import { dashboardMessages } from "./messages"

const TYPE_META: Record<InsightType, { label: keyof typeof dashboardMessages.en; icon: LucideIcon; tone: StatusTone }> = {
  warning: { label: "type_warning", icon: TriangleAlert, tone: "warning" },
  fix: { label: "type_fix", icon: Wrench, tone: "serious" },
  double_down: { label: "type_double_down", icon: TrendingUp, tone: "good" },
  opportunity: { label: "type_opportunity", icon: Lightbulb, tone: "neutral" },
}

const INITIAL = 3

function InsightRow({ insight }: { insight: StrategicInsight }) {
  const t = useT(dashboardMessages)
  const meta = TYPE_META[insight.type]
  const Icon = meta.icon
  const body = (
    <>
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TONE_SOFT[meta.tone])}>
        <Icon className={cn("size-3.5", TONE_TEXT[meta.tone])} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug text-pretty">
        <span className={cn("font-medium", TONE_TEXT[meta.tone])}>{t(meta.label)}</span>
        <span className="text-muted-foreground" aria-hidden>
          {" · "}
        </span>
        <span className="sr-only">: </span>
        {insight.text}
      </span>
    </>
  )
  const base = "flex items-start gap-2.5 rounded-md px-2 py-1.5"
  if (!insight.href) return <div className={base}>{body}</div>
  return (
    <Link href={insight.href} className={cn(base, "outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50")}>
      {body}
    </Link>
  )
}

/** Data-backed insights (double down / fix / opportunity / warning) and prompts for the Content Strategist. */
export function InsightsCard({
  insights,
  prompts,
  className,
}: {
  insights: StrategicInsight[]
  prompts: string[]
  className?: string
}) {
  const t = useT(dashboardMessages)
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? insights : insights.slice(0, INITIAL)
  return (
    <SectionCard
      title={t("insights_title")}
      description={t("insights_description")}
      className={className}
      contentClassName="flex flex-col gap-2"
    >
      {insights.length ? (
        <ul className="-mx-2 flex flex-col">
          {shown.map((insight) => (
            <li key={insight.id}>
              <InsightRow insight={insight} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={Compass}
          title={t("insights_empty_title")}
          description={t("insights_empty_description")}
        />
      )}
      {insights.length > INITIAL ? (
        <Button variant="ghost" size="xs" className="self-start text-muted-foreground" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t("show_fewer") : t("show_all", { count: insights.length })}
        </Button>
      ) : null}
      <div className="mt-auto flex flex-col gap-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">{t("ask_strategist")}</p>
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="xs"
              className="h-auto max-w-full justify-start py-1 text-left whitespace-normal"
              onClick={() => uiActions.askStrategist(prompt)}
            >
              <Sparkles className="text-brand" aria-hidden />
              <span className="min-w-0">{prompt}</span>
            </Button>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
