"use client"

import { ArrowUpRight, Clapperboard, Compass, Gauge, Lightbulb, MonitorSmartphone, Plus, Target, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState, FormatCategoryIcon, InlineText, PillarBadge, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RECOMMENDATION_WEIGHTS, type RecommendationFactor, type RecommendationReasons } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { uiActions, useRow } from "@/lib/store"
import { cn } from "@/lib/utils"
import { FACTOR_LABELS, type Suggestion } from "./suggestion"

/** Decision-engine score with the per-factor breakdown on hover/focus. */
export function ScoreToken({ s }: { s: Suggestion }) {
  if (s.score === null) return null
  const factors = s.breakdown ? (Object.keys(RECOMMENDATION_WEIGHTS) as RecommendationFactor[]) : []
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`Decision engine score ${s.score} out of 100`}
          className="inline-flex h-5 shrink-0 cursor-default items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium text-foreground/85 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:bg-input/30"
        >
          <Gauge className="size-3 text-muted-foreground" aria-hidden />
          <span className="num">{s.score}</span>
          <span className="font-normal text-muted-foreground">/ 100</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-stretch gap-1 py-2">
        <span className="font-medium">Decision engine score</span>
        {factors.map((factor) => (
          <span key={factor} className="flex justify-between gap-6">
            <span>{FACTOR_LABELS[factor]}</span>
            <span className="num">
              {s.breakdown?.[factor] ?? 0} / {RECOMMENDATION_WEIGHTS[factor]}
            </span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

/** "Today's best content" eyebrow (or the option number), score, whether it's already on the board, and an optional right-hand action. */
export function SuggestionEyebrow({
  s,
  position,
  total,
  action,
}: {
  s: Suggestion
  position: number
  total: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {position === 0 ? "Today's best content" : `Option ${position + 1} of ${total}`}
      </span>
      <ScoreToken s={s} />
      {s.kind === "item" ? <span className="text-xs text-muted-foreground">· Already in the Pipeline</span> : null}
      {action ? <span className="-my-1 ml-auto flex shrink-0 items-center">{action}</span> : null}
    </div>
  )
}

/** Platform · format · angle · pillar. */
export function SuggestionMeta({ s, className }: { s: Suggestion; className?: string }) {
  const format = useRow("content_formats", s.formatId)
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        <PlatformIcon platform={s.platform} className="size-3.5" />
        {PLATFORMS[s.platform]?.label ?? s.platform}
      </span>
      {s.formatName ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <FormatCategoryIcon category={format?.category} className="size-3.5 shrink-0" />
          <span className="truncate">{s.formatName}</span>
        </span>
      ) : null}
      {s.angleName ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Compass className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{s.angleName}</span>
        </span>
      ) : null}
      {s.pillarId ? <PillarBadge pillarId={s.pillarId} variant="plain" className="text-muted-foreground" /> : null}
    </div>
  )
}

export function HookQuote({ text, className }: { text: string; className?: string }) {
  return (
    <blockquote className={cn("border-l-2 border-brand/40 pl-2.5 text-sm leading-snug text-pretty", className)}>
      “{text}”
    </blockquote>
  )
}

/** One reason line with an icon (compact card). */
export function ReasonLine({ text }: { text: string }) {
  if (!text) return null
  return (
    <p className="flex items-start gap-1.5 text-xs leading-snug text-pretty text-muted-foreground">
      <Target className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  )
}

const WHY: { key: keyof RecommendationReasons; label: string; icon: LucideIcon }[] = [
  { key: "topic", label: "Why this topic", icon: Target },
  { key: "platform", label: "Why this platform", icon: MonitorSmartphone },
  { key: "format", label: "Why this format", icon: Clapperboard },
  { key: "angle", label: "Why this angle", icon: Compass },
]

/** The four plain-language decisions: topic, platform, format, angle. */
export function WhyList({ s }: { s: Suggestion }) {
  return (
    <dl className="grid gap-2.5 rounded-lg border bg-muted/25 p-3 dark:bg-muted/10">
      {WHY.map(({ key, label, icon: Icon }) => (
        <div key={key} className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2 gap-y-0.5">
          <Icon className="mt-0.5 size-3.5 text-muted-foreground" aria-hidden />
          <dt className="text-xs font-medium">{label}</dt>
          <dd className="col-start-2 text-xs leading-snug text-pretty text-muted-foreground">{s.reasons[key] || "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SignalList({ signals }: { signals: string[] }) {
  if (!signals.length) return null
  return (
    <div className="flex flex-col gap-1">
      <h5 className="text-xs font-medium text-muted-foreground">Also supporting it</h5>
      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs leading-snug text-pretty text-muted-foreground marker:text-muted-foreground/60">
        {signals.map((signal) => (
          <li key={signal}>{signal}</li>
        ))}
      </ul>
    </div>
  )
}

/** Click-to-edit hook / CTA — the edit is used when the content is created. */
export function EditableLine({
  label,
  value,
  placeholder,
  edited,
  onSave,
}: {
  label: string
  value: string
  placeholder: string
  edited: boolean
  onSave: (value: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">
        {label}
        {edited ? <span className="text-muted-foreground/80"> · edited</span> : null}
      </span>
      <InlineText value={value} onSave={onSave} multiline placeholder={placeholder} aria-label={label} />
    </div>
  )
}

export function CreateButton({ s, onCreate, className }: { s: Suggestion; onCreate: () => void; className?: string }) {
  return (
    <Button type="button" size="sm" onClick={onCreate} className={className}>
      {s.kind === "idea" ? <Plus aria-hidden /> : <ArrowUpRight aria-hidden />}
      {s.kind === "idea" ? "Create this content" : "Continue in Studio"}
    </Button>
  )
}

export function OpenIdeaButton({
  ideaId,
  size = "sm",
  className,
}: {
  ideaId: string | null
  size?: "xs" | "sm"
  className?: string
}) {
  if (!ideaId) return null
  return (
    <Button asChild size={size} variant="ghost" className={cn("text-muted-foreground", className)}>
      <Link href={`/ideas?open=${ideaId}`}>Open idea</Link>
    </Button>
  )
}

/** The rest of the ranking; choosing one makes it the current suggestion. */
export function Alternatives({
  list,
  position,
  onSelect,
}: {
  list: Suggestion[]
  position: number
  onSelect: (index: number) => void
}) {
  const others = list.map((s, index) => ({ s, index })).filter(({ index }) => index !== position)
  if (!others.length) return null
  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <h5 className="text-xs font-medium text-muted-foreground">Alternatives</h5>
      <ul className="-mx-2 flex flex-col">
        {others.map(({ s, index }) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              className="flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="w-3 shrink-0 text-xs text-muted-foreground num">{index + 1}</span>
              <PlatformIcon platform={s.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
              {s.score !== null ? (
                <span className="shrink-0 text-xs text-muted-foreground num" title="Decision engine score">
                  {s.score}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NoSuggestions() {
  return (
    <EmptyState
      compact
      icon={Lightbulb}
      title="Nothing to rank yet"
      description="Capture or generate ideas — the decision engine ranks them against your pillars, posting schedule and winners."
      action={
        <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
          Capture idea
        </Button>
      }
      secondaryAction={
        <Button asChild size="sm" variant="outline">
          <Link href="/ideas/generator">Idea Generator</Link>
        </Button>
      }
    />
  )
}
