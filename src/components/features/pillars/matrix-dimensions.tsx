"use client"

import { Grid3x3, RotateCcw, Target } from "lucide-react"
import { useMemo, useState } from "react"
import {
  ChipToggleGroup,
  Disclosure,
  FormatCategoryIcon,
  FormField,
  InfoHint,
  MultiSelect,
  PersonaSelect,
  SectionCard,
  type ChipOption,
  type MultiSelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import type { FunnelStage, ID } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { FUNNEL_COLORS } from "./funnel-utils"
import { SeverityMark } from "./matrix-chips"
import type { MatrixData, MatrixSelectionIds } from "./matrix-data"
import { MATRIX_LIMIT } from "./matrix-engine"
import { matrixMessages } from "./matrix-messages"

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

/**
 * Pick the matrix dimensions; the footer shows the cartesian size and runs the generation. The pickers wait behind
 * "Edit dimensions" (the page opens with a ranked list already); they open by themselves when a dimension is empty.
 */
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
  defaultOpen = false,
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
  /** Open the pickers on arrival (e.g. a link preselected dimensions). */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const t = useT(matrixMessages)
  const c = useT(commonMessages)
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
    !counts.pillars && t("missing_pillar"),
    !counts.formats && t("missing_format"),
    !counts.problems && t("missing_problem"),
    !counts.goals && t("missing_goal"),
    !counts.stages && t("missing_stage"),
  ].filter((m): m is string => Boolean(m))

  return (
    <SectionCard
      title={t("dimensions")}
      info={t("dimensions_description")}
      action={
        isDefault ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw aria-hidden />
            {c("reset")}
          </Button>
        )
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <span className="num">
            {counts.pillars} × {counts.formats} × {counts.problems} × {counts.goals} × {counts.stages} ={" "}
            <strong className="font-semibold text-foreground">{formatNumber(total)}</strong> {t("combinations")}
            {total > MATRIX_LIMIT ? ` · ${t("top_ranked", { count: MATRIX_LIMIT })}` : ""}
          </span>
          {missing.length ? (
            <span role="alert" className="text-warning-fg">
              {t("pick_at_least", { what: missing[0] })}
            </span>
          ) : stale ? (
            <span>{t("selection_changed")}</span>
          ) : null}
          <Button type="button" size="sm" className="ml-auto" disabled={missing.length > 0} onClick={onGenerate}>
            <Grid3x3 aria-hidden />
            {t("generate")}
          </Button>
        </div>
      }
    >
      <Disclosure label={t("edit_dimensions")} open={open || missing.length > 0} onOpenChange={setOpen} contentClassName="pt-3">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            label={t("pillars")}
            htmlFor="matrix-pillars"
            labelAction={<SelectAll selected={value.pillars.length} all={options.pillars} onSelect={(ids) => set("pillars", ids)} />}
          >
            <MultiSelect
              id="matrix-pillars"
              options={options.pillars}
              value={value.pillars}
              onChange={(next) => set("pillars", next)}
              placeholder={t("pick_pillars")}
              emptyText={t("no_active_pillars")}
            />
          </FormField>

          <FormField
            label={t("formats")}
            htmlFor="matrix-formats"
            labelAction={<SelectAll selected={value.formats.length} all={options.formats} onSelect={(ids) => set("formats", ids)} />}
          >
            <MultiSelect
              id="matrix-formats"
              options={options.formats}
              value={value.formats}
              onChange={(next) => set("formats", next)}
              placeholder={t("pick_formats")}
              emptyText={t("no_formats")}
            />
          </FormField>

          <FormField
            label={t("audience")}
            htmlFor="matrix-persona"
            labelAction={
              <InfoHint title={t("audience")} align="end">
                {t("audience_description")}
              </InfoHint>
            }
          >
            <PersonaSelect
              id="matrix-persona"
              allowNone
              noneLabel={t("all_personas")}
              placeholder={t("all_personas")}
              value={value.personaId}
              onChange={onPersonaChange}
            />
          </FormField>

          <FormField
            label={t("audience_problems")}
            htmlFor="matrix-problems"
            labelAction={<SelectAll selected={counts.problems} all={options.problems} onSelect={(ids) => set("problems", ids)} />}
          >
            <MultiSelect
              id="matrix-problems"
              options={options.problems}
              value={value.problems}
              onChange={(next) => set("problems", next)}
              placeholder={t("pick_problems")}
              maxChips={2}
              emptyText={value.personaId ? t("no_persona_problems") : t("problem_bank_empty")}
            />
          </FormField>

          <FormField
            label={t("goals")}
            htmlFor="matrix-goals"
            labelAction={<SelectAll selected={value.goals.length} all={options.goals} onSelect={(ids) => set("goals", ids)} />}
          >
            <MultiSelect
              id="matrix-goals"
              options={options.goals}
              value={value.goals}
              onChange={(next) => set("goals", next)}
              placeholder={t("pick_goals")}
              emptyText={t("no_active_goals")}
            />
          </FormField>

          <FormField label={t("funnel_stages")}>
            <ChipToggleGroup
              multiple
              options={STAGE_OPTIONS}
              value={value.stages}
              onChange={(next) => set("stages", next)}
              aria-label={t("funnel_stages")}
            />
          </FormField>
        </div>
      </Disclosure>
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
  const c = useT(commonMessages)
  if (!all.length || selected >= all.length) return null
  return (
    <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => onSelect(all.map((o) => o.value))}>
      {c("select_all")}
    </Button>
  )
}
