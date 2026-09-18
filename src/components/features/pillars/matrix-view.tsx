"use client"

import { Grid3x3 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, useUiLang, type UiLang } from "@/lib/i18n"
import { createIdea, dataActions, useDb, useSettings } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { MatrixCoverage } from "./matrix-coverage"
import {
  buildMatrixData,
  DEFAULT_PROBLEM_COUNT,
  defaultSelection,
  resolveSelection,
  selectionSignature,
  type MatrixData,
  type MatrixSelectionIds,
} from "./matrix-data"
import { MatrixDimensions } from "./matrix-dimensions"
import { comboCount, generateCombinations, type MatrixCombo } from "./matrix-engine"
import { matrixIdeaValues } from "./matrix-idea"
import { matrixMessages } from "./matrix-messages"
import { MatrixResults } from "./matrix-results"
import { PillarsTabs } from "./pillars-tabs"

interface Generated {
  combos: MatrixCombo[]
  total: number
  signature: string
}

function run(data: MatrixData, ids: MatrixSelectionIds, lang: UiLang): Generated {
  const selection = resolveSelection(data, ids)
  return {
    combos: generateCombinations(selection, data.coverage, undefined, lang),
    total: comboCount(selection),
    signature: selectionSignature(ids),
  }
}

/** Content Matrix (spec §7). `?pillar=` / `?format=` / `?persona=` preselect dimensions (remounts when they change). */
export function MatrixView() {
  const searchParams = useSearchParams()
  return (
    <MatrixWorkspace
      key={searchParams.toString()}
      params={{ pillar: searchParams.get("pillar"), format: searchParams.get("format"), persona: searchParams.get("persona") }}
    />
  )
}

function MatrixWorkspace({ params }: { params: { pillar: string | null; format: string | null; persona: string | null } }) {
  const router = useRouter()
  const t = useT(matrixMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())
  const data = useMemo(() => buildMatrixData(db, now, settings, lang), [db, now, settings, lang])

  // Start with a ranked list so the page shows value immediately; later runs are explicit.
  const [initial] = useState(() => {
    const ids = defaultSelection(data, db, params)
    return { ids, generated: run(data, ids, lang) }
  })
  const [selection, setSelection] = useState<MatrixSelectionIds>(initial.ids)
  const [generated, setGenerated] = useState<Generated | null>(initial.generated)

  const resolved = useMemo(() => resolveSelection(data, selection), [data, selection])
  const total = comboCount(resolved)
  const counts = {
    pillars: resolved.pillars.length,
    formats: resolved.formats.length,
    problems: resolved.problems.length,
    goals: resolved.goals.length,
    stages: resolved.stages.length,
  }
  const signature = selectionSignature(selection)
  const defaultSignature = useMemo(() => selectionSignature(defaultSelection(data, db)), [data, db])
  const stale = generated !== null && generated.signature !== signature

  function generate(ids: MatrixSelectionIds) {
    const next = run(data, ids, lang)
    setGenerated(next)
    toast.success(t.plural("ranked", next.combos.length, { count: formatNumber(next.combos.length) }), {
      description: t("ranked_description", { total: formatNumber(next.total) }),
    })
    requestAnimationFrame(() => document.getElementById("matrix-results")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function save(combo: MatrixCombo) {
    const idea = createIdea(matrixIdeaValues(combo, dataActions.getDb()))
    toast.success(t("saved"), {
      description: idea.title,
      action: { label: t("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  function planGap(pillarId: ID, formatId: ID) {
    const next = { ...selection, pillars: [pillarId], formats: [formatId] }
    setSelection(next)
    generate(next)
  }

  function setPersona(personaId: ID | null) {
    const allowed = data.problems.filter((p) => !personaId || p.personaId === personaId)
    setSelection((current) => {
      const kept = current.problems.filter((id) => allowed.some((p) => p.id === id))
      return {
        ...current,
        personaId,
        problems: kept.length ? kept : allowed.slice(0, DEFAULT_PROBLEM_COUNT).map((p) => p.id),
      }
    })
  }

  const prerequisites = [
    !data.pillars.length && { label: t("need_pillars"), href: "/pillars", action: t("setup_pillars") },
    !data.problems.length && { label: t("need_problems"), href: "/audience/problems", action: t("open_problem_bank") },
    !data.goals.length && { label: t("need_goals"), href: "/strategy/goals", action: t("set_goals") },
    !data.formats.length && { label: t("need_formats"), href: "/settings", action: t("open_settings") },
  ].filter((p): p is { label: string; href: string; action: string } => Boolean(p))
  const labels = prerequisites.map((p) => p.label)
  const needList =
    lang === "en" || labels.length < 2
      ? new Intl.ListFormat("en", { type: "conjunction" }).format(labels)
      : t("list_and", { list: labels.slice(0, -1).join(", "), last: labels[labels.length - 1] })

  return (
    <PageContainer>
      <PageHeader
        title="Content Matrix"
        description={t("description")}
      >
        <PillarsTabs />
      </PageHeader>

      {prerequisites.length ? (
        <EmptyState
          icon={Grid3x3}
          title={t("needs_title")}
          description={t("needs_description", { list: needList })}
          action={
            <Button asChild size="sm">
              <Link href={prerequisites[0].href}>{prerequisites[0].action}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <MatrixDimensions
            data={data}
            value={selection}
            onChange={setSelection}
            onPersonaChange={setPersona}
            onGenerate={() => generate(selection)}
            onReset={() => setSelection(defaultSelection(data, db))}
            counts={counts}
            total={total}
            stale={stale}
            isDefault={signature === defaultSignature}
          />
          <div id="matrix-results" className="scroll-mt-4">
            <MatrixResults
              combos={generated?.combos ?? null}
              total={generated?.total ?? 0}
              data={data}
              canGenerate={total > 0}
              onSave={save}
              onGenerate={() => generate(selection)}
            />
          </div>
          <MatrixCoverage data={data} onPlan={planGap} />
        </>
      )}
    </PageContainer>
  )
}
