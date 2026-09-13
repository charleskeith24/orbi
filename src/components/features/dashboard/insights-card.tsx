"use client"

import { Compass, Lightbulb, Sparkles, TrendingUp, TriangleAlert, Wrench, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState, SectionCard, TONE_SOFT, TONE_TEXT, type StatusTone } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { InsightType, StrategicInsight } from "@/lib/analytics"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"

const TYPE_META: Record<InsightType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  warning: { label: "Warning", icon: TriangleAlert, tone: "warning" },
  fix: { label: "Fix", icon: Wrench, tone: "serious" },
  double_down: { label: "Double down", icon: TrendingUp, tone: "good" },
  opportunity: { label: "Opportunity", icon: Lightbulb, tone: "neutral" },
}

const INITIAL = 3

function InsightRow({ insight }: { insight: StrategicInsight }) {
  const meta = TYPE_META[insight.type]
  const Icon = meta.icon
  const body = (
    <>
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TONE_SOFT[meta.tone])}>
        <Icon className={cn("size-3.5", TONE_TEXT[meta.tone])} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug text-pretty">
        <span className={cn("font-medium", TONE_TEXT[meta.tone])}>{meta.label}</span>
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
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? insights : insights.slice(0, INITIAL)
  return (
    <SectionCard
      title="Strategic Insights"
      description="Computed from your workspace — what to double down on, fix and try next"
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
          title="Nothing needs attention"
          description="Buffer, pace, mix and performance look steady. Insights show up here as soon as the data spots something."
        />
      )}
      {insights.length > INITIAL ? (
        <Button variant="ghost" size="xs" className="self-start text-muted-foreground" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show fewer" : `Show all ${insights.length}`}
        </Button>
      ) : null}
      <div className="mt-auto flex flex-col gap-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Ask the Content Strategist</p>
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
