"use client"

import { Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import { Slider as SliderPrimitive } from "radix-ui"
import { useId, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, ProviderBadge, ScoreRing, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { buildScoreIdeaInput, useAiTask } from "@/lib/ai"
import { IDEA_SCORE_DIMENSIONS, IDEA_SCORE_THRESHOLDS } from "@/lib/constants"
import { computeIdeaScore, NEUTRAL_IDEA_SCORES, priorityFromScore } from "@/lib/scoring"
import { dataActions, setIdeaScores } from "@/lib/store"
import type { ContentIdea, IdeaScores, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"
import { IdeaAiError } from "./idea-ai-error"
import { SCORE_BAND_LABEL } from "./idea-badges"

const BAND_ICON: Record<Priority, typeof TrendingUp> = { high: TrendingUp, medium: Minus, low: TrendingDown }

function BandPill({ band }: { band: Priority }) {
  return (
    <StatusPill tone={band === "high" ? "good" : "neutral"} icon={BAND_ICON[band]} className="uppercase tracking-wide">
      {SCORE_BAND_LABEL[band]}
    </StatusPill>
  )
}

/** 1–10 slider with a labelled thumb (the shared Slider can't name its thumb). */
function ScoreSlider({
  value,
  labelledBy,
  onChange,
  onCommit,
}: {
  value: number
  labelledBy: string
  onChange: (value: number) => void
  onCommit: (value: number) => void
}) {
  return (
    <SliderPrimitive.Root
      min={1}
      max={10}
      step={1}
      value={[value]}
      onValueChange={(values) => onChange(values[0] ?? value)}
      onValueCommit={(values) => onCommit(values[0] ?? value)}
      className="relative flex h-5 w-full touch-none items-center select-none"
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-muted dark:bg-input/60">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-labelledby={labelledBy}
        className="block size-4 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-shadow outline-none hover:ring-3 focus-visible:ring-3"
      />
    </SliderPrimitive.Root>
  )
}

function DimensionRow({
  dimension,
  value,
  saved,
  rationale,
  onChange,
  onCommit,
}: {
  dimension: (typeof IDEA_SCORE_DIMENSIONS)[number]
  value: number
  saved: number | null
  rationale?: string
  onChange: (value: number) => void
  onCommit: (value: number) => void
}) {
  const id = useId()
  const changed = saved !== null && saved !== value
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {dimension.label}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          <span className="num" title="Weight in the Idea Score">
            {Math.round(dimension.weight * 100)}%
          </span>
          <span aria-hidden> · </span>
          <span className={cn("font-semibold num", changed ? "text-brand" : "text-foreground")}>{value}</span>
          <span className="num">/10</span>
          {changed ? <span className="sr-only"> (saved {saved})</span> : null}
        </span>
      </div>
      <p className="text-xs text-pretty text-muted-foreground">{dimension.description}</p>
      <ScoreSlider value={value} labelledBy={`${id}-label`} onChange={onChange} onCommit={onCommit} />
      {rationale ? (
        <p className="flex gap-1.5 text-xs text-pretty text-muted-foreground">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-brand" aria-hidden />
          <span>{rationale}</span>
        </p>
      ) : null}
    </div>
  )
}

/**
 * Idea Priority Score (spec §39): seven weighted 1–10 dimensions → 0–100 with a High / Medium / Low
 * band. Sliders save on release; "Score with AI" proposes scores with a rationale to review first.
 */
export function IdeaScorePanel({ idea }: { idea: ContentIdea }) {
  const ai = useAiTask("score_idea")
  const [draft, setDraft] = useState<IdeaScores | null>(null)
  const [live, setLive] = useState<IdeaScores | null>(null)
  const saved = idea.scores
  const shown = live ?? draft ?? saved ?? NEUTRAL_IDEA_SCORES
  const total = computeIdeaScore(shown)
  const band = priorityFromScore(total)
  const hasScore = Boolean(saved || draft || live)
  const rationale = ai.data?.rationale

  function change(key: keyof IdeaScores, value: number) {
    setLive({ ...shown, [key]: value })
  }

  function commit(key: keyof IdeaScores, value: number) {
    const next = { ...shown, [key]: value }
    setLive(null)
    if (draft) setDraft(next)
    else setIdeaScores(idea.id, next)
  }

  async function scoreWithAi() {
    const result = await ai.run(buildScoreIdeaInput(dataActions.getDb(), idea), { entityType: "content_ideas", entityId: idea.id })
    if (result) setDraft(result.output.scores)
  }

  function apply() {
    if (!draft) return
    const score = computeIdeaScore(draft)
    setIdeaScores(idea.id, draft)
    setDraft(null)
    toast.success(`Idea Score ${score} / 100`, { description: `${SCORE_BAND_LABEL[priorityFromScore(score)]} priority — scores saved` })
  }

  const state = draft
    ? "Suggested scores — adjust any slider, then apply."
    : saved
      ? `Priority follows the score: High ≥ ${IDEA_SCORE_THRESHOLDS.high}, Medium ≥ ${IDEA_SCORE_THRESHOLDS.medium}.`
      : "Not scored yet — move a slider or score with AI."

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
        <ScoreRing value={hasScore ? total : null} size={56} label="Idea Score" />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Idea Score</p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold num">
              {hasScore ? total : "—"}
              <span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </span>
            {hasScore ? <BandPill band={band} /> : null}
          </p>
          <p className="text-xs text-pretty text-muted-foreground">{state}</p>
        </div>
        <AiButton type="button" size="sm" pending={ai.isPending} pendingLabel="Scoring…" onClick={() => void scoreWithAi()}>
          {ai.data ? "Re-score with AI" : "Score with AI"}
        </AiButton>
      </div>

      {ai.error ? <IdeaAiError message={ai.error.message} onRetry={() => void scoreWithAi()} /> : null}

      {draft && ai.data ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-brand/30 bg-brand-soft/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium">AI suggestion</h4>
            <ProviderBadge provider={ai.provider ?? "offline"} model={ai.model ?? undefined} />
          </div>
          <p className="text-sm text-pretty">{ai.data.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={apply}>
              Apply scores
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {IDEA_SCORE_DIMENSIONS.map((dimension) => (
          <DimensionRow
            key={dimension.key}
            dimension={dimension}
            value={shown[dimension.key]}
            saved={draft && saved ? saved[dimension.key] : null}
            rationale={rationale?.[dimension.key]}
            onChange={(value) => change(dimension.key, value)}
            onCommit={(value) => commit(dimension.key, value)}
          />
        ))}
      </div>

      <AiNotice>The Idea Score is a prioritisation aid for your strategy — weighted toward audience relevance — not a prediction of views.</AiNotice>
    </div>
  )
}
