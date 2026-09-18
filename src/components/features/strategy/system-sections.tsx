"use client"

import { CalendarDays, CalendarRange, ChevronRight, MessagesSquare, RotateCcw, Sun, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { PageSection, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { OPERATING_RHYTHM, SYSTEM_PRINCIPLES } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { systemKnowledgeMessages, systemMessages } from "./system-messages"
import type { PrincipleMetric, Tone } from "./system-model"
import type { LoopStep, RhythmKey } from "./system-rhythm"


/** The ten principles (spec §50), each with the live metric that shows the system enforcing it. */
export function PrinciplesList({ metrics }: { metrics: PrincipleMetric[] }) {
  const t = useT(systemMessages)
  const tk = useT(systemKnowledgeMessages)
  const lang = useUiLang()
  // English comes straight from SYSTEM_PRINCIPLES; Taglish by position.
  const principleText = (i: number, key: "title" | "description", english: string) =>
    lang === "en" || i >= 10 ? english : tk(`principle_${(i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}_${key}`)
  return (
    <SectionCard
      title={t("principles_title")}
      description={t("principles_description")}
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
                <p className="text-sm font-medium text-pretty">{principleText(i, "title", principle.title)}</p>
                <p className="text-xs text-pretty text-muted-foreground">{principleText(i, "description", principle.description)}</p>
              </div>
              <div className="flex min-w-0 flex-col gap-1 md:items-end md:text-right">
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 md:justify-end">
                  <span className="text-lg leading-6 font-semibold num">{metric.value}</span>
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                </p>
                <p className="text-xs text-pretty text-muted-foreground">{metric.detail}</p>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <StatusPill tone={metric.tone}>{t(`tone_${metric.tone satisfies Tone}`)}</StatusPill>
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
  const t = useT(systemMessages)
  const tk = useT(systemKnowledgeMessages)
  const lang = useUiLang()
  return (
    <PageSection title={t("rhythm_title")} description={t("rhythm_description")}>
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
                        <span className="block text-xs text-pretty text-muted-foreground">
                          {lang === "en" || i >= 5 ? step.description : tk(`rhythm_${key}_${(i + 1) as 1 | 2 | 3 | 4 | 5}`)}
                        </span>
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

// Sent to the Content Strategist as the question, so it stays English (the AI follows Brand HQ's language).
const STRATEGIST_PROMPT = "Based on my last 30 days of results, what should change in my content strategy next month?"

/** The core loop (spec §1): Strategy → … → New strategy, each step linked to its module. */
export function CoreLoop({ steps }: { steps: LoopStep[] }) {
  const t = useT(systemMessages)
  return (
    <SectionCard
      title={t("loop_title")}
      description={t("loop_description")}
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => uiActions.askStrategist(STRATEGIST_PROMPT)}>
          <MessagesSquare aria-hidden />
          {t("ask_strategist")}
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
                {t("repeat")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
