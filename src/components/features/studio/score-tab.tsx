"use client"

import { CircleCheck, FilePen, Gauge, Info, Lightbulb } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AiButton,
  Delta,
  EmptyState,
  Meter,
  OptionSelect,
  ProviderBadge,
  ScoreRing,
  SectionCard,
  StatusPill,
  type MeterTone,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { useAiTask } from "@/lib/ai"
import { QUALITY_DIMENSIONS, QUALITY_RATINGS, SCRIPT_FORMATS } from "@/lib/constants"
import { formatDateTime } from "@/lib/dates"
import { dataActions, useTable } from "@/lib/store"
import type { ContentItem, ContentQualityScore, QualityRating, ScriptFormat } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { AiErrorNotice } from "./studio-ai"
import { draftKey, useStudioStore } from "./studio-store"
import { alignSections, currentScripts, defaultScriptFormat, sameSections, wordsIn } from "./studio-utils"

const DISCLAIMER = "A quality evaluation — not a prediction of virality."

const RATING_TONE: Record<QualityRating, "good" | "warning" | "serious"> = {
  high_potential: "good",
  solid: "good",
  needs_work: "warning",
  weak: "serious",
}

function dimensionTone(value: number, max: number): MeterTone {
  const share = value / max
  return share >= 0.75 ? "good" : share >= 0.5 ? "warning" : "serious"
}

/** Content Score (spec §28) of the current script: six dimensions, strengths and concrete improvements. */
export function ScoreTab({ item, onOpenScript }: { item: ContentItem; onOpenScript: () => void }) {
  const scripts = useTable("content_scripts")
  const formatRows = useTable("content_formats")
  const activeFormat = useStudioStore((s) => s.formats[item.id])
  const [chosen, setChosen] = useState<ScriptFormat | null>(null)
  const current = useMemo(() => currentScripts({ content_scripts: scripts }, item.id), [scripts, item.id])
  const preferred = chosen ?? activeFormat ?? defaultScriptFormat({ content_scripts: scripts, content_formats: formatRows }, item)
  const script = current.find((s) => s.format === preferred) ?? current[0] ?? null
  const draft = useStudioStore((s) => (script ? s.drafts[draftKey(item.id, script.format)] : undefined))
  const ai = useAiTask("score_content")
  const [previousTotal, setPreviousTotal] = useState<number | null>(null)

  const score = item.quality_score
  const stale = Boolean(score && script && script.updated_at > score.evaluated_at)
  const unsaved = Boolean(draft && script && !sameSections(draft.sections, alignSections(script.format, script.sections)))
  const formatOptions: SelectOption<ScriptFormat>[] = current.map((s) => ({ value: s.format, label: `${SCRIPT_FORMATS[s.format].label} · v${s.version}` }))

  async function run() {
    if (!script) return
    const text = (script.body || script.sections.map((s) => s.content).filter(Boolean).join("\n\n")).trim()
    if (!text) {
      toast.error("This script is empty", { description: "Write or generate the script before scoring it." })
      return
    }
    const result = await ai.run(
      {
        text: text.slice(0, 20000),
        format: script.format,
        platform: item.platform,
        hook: item.hook || null,
        pillar_id: item.pillar_id,
        persona_id: item.persona_id,
      },
      { entityType: "content_items", entityId: item.id }
    )
    if (!result) return
    const out = result.output
    const next: ContentQualityScore = {
      hook: out.hook,
      relevance: out.relevance,
      value: out.value,
      clarity: out.clarity,
      authenticity: out.authenticity,
      cta: out.cta,
      total: out.total,
      rating: out.rating,
      strengths: out.strengths,
      improvements: out.improvements,
      evaluated_at: new Date().toISOString(),
      provider: result.provider,
    }
    setPreviousTotal(score?.total ?? null)
    dataActions.update("content_items", item.id, { quality_score: next })
    toast.success(`Content Score ${next.total}/100 · ${QUALITY_RATINGS[next.rating].label}`, {
      description: "Saved to this piece. " + DISCLAIMER,
    })
  }

  if (!script && !score) {
    return (
      <EmptyState
        icon={Gauge}
        title="Write or generate a script first"
        description="The Content Score evaluates the current script — hook, relevance, value, clarity, authenticity and CTA — and tells you exactly what to improve."
        action={
          <Button type="button" size="sm" onClick={onOpenScript}>
            <FilePen aria-hidden />
            Open Script
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionCard
        title="Content Score"
        description={DISCLAIMER}
        action={
          <AiButton type="button" size="sm" variant={score ? "outline" : "default"} pending={ai.isPending} pendingLabel="Scoring…" disabled={!script} onClick={() => void run()}>
            {score ? "Re-score" : "Score this script"}
          </AiButton>
        }
        contentClassName="flex flex-col gap-4"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-4">
          <ScoreRing value={score?.total ?? null} size={96} strokeWidth={6} label="Content Score" tone={score ? RATING_TONE[score.rating] : "neutral"} />
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {score ? (
                <StatusPill tone={RATING_TONE[score.rating]}>{QUALITY_RATINGS[score.rating].label}</StatusPill>
              ) : (
                <StatusPill tone="neutral">Not scored yet</StatusPill>
              )}
              {stale ? <StatusPill tone="warning">Stale — the script changed after scoring</StatusPill> : null}
              {score && previousTotal !== null && previousTotal !== score.total ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Delta value={score.total - previousTotal} suffix=" pts" /> since the last score
                </span>
              ) : null}
            </div>
            {score ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-foreground num">{score.total}/100</span>
                <span>Scored {formatDateTime(score.evaluated_at)}</span>
                <ProviderBadge provider={score.provider} />
              </p>
            ) : (
              <p className="text-sm text-pretty text-muted-foreground">
                Scores the six dimensions below against your brand, audience and pillar, with concrete edits for each weak spot.
              </p>
            )}
            {script ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Scoring</span>
                {formatOptions.length > 1 ? (
                  <OptionSelect
                    value={script.format}
                    onChange={(next) => next && setChosen(next)}
                    options={formatOptions}
                    size="sm"
                    aria-label="Script to score"
                    className="w-auto max-w-60"
                  />
                ) : (
                  <span className="font-medium text-foreground">
                    {SCRIPT_FORMATS[script.format].label} · v{script.version}
                  </span>
                )}
                <span className="num">{pluralize(wordsIn(script.sections), "word")}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">The scored script no longer exists — write a new one to re-score.</p>
            )}
          </div>
        </div>
        {unsaved ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 text-pretty">
              You have unsaved edits in the Script tab. Scoring uses the saved version {script?.version} — save your edits to include them.
            </span>
            <Button type="button" variant="outline" size="xs" onClick={onOpenScript}>
              Open Script
            </Button>
          </div>
        ) : null}
        <AiErrorNotice error={ai.error} onRetry={() => void run()} />
      </SectionCard>

      <SectionCard title="Dimensions" description={score ? "Each dimension out of 20 (CTA out of 10), normalised to a total out of 100." : "What the score looks at."} contentClassName="flex flex-col divide-y px-0 pt-1 pb-1">
        {QUALITY_DIMENSIONS.map((d) => {
          const value = score ? score[d.key] : null
          return (
            <div key={d.key} className="grid min-w-0 items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-pretty text-muted-foreground">{d.question}</p>
              </div>
              {value !== null ? (
                <div className="flex items-center gap-3">
                  <Meter value={value} max={d.max} tone={dimensionTone(value, d.max)} aria-label={`${d.label} ${value} of ${d.max}`} className="flex-1" />
                  <span className="w-12 shrink-0 text-right text-sm font-medium num">
                    {value}
                    <span className="text-xs font-normal text-muted-foreground">/{d.max}</span>
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground sm:text-right">— / {d.max}</span>
              )}
            </div>
          )
        })}
      </SectionCard>

      {score ? (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
          <SectionCard title="Strengths" icon={CircleCheck} description="Keep these when you edit.">
            {score.strengths.length ? (
              <ul className="flex flex-col gap-2">
                {score.strengths.map((s) => (
                  <li key={s} className="flex gap-2 text-sm text-pretty">
                    <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-good-fg" aria-hidden />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No standout strengths yet.</p>
            )}
          </SectionCard>
          <SectionCard title="Improvements" icon={Lightbulb} description="Concrete edits, most important first.">
            {score.improvements.length ? (
              <ol className="flex flex-col gap-2.5">
                {score.improvements.map((s, index) => (
                  <li key={s} className="flex gap-2 text-sm text-pretty">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium num">{index + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing to fix — ship it.</p>
            )}
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onOpenScript}>
              <FilePen aria-hidden />
              Edit the script
            </Button>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
