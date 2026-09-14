"use client"

import { Grid3x3, RotateCcw, Target } from "lucide-react"
import { useMemo } from "react"
import {
  ChipToggleGroup,
  FormatCategoryIcon,
  FormField,
  MultiSelect,
  PersonaSelect,
  SectionCard,
  type ChipOption,
  type MultiSelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES } from "@/lib/constants"
import type { FunnelStage, ID } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { FUNNEL_COLORS } from "./funnel-utils"
import { SeverityMark } from "./matrix-chips"
import type { MatrixData, MatrixSelectionIds } from "./matrix-data"
import { MATRIX_LIMIT } from "./matrix-engine"

const STAGE_OPTIONS: ChipOption<FunnelStage>[] = FUNNEL_STAGE_IDS.map((id) => ({
  value: id,
  label: `${FUNNEL_STAGES[id].label} · ${FUNNEL_STAGES[id].name}`,
  color: FUNNEL_COLORS[id],
}))

export interface DimensionCounts {
  pillars: number
  formats: number
  problems: number
  goals: number
  stages: number
}

/** Pick the matrix dimensions; the footer shows the cartesian size and runs the generation. */
export function MatrixDimensions({
  data,
  value,
  onChange,
  onPersonaChange,
  onGenerate,
  onReset,
  counts,
  total,
  stale,
  isDefault,
}: {
  data: MatrixData
  value: MatrixSelectionIds
  onChange: (value: MatrixSelectionIds) => void
  onPersonaChange: (personaId: ID | null) => void
  onGenerate: () => void
  onReset: () => void
  counts: DimensionCounts
  total: number
  /** The ranked list below was generated from a different selection. */
  stale: boolean
  isDefault: boolean
}) {
  const options = useMemo(() => {
    const problems = data.problems.filter((p) => !value.personaId || p.personaId === value.personaId)
    return {
      pillars: data.pillars.map((p): MultiSelectOption => ({ value: p.id, label: p.name, color: p.color })),
      formats: data.formats.map(
        (f): MultiSelectOption => ({
          value: f.id,
          label: f.name,
          icon: <FormatCategoryIcon category={f.category} className="size-3.5 text-muted-foreground" />,
        })
      ),
      problems: problems.map(
        (p): MultiSelectOption => ({
          value: p.id,
          label: truncate(p.text, 90),
          keywords: [p.text, `severity ${p.severity}`],
          icon: <SeverityMark severity={p.severity} />,
        })
      ),
      goals: data.goals.map(
        (g): MultiSelectOption => ({ value: g.id, label: g.name, icon: <Target className="size-3.5 text-muted-foreground" aria-hidden /> })
      ),
    }
  }, [data, value.personaId])

  const set = <K extends keyof MatrixSelectionIds>(key: K, next: MatrixSelectionIds[K]) => onChange({ ...value, [key]: next })
  const missing = [
    !counts.pillars && "a pillar",
    !counts.formats && "a format",
    !counts.problems && "an audience problem",
    !counts.goals && "a goal",
    !counts.stages && "a funnel stage",
  ].filter((m): m is string => Boolean(m))

  return (
    <SectionCard
      title="Dimensions"
      description="Every pillar × format × problem × goal × stage you pick becomes a candidate — the strongest are ranked below."
      action={
        isDefault ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw aria-hidden />
            Reset
          </Button>
        )
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <span className="num">
            {counts.pillars} × {counts.formats} × {counts.problems} × {counts.goals} × {counts.stages} ={" "}
            <strong className="font-semibold text-foreground">{formatNumber(total)}</strong> combinations
            {total > MATRIX_LIMIT ? ` · top ${MATRIX_LIMIT} ranked` : ""}
          </span>
          {missing.length ? (
            <span role="alert" className="text-warning-fg">
              Pick at least {missing[0]}.
            </span>
          ) : stale ? (
            <span>Selection changed — generate again to update the list.</span>
          ) : null}
          <Button type="button" size="sm" className="ml-auto" disabled={missing.length > 0} onClick={onGenerate}>
            <Grid3x3 aria-hidden />
            Generate combinations
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FormField
          label="Pillars"
          htmlFor="matrix-pillars"
          labelAction={<SelectAll selected={value.pillars.length} all={options.pillars} onSelect={(ids) => set("pillars", ids)} />}
        >
          <MultiSelect
            id="matrix-pillars"
            options={options.pillars}
            value={value.pillars}
            onChange={(next) => set("pillars", next)}
            placeholder="Pick pillars"
            emptyText="No active pillars."
          />
        </FormField>

        <FormField
          label="Formats"
          htmlFor="matrix-formats"
          labelAction={<SelectAll selected={value.formats.length} all={options.formats} onSelect={(ids) => set("formats", ids)} />}
        >
          <MultiSelect
            id="matrix-formats"
            options={options.formats}
            value={value.formats}
            onChange={(next) => set("formats", next)}
            placeholder="Pick formats"
            emptyText="No formats in the library."
          />
        </FormField>

        <FormField label="Audience" htmlFor="matrix-persona" description="Optional — limits problems to one persona.">
          <PersonaSelect
            id="matrix-persona"
            allowNone
            noneLabel="All personas"
            placeholder="All personas"
            value={value.personaId}
            onChange={onPersonaChange}
          />
        </FormField>

        <FormField
          label="Audience problems"
          htmlFor="matrix-problems"
          labelAction={<SelectAll selected={counts.problems} all={options.problems} onSelect={(ids) => set("problems", ids)} />}
        >
          <MultiSelect
            id="matrix-problems"
            options={options.problems}
            value={value.problems}
            onChange={(next) => set("problems", next)}
            placeholder="Pick problems"
            maxChips={2}
            emptyText={value.personaId ? "No problems for this persona yet." : "The Problem Bank is empty."}
          />
        </FormField>

        <FormField
          label="Goals"
          htmlFor="matrix-goals"
          labelAction={<SelectAll selected={value.goals.length} all={options.goals} onSelect={(ids) => set("goals", ids)} />}
        >
          <MultiSelect
            id="matrix-goals"
            options={options.goals}
            value={value.goals}
            onChange={(next) => set("goals", next)}
            placeholder="Pick goals"
            emptyText="No active goals."
          />
        </FormField>

        <FormField label="Funnel stages">
          <ChipToggleGroup multiple options={STAGE_OPTIONS} value={value.stages} onChange={(next) => set("stages", next)} aria-label="Funnel stages" />
        </FormField>
      </div>
    </SectionCard>
  )
}

function SelectAll({
  selected,
  all,
  onSelect,
}: {
  selected: number
  all: MultiSelectOption[]
  onSelect: (ids: string[]) => void
}) {
  if (!all.length || selected >= all.length) return null
  return (
    <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => onSelect(all.map((o) => o.value))}>
      Select all
    </Button>
  )
}
