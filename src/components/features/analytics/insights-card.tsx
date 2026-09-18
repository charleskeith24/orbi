"use client"

import { ArrowUpRight, CircleAlert, Lightbulb, MessageSquareText, TrendingUp, Wrench } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState, SectionCard, TONE_TEXT, type IconComponent } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { InsightType, StrategicInsight } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import { analyticsMessages } from "./messages"

const TYPE_META: Record<InsightType, { label: `type_${InsightType}`; icon: IconComponent; className: string }> = {
  double_down: { label: "type_double_down", icon: TrendingUp, className: TONE_TEXT.good },
  fix: { label: "type_fix", icon: Wrench, className: TONE_TEXT.warning },
  warning: { label: "type_warning", icon: CircleAlert, className: TONE_TEXT.serious },
  opportunity: { label: "type_opportunity", icon: Lightbulb, className: "text-muted-foreground" },
}

const VISIBLE = 5

/** Data-backed insights from the whole workspace (strategicInsights), most urgent first. */
export function InsightsCard({ insights, className }: { insights: StrategicInsight[]; className?: string }) {
  const t = useT(analyticsMessages)
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? insights : insights.slice(0, VISIBLE)
  return (
    <SectionCard
      className={className}
      title={t("insights_title")}
      description={t("insights_description")}
      action={
        <Button variant="ghost" size="sm" onClick={() => uiActions.askStrategist(t("strategist_prompt"))}>
          <MessageSquareText aria-hidden />
          {t("ask_strategist")}
        </Button>
      }
      contentClassName="px-0 pb-1"
    >
      {insights.length ? (
        <>
        <ul className="divide-y">
          {visible.map((insight) => {
            const meta = TYPE_META[insight.type]
            const Icon = meta.icon
            return (
              <li key={insight.id} className="flex items-start gap-3 px-4 py-2.5">
                <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} aria-hidden />
                <div className="min-w-0 flex-1">
                  {insight.href ? (
                    <Link href={insight.href} className="group/insight text-sm text-pretty underline-offset-2 outline-none hover:underline focus-visible:underline">
                      {insight.text}
                      <ArrowUpRight className="ml-0.5 inline size-3.5 text-muted-foreground group-hover/insight:text-foreground" aria-hidden />
                    </Link>
                  ) : (
                    <p className="text-sm text-pretty">{insight.text}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(meta.label)}</p>
                </div>
              </li>
            )
          })}
        </ul>
        {insights.length > VISIBLE ? (
          <div className="border-t px-2 pt-1">
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? t("show_less") : t("show_all", { count: insights.length })}
            </Button>
          </div>
        ) : null}
        </>
      ) : (
        <EmptyState
          compact
          icon={Lightbulb}
          title={t("no_insights")}
          description={t("no_insights_description")}
          action={
            <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
              {t("add_analytics")}
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
