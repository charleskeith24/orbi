"use client"

import { CalendarDays, CalendarRange, ChevronRight, MessagesSquare, RotateCcw, Sun, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { PageSection, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { OPERATING_RHYTHM, SYSTEM_PRINCIPLES } from "@/lib/constants"
import { uiActions } from "@/lib/store"
import type { PrincipleMetric, Tone } from "./system-model"
import type { LoopStep, RhythmKey } from "./system-rhythm"

const TONE_LABEL: Record<Tone, string> = {
  good: "Strong",
  warning: "Needs attention",
  serious: "At risk",
  critical: "Critical",
  neutral: "No data yet",
}

/** The ten principles (spec §50), each with the live metric that shows the system enforcing it. */
export function PrinciplesList({ metrics }: { metrics: PrincipleMetric[] }) {
  return (
    <SectionCard
      title="The 10 principles"
      description="The rules the system is built on — and how well your workspace follows each one right now."
      contentClassName="p-0"
    >
      <ol className="divide-y">
        {SYSTEM_PRINCIPLES.map((principle, i) => {
          const metric = metrics[i]
          if (!metric) return null
          return (
            <li key={principle.title} className="grid gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
              <span className="text-xs leading-5 font-medium text-muted-foreground num">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-pretty">{principle.title}</p>
                <p className="text-xs text-pretty text-muted-foreground">{principle.description}</p>
              </div>
              <div className="flex min-w-0 flex-col gap-1 md:items-end md:text-right">
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 md:justify-end">
                  <span className="text-lg leading-6 font-semibold num">{metric.value}</span>
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                </p>
                <p className="text-xs text-pretty text-muted-foreground">{metric.detail}</p>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <StatusPill tone={metric.tone}>{TONE_LABEL[metric.tone]}</StatusPill>
                  <Link href={metric.href} className="inline-flex items-center gap-0.5 text-xs font-medium underline-offset-2 hover:underline">
                    {metric.hrefLabel}
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

const RHYTHM_ICONS: Record<RhythmKey, LucideIcon> = { daily: Sun, weekly: CalendarDays, monthly: CalendarRange }
const RHYTHM_KEYS: RhythmKey[] = ["daily", "weekly", "monthly"]

/** Operating rhythm (spec §52): daily / weekly / monthly habits, each linked to where it happens, with live evidence. */
export function OperatingRhythm({ evidence }: { evidence: Record<RhythmKey, string[]> }) {
  return (
    <PageSection title="Operating rhythm" description="The habits that keep the flywheel turning — each one links to where it happens.">
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        {RHYTHM_KEYS.map((key) => {
          const rhythm = OPERATING_RHYTHM[key]
          return (
            <SectionCard key={key} title={rhythm.label} icon={RHYTHM_ICONS[key]} contentClassName="px-0 pb-1.5">
              <ol className="flex flex-col">
                {rhythm.steps.map((step, i) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="group/step flex items-start gap-3 px-4 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium num dark:bg-input/50">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{step.label}</span>
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/step:translate-x-0.5" aria-hidden />
                        </span>
                        <span className="block text-xs text-pretty text-muted-foreground">{step.description}</span>
                        {evidence[key][i] ? <span className="mt-0.5 block text-xs font-medium text-foreground/85">{evidence[key][i]}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )
        })}
      </div>
    </PageSection>
  )
}

const STRATEGIST_PROMPT = "Based on my last 30 days of results, what should change in my content strategy next month?"

/** The core loop (spec §1): Strategy → … → New strategy, each step linked to its module. */
export function CoreLoop({ steps }: { steps: LoopStep[] }) {
  return (
    <SectionCard
      title="The core loop"
      description="Every module serves one step. What you learn at the end becomes the next strategy."
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => uiActions.askStrategist(STRATEGIST_PROMPT)}>
          <MessagesSquare aria-hidden />
          Ask the Strategist
        </Button>
      }
    >
      <ol className="flex flex-wrap items-center gap-y-3">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center">
            <Link
              href={step.href}
              className="flex min-w-[7.5rem] flex-col rounded-lg border bg-card px-3 py-2 outline-none transition-colors hover:border-foreground/15 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/20"
            >
              <span className="text-[11px] text-muted-foreground num">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm font-medium">{step.label}</span>
              <span className="text-xs whitespace-nowrap text-muted-foreground">{step.stat}</span>
            </Link>
            {i < steps.length - 1 ? (
              <ChevronRight className="mx-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <RotateCcw className="size-4 text-brand" aria-hidden />
                repeat
              </span>
            )}
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
