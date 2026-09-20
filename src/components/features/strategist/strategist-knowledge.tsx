"use client"

import { ChevronDown, ChevronRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { ColorDot, Meter, PlatformIcon, ScoreRing, SectionCard, StatusPill, type StatusTone } from "@/components/common"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { bufferStatusLabel, formatMultiple, type BufferStatus } from "@/lib/analytics"
import { useT, useUiLang, type Translator } from "@/lib/i18n"
import { cn, formatCompact } from "@/lib/utils"
import type { StrategistKnowledge } from "./knowledge"
import { suggestedPrompts, type StrategistPrompt } from "./prompts"
import { strategistSession, useStrategistSession } from "./session"
import { knowledgeMessages, strategistMessages } from "./strategist-messages"

const BUFFER_TONE: Record<BufferStatus, StatusTone> = { healthy: "good", ok: "warning", low: "critical" }

type KnowledgeT = Translator<(typeof knowledgeMessages)["en"]>
type CountKey = "pillars" | "problems" | "questions" | "pieces" | "posts" | "days" | "measured_posts" | "winners"

const plural = (t: KnowledgeT, key: CountKey, n: number) => t.plural(key, n, { count: n.toLocaleString("en-US") })

function KnowledgeRow({
  href,
  label,
  detail,
  aside,
  children,
}: {
  href: string
  label: string
  detail?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-3 px-4 py-2.5 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-0.5 min-w-0 text-sm font-medium">{children}</div>
          {detail ? <p className="mt-0.5 line-clamp-2 text-xs text-pretty text-muted-foreground">{detail}</p> : null}
        </div>
        {aside ? <div className="shrink-0 pt-0.5">{aside}</div> : null}
        <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" aria-hidden />
      </Link>
    </li>
  )
}

function KnowledgeBody({ data }: { data: StrategistKnowledge }) {
  const t = useT(knowledgeMessages)
  const lang = useUiLang()
  const { health, buffer, week, topPillar, bestWinner } = data
  const weakest = [...health.components].sort((a, b) => a.score / Math.max(1, a.max) - b.score / Math.max(1, b.max))[0]
  const postsPerWeek = Math.round(buffer.dailyRate * 7)
  const subtitle = [data.role, data.brandName && !data.role.includes(data.brandName) ? data.brandName : ""].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 px-4 pb-3">
        <p className="min-w-0 truncate text-sm font-medium">{data.owner || data.brandName || t("your_brand")}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        <p className="mt-1 line-clamp-3 text-xs text-pretty">
          {data.positioning || <span className="text-muted-foreground">{t("no_positioning")}</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{plural(t, "pillars", data.pillarCount)}</span>
          {data.platforms.length ? (
            <span className="flex items-center gap-1">
              {data.platforms.map((platform) => (
                <PlatformIcon key={platform} platform={platform} label className="size-3.5" />
              ))}
            </span>
          ) : null}
          <Link href="/strategy" className="ml-auto font-medium text-foreground underline-offset-2 hover:underline">
            Brand HQ
          </Link>
        </div>
      </div>
      <ul className="divide-y border-t">
        <KnowledgeRow
          href={data.persona ? `/audience?open=${data.persona.id}` : "/audience"}
          label={t("audience")}
          detail={`${plural(t, "problems", data.problemCount)} · ${plural(t, "questions", data.questionCount)}`}
        >
          <span className="block truncate">{data.persona?.name || t("no_persona")}</span>
        </KnowledgeRow>
        <KnowledgeRow href="/strategy/goals" label={t("primary_goal")}>
          <span className={cn("block truncate", !data.goal && "font-normal text-muted-foreground")}>{data.goal?.name || t("not_set")}</span>
        </KnowledgeRow>
        {data.hasPublished ? (
          <KnowledgeRow
            href="/"
            label={t("health")}
            detail={weakest ? t("weakest", { label: weakest.label, detail: weakest.detail }) : undefined}
            aside={<ScoreRing value={health.score} size={32} strokeWidth={3} tone="auto" label={t("health")} />}
          >
            <span className="num">{health.score}</span>
            <span className="font-normal text-muted-foreground"> / 100 · {health.band.label}</span>
          </KnowledgeRow>
        ) : (
          <KnowledgeRow href="/" label={t("health")} detail={t("health_not_started")}>
            <span className="font-normal text-muted-foreground">{t("not_scored")}</span>
          </KnowledgeRow>
        )}
        <KnowledgeRow
          href="/pipeline"
          label={t("buffer")}
          detail={
            data.hasContent
              ? t("buffer_detail", { pieces: plural(t, "pieces", buffer.readyCount), posts: plural(t, "posts", postsPerWeek) })
              : t("buffer_empty")
          }
          aside={
            data.hasContent ? <StatusPill tone={BUFFER_TONE[buffer.status]}>{bufferStatusLabel(buffer.status, lang)}</StatusPill> : undefined
          }
        >
          <span className="num">{buffer.days}</span>
          {t("days_suffix")}
        </KnowledgeRow>
        <KnowledgeRow
          href="/calendar"
          label={t("this_week")}
          detail={t("week_detail", { scheduled: week.scheduledRemaining, days: plural(t, "days", week.daysLeft) })}
        >
          <span className="num">
            {week.published} / {week.target}
          </span>{" "}
          {t("published_suffix")}
          <Meter value={week.published} max={Math.max(1, week.target)} size="sm" className="mt-1.5" aria-label={t("week_meter")} />
        </KnowledgeRow>
        <KnowledgeRow
          href={topPillar ? `/pillars?open=${topPillar.pillar.id}` : "/pillars"}
          label={t("top_pillar")}
          detail={
            topPillar
              ? t("top_pillar_detail", { views: formatCompact(topPillar.avgViews), posts: plural(t, "measured_posts", topPillar.posts) })
              : t("top_pillar_empty")
          }
        >
          {topPillar ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <ColorDot color={topPillar.pillar.color} />
              <span className="truncate">{topPillar.pillar.name}</span>
              {topPillar.ratio !== null ? (
                <span className="shrink-0 font-normal text-muted-foreground">{t("baseline", { ratio: formatMultiple(topPillar.ratio) })}</span>
              ) : null}
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">{t("not_enough")}</span>
          )}
        </KnowledgeRow>
        <KnowledgeRow
          href="/winners"
          label={t("winners")}
          detail={
            bestWinner
              ? t("best", { title: `${bestWinner.title}${bestWinner.ratio !== null ? ` (${formatMultiple(bestWinner.ratio)})` : ""}` })
              : t("winners_empty")
          }
        >
          <span className="num">{data.winnerCount}</span> {t.plural("winner_word", data.winnerCount)}
        </KnowledgeRow>
      </ul>
    </div>
  )
}

/** Desktop left column: everything the strategist is told, each row linking to where it lives. */
export function KnowledgeCard({ data }: { data: StrategistKnowledge }) {
  const t = useT(knowledgeMessages)
  return (
    <SectionCard
      title={t("title")}
      info={t("info")}
      contentClassName="px-0 pt-3 pb-0"
    >
      <KnowledgeBody data={data} />
    </SectionCard>
  )
}

function PromptButton({ prompt, disabled }: { prompt: StrategistPrompt; disabled: boolean }) {
  const Icon = prompt.icon
  const t = useT(strategistMessages)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => strategistSession.pick(prompt)}
      className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-input/50"
    >
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
      <span className="min-w-0 flex-1 text-pretty">{prompt.label ?? prompt.text}</span>
      {prompt.prefill ? <span className="shrink-0 pt-px text-xs text-muted-foreground">{t("add_details")}</span> : null}
    </button>
  )
}

type DataPrompt = { text: string; label: string }

function DataPrompts({ prompts, disabled }: { prompts: DataPrompt[]; disabled: boolean }) {
  const t = useT(knowledgeMessages)
  if (!prompts.length) return null
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{t("from_numbers")}</p>
      <ul className="-mx-2 flex flex-col">
        {prompts.map((prompt) => (
          <li key={prompt.text}>
            <PromptButton prompt={{ ...prompt, icon: Sparkles }} disabled={disabled} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The §56 prompts plus up to three raised by the current numbers. */
export function QuickPromptsCard({ extra }: { extra: DataPrompt[] }) {
  const busy = useStrategistSession((s) => s.pending?.status === "sending")
  const t = useT(knowledgeMessages)
  const prompts = suggestedPrompts(useUiLang())
  return (
    <SectionCard title={t("quick_title")} contentClassName="flex flex-col gap-3">
      <ul className="-mx-2 flex flex-col">
        {prompts.map((prompt) => (
          <li key={prompt.text}>
            <PromptButton prompt={prompt} disabled={busy} />
          </li>
        ))}
      </ul>
      {extra.length ? (
        <div className="border-t pt-3">
          <DataPrompts prompts={extra} disabled={busy} />
        </div>
      ) : null}
    </SectionCard>
  )
}

/** Small screens: the same knowledge, collapsed into one summary line above the conversation. */
export function MobileKnowledge({ data, extra }: { data: StrategistKnowledge; extra: DataPrompt[] }) {
  const busy = useStrategistSession((s) => s.pending?.status === "sending")
  const t = useT(knowledgeMessages)
  return (
    <Collapsible className="rounded-lg border bg-card lg:hidden">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <ScoreRing value={data.health.score} size={32} strokeWidth={3} tone="auto" label={t("health")} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{t("title")}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {t("mobile_summary", { score: data.health.score, days: data.buffer.days, winners: plural(t, "winners", data.winnerCount) })}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t pt-3">
        <KnowledgeBody data={data} />
        {extra.length ? (
          <div className="border-t px-4 py-3">
            <DataPrompts prompts={extra} disabled={busy} />
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
