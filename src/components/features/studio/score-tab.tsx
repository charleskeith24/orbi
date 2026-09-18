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
import { useT } from "@/lib/i18n"
import { QUALITY_DIMENSIONS, QUALITY_RATINGS, SCRIPT_FORMATS } from "@/lib/constants"
import { formatDateTime } from "@/lib/dates"
import { dataActions, useTable } from "@/lib/store"
import type { ContentItem, ContentQualityScore, QualityRating, ScriptFormat } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { scoreMessages } from "./performance-messages"
import { AiErrorNotice } from "./studio-ai"
import { draftKey, useStudioStore } from "./studio-store"
import { alignSections, currentScripts, defaultScriptFormat, sameSections, wordsIn } from "./studio-utils"

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
  const t = useT(scoreMessages)
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
      toast.error(t("script_empty"), { description: t("script_empty_description") })
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
    toast.success(t("scored_toast", { total: next.total, rating: QUALITY_RATINGS[next.rating].label }), {
      description: t("scored_description", { disclaimer: t("disclaimer") }),
    })
  }

  if (!script && !score) {
    return (
      <EmptyState
        icon={Gauge}
        title={t("empty_title")}
        description={t("empty_description")}
        action={
          <Button type="button" size="sm" onClick={onOpenScript}>
            <FilePen aria-hidden />
            {t("open_script")}
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionCard
        title={t("content_score")}
        description={t("disclaimer")}
        action={
          <AiButton type="button" size="sm" variant={score ? "outline" : "default"} pending={ai.isPending} pendingLabel={t("scoring_pending")} disabled={!script} onClick={() => void run()}>
            {score ? t("rescore") : t("score_script")}
          </AiButton>
        }
        contentClassName="flex flex-col gap-4"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-4">
          <ScoreRing value={score?.total ?? null} size={96} strokeWidth={6} label={t("content_score")} tone={score ? RATING_TONE[score.rating] : "neutral"} />
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {score ? (
                <StatusPill tone={RATING_TONE[score.rating]}>{QUALITY_RATINGS[score.rating].label}</StatusPill>
              ) : (
                <StatusPill tone="neutral">{t("not_scored")}</StatusPill>
              )}
              {stale ? <StatusPill tone="warning">{t("stale")}</StatusPill> : null}
              {score && previousTotal !== null && previousTotal !== score.total ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Delta value={score.total - previousTotal} suffix=" pts" /> {t("since_last")}
                </span>
              ) : null}
            </div>
            {score ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-foreground num">{score.total}/100</span>
                <span>{t("scored_on", { date: formatDateTime(score.evaluated_at) })}</span>
                <ProviderBadge provider={score.provider} />
              </p>
            ) : (
              <p className="text-sm text-pretty text-muted-foreground">
                {t("intro")}
              </p>
            )}
            {script ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{t("scoring")}</span>
                {formatOptions.length > 1 ? (
                  <OptionSelect
                    value={script.format}
                    onChange={(next) => next && setChosen(next)}
                    options={formatOptions}
                    size="sm"
                    aria-label={t("script_to_score")}
                    className="w-auto max-w-60"
                  />
                ) : (
                  <span className="font-medium text-foreground">
                    {SCRIPT_FORMATS[script.format].label} · v{script.version}
                  </span>
                )}
                <span className="num">{t.plural("words", wordsIn(script.sections), { count: formatNumber(wordsIn(script.sections)) })}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("script_gone")}</p>
            )}
          </div>
        </div>
        {unsaved ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 text-pretty">
              {t("unsaved_edits", { version: script?.version ?? "" })}
            </span>
            <Button type="button" variant="outline" size="xs" onClick={onOpenScript}>
              {t("open_script")}
            </Button>
          </div>
        ) : null}
        <AiErrorNotice error={ai.error} onRetry={() => void run()} />
      </SectionCard>

      <SectionCard
        title={t("dimensions")}
        description={score ? t("dimensions_scored") : t("dimensions_empty")} contentClassName="flex flex-col divide-y px-0 pt-1 pb-1">
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
                  <Meter value={value} max={d.max} tone={dimensionTone(value, d.max)} aria-label={t("dimension_aria", { label: d.label, value, max: d.max })} className="flex-1" />
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
          <SectionCard title={t("strengths")} icon={CircleCheck} description={t("strengths_description")}>
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
              <p className="text-xs text-muted-foreground">{t("no_strengths")}</p>
            )}
          </SectionCard>
          <SectionCard title={t("improvements")} icon={Lightbulb} description={t("improvements_description")}>
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
              <p className="text-xs text-muted-foreground">{t("no_improvements")}</p>
            )}
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onOpenScript}>
              <FilePen aria-hidden />
              {t("edit_script")}
            </Button>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
