"use client"

import { Grid3x3 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { createIdea, dataActions, useDb, useSettings } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"
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
import { MatrixResults } from "./matrix-results"
import { PillarsTabs } from "./pillars-tabs"

interface Generated {
  combos: MatrixCombo[]
  total: number
  signature: string
}

function run(data: MatrixData, ids: MatrixSelectionIds): Generated {
  const selection = resolveSelection(data, ids)
  return { combos: generateCombinations(selection, data.coverage), total: comboCount(selection), signature: selectionSignature(ids) }
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
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())
  const data = useMemo(() => buildMatrixData(db, now, settings), [db, now, settings])

  // Start with a ranked list so the page shows value immediately; later runs are explicit.
  const [initial] = useState(() => {
    const ids = defaultSelection(data, db, params)
    return { ids, generated: run(data, ids) }
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
    const next = run(data, ids)
    setGenerated(next)
    toast.success(`${pluralize(next.combos.length, "combination")} ranked`, {
      description: `From ${formatNumber(next.total)} possible — under-target pillars and severe problems first.`,
    })
    requestAnimationFrame(() => document.getElementById("matrix-results")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function save(combo: MatrixCombo) {
    const idea = createIdea(matrixIdeaValues(combo, dataActions.getDb()))
    toast.success("Saved to the Idea Bank", {
      description: idea.title,
      action: { label: "Open", onClick: () => router.push(`/ideas?open=${idea.id}`) },
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
    !data.pillars.length && { label: "active content pillars", href: "/pillars", action: "Set up pillars" },
    !data.problems.length && { label: "audience problems", href: "/audience/problems", action: "Open the Problem Bank" },
    !data.goals.length && { label: "active goals", href: "/strategy/goals", action: "Set goals" },
    !data.formats.length && { label: "content formats", href: "/settings", action: "Open Settings" },
  ].filter((p): p is { label: string; href: string; action: string } => Boolean(p))

  return (
    <PageContainer>
      <PageHeader
        title="Content Matrix"
        description="Combine pillars, formats, audience problems, goals and funnel stages into ranked ideas — the biggest gaps come first."
      >
        <PillarsTabs />
      </PageHeader>

      {prerequisites.length ? (
        <EmptyState
          icon={Grid3x3}
          title="The matrix needs a few building blocks"
          description={`Add ${new Intl.ListFormat("en", { type: "conjunction" }).format(prerequisites.map((p) => p.label))} first — the matrix combines them into ranked, ready-to-save ideas.`}
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
