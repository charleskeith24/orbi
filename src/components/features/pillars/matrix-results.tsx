"use client"

import { Check, Grid3x3, Plus, Sparkles } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState, FunnelBadge, InfoHint, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useLookup } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { FormatChip, GoalChip, PillarChip, ProblemChip } from "./matrix-chips"
import type { MatrixData } from "./matrix-data"
import type { MatrixCombo } from "./matrix-engine"
import { generatorHref } from "./matrix-idea"
import { matrixMessages } from "./matrix-messages"

const PAGE_SIZE = 12

/** Ranked combinations with their chips, working title, reasons and Save / Expand actions. */
export function MatrixResults({
  combos,
  total,
  data,
  canGenerate,
  onSave,
  onGenerate,
}: {
  combos: MatrixCombo[] | null
  /** Size of the cartesian product the list was ranked from. */
  total: number
  data: MatrixData
  canGenerate: boolean
  onSave: (combo: MatrixCombo) => void
  onGenerate: () => void
}) {
  const t = useT(matrixMessages)
  const personas = useLookup("audience_personas")
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [source, setSource] = useState(combos)
  // A new generation starts again from the first page.
  if (source !== combos) {
    setSource(combos)
    setLimit(PAGE_SIZE)
  }

  const colorById = new Map(data.pillars.map((p) => [p.id, p.color]))
  const categoryById = new Map(data.formats.map((f) => [f.id, f.category]))
  const visible = combos?.slice(0, limit) ?? []

  return (
    <SectionCard
      title={t("results_title")}
      count={combos?.length ? combos.length : null}
      info={combos?.length ? t("results_description", { shown: combos.length, total: formatNumber(total) }) : undefined}
      contentClassName={combos?.length ? "p-0" : undefined}
    >
      {combos?.length ? (
        <>
          <ol className="divide-y border-t">
            {visible.map((combo) => {
              const savedId = data.ideaByKey.get(combo.key)
              return (
                <li key={combo.key} className="grid gap-x-4 gap-y-2.5 px-4 py-3 md:grid-cols-[2rem_minmax(0,1fr)_auto]">
                  <span className="num hidden pt-0.5 text-xs text-muted-foreground md:block">{combo.rank}</span>
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-medium text-pretty">
                      <span className="num mr-1.5 text-xs font-normal text-muted-foreground md:hidden">{combo.rank}.</span>
                      {combo.title}
                    </p>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      <PillarChip name={combo.pillar.name} color={colorById.get(combo.pillar.id) ?? "blue"} />
                      <FormatChip name={combo.format.name} category={categoryById.get(combo.format.id) ?? "text"} />
                      <FunnelBadge stage={combo.stage.id} showName />
                      <GoalChip name={combo.goal.name} />
                      <ProblemChip
                        text={combo.problem.text}
                        severity={combo.problem.severity}
                        persona={combo.problem.personaId ? (personas.get(combo.problem.personaId)?.name ?? null) : null}
                      />
                      {combo.reasons.length ? (
                        <InfoHint label={t("why_rank", { rank: combo.rank })} title={t("why")} className="ml-0.5">
                          <ul className="flex list-disc flex-col gap-0.5 pl-4">
                            {combo.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </InfoHint>
                      ) : null}
                    </div>

                  </div>
                  <div className="flex flex-wrap items-start gap-1.5 md:justify-end">
                    {savedId ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/ideas?open=${savedId}`}>
                          <Check className="text-good-fg" aria-hidden />
                          {t("in_idea_bank")}
                        </Link>
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={() => onSave(combo)}>
                        <Plus aria-hidden />
                        {t("save_as_idea")}
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon-sm" title={t("expand_with_ai")}>
                      <Link href={generatorHref(combo)} aria-label={t("expand_with_ai")}>
                        <Sparkles className="text-brand" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
          {combos.length > limit ? (
            <div className="border-t px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
              >
                {t("show_more", { count: Math.min(PAGE_SIZE, combos.length - limit) })}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          compact
          icon={Grid3x3}
          title={t("no_combinations")}
          description={t("no_combinations_description")}
          action={
            <Button type="button" size="sm" onClick={onGenerate} disabled={!canGenerate}>
              <Grid3x3 aria-hidden />
              {t("generate")}
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
