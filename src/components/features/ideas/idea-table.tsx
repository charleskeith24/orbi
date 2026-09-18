"use client"

import { useMemo } from "react"
import {
  DataTable,
  FormatLabel,
  FunnelBadge,
  PersonaBadge,
  PillarBadge,
  PriorityBadge,
  type DataTableColumn,
  type DataTableSort,
} from "@/components/common"
import { useT, type Translator } from "@/lib/i18n"
import type { AudiencePersona, ContentFormat, ContentGoal, ContentIdea, ContentPillar, ID } from "@/lib/types"
import { IdeaActionsMenu } from "./idea-actions-menu"
import { CapturedDate, IdeaScoreBadge, IdeaStatusChip, PlatformIcons } from "./idea-badges"
import { FUNNEL_RANK, PRIORITY_RANK, STATUS_RANK, type IdeaSort } from "./idea-model"
import { ideaBankMessages } from "./messages"

export interface IdeaLookups {
  pillars: Map<ID, ContentPillar>
  personas: Map<ID, AudiencePersona>
  formats: Map<ID, ContentFormat>
  goals: Map<ID, ContentGoal>
}

/**
 * Columns appear as the table's own width allows (container queries on the table frame), so the
 * table fits without horizontal scrolling next to the sidebar and grows columns on wide screens.
 */
const SHOW_FROM = {
  md: "hidden @md:table-cell",
  "2xl": "hidden @2xl:table-cell",
  "3xl": "hidden @3xl:table-cell",
  "4xl": "hidden @4xl:table-cell",
  "5xl": "hidden @5xl:table-cell",
  "6xl": "hidden @6xl:table-cell",
  "7xl": "hidden @7xl:table-cell",
} as const

const tier = (breakpoint: keyof typeof SHOW_FROM) => ({ className: SHOW_FROM[breakpoint], headerClassName: SHOW_FROM[breakpoint] })

const DEFAULT_SORTS: Record<IdeaSort, DataTableSort> = {
  score: { id: "score", desc: true },
  created: { id: "created", desc: true },
  priority: { id: "priority", desc: true },
}

const Dash = () => <span className="text-xs text-muted-foreground">—</span>

type IdeaBankT = Translator<(typeof ideaBankMessages)["en"]>

function buildColumns(lookups: IdeaLookups, now: Date, t: IdeaBankT): DataTableColumn<ContentIdea>[] {
  const { pillars, personas, formats, goals } = lookups
  return [
    {
      id: "title",
      header: "Idea",
      className: "w-full max-w-0",
      headerClassName: "w-full",
      sortValue: (idea) => idea.title.toLowerCase(),
      cell: (idea) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium" title={idea.title.length > 60 ? idea.title : undefined}>
            {idea.title || t("untitled_idea")}
          </span>
          {idea.hook ? (
            <span className="truncate text-xs text-muted-foreground" title={idea.hook.length > 70 ? idea.hook : undefined}>
              {idea.hook}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "pillar",
      header: "Pillar",
      ...tier("3xl"),
      sortValue: (idea) => (idea.pillar_id ? (pillars.get(idea.pillar_id)?.name ?? null) : null),
      cell: (idea) => {
        const pillar = idea.pillar_id ? pillars.get(idea.pillar_id) : undefined
        return pillar ? <PillarBadge pillar={pillar} variant="plain" className="max-w-36" /> : <Dash />
      },
    },
    {
      id: "persona",
      header: "Persona",
      ...tier("4xl"),
      sortValue: (idea) => (idea.persona_id ? (personas.get(idea.persona_id)?.name ?? null) : null),
      cell: (idea) => {
        const persona = idea.persona_id ? personas.get(idea.persona_id) : undefined
        return persona ? (
          <span title={persona.name} className="inline-flex max-w-36">
            <PersonaBadge persona={persona} variant="plain" className="max-w-full" />
          </span>
        ) : (
          <Dash />
        )
      },
    },
    {
      id: "platforms",
      header: "Platforms",
      ...tier("5xl"),
      sortValue: (idea) => idea.platforms.length || null,
      cell: (idea) => <PlatformIcons platforms={idea.platforms} />,
    },
    {
      id: "format",
      header: "Format",
      ...tier("7xl"),
      sortValue: (idea) => (idea.format_id ? (formats.get(idea.format_id)?.name ?? null) : null),
      cell: (idea) => {
        const format = idea.format_id ? formats.get(idea.format_id) : undefined
        return format ? <FormatLabel format={format} className="max-w-36" /> : <Dash />
      },
    },
    {
      id: "goal",
      header: "Goal",
      ...tier("7xl"),
      sortValue: (idea) => (idea.goal_id ? (goals.get(idea.goal_id)?.name ?? null) : null),
      cell: (idea) => {
        const goal = idea.goal_id ? goals.get(idea.goal_id) : undefined
        return goal ? (
          <span className="block max-w-32 truncate text-xs text-muted-foreground" title={goal.name}>
            {goal.name}
          </span>
        ) : (
          <Dash />
        )
      },
    },
    {
      id: "funnel",
      header: "Funnel",
      ...tier("5xl"),
      sortValue: (idea) => (idea.funnel_stage ? FUNNEL_RANK[idea.funnel_stage] : null),
      cell: (idea) => (idea.funnel_stage ? <FunnelBadge stage={idea.funnel_stage} /> : <Dash />),
    },
    {
      id: "priority",
      header: "Priority",
      ...tier("2xl"),
      sortValue: (idea) => PRIORITY_RANK[idea.priority],
      cell: (idea) => <PriorityBadge priority={idea.priority} />,
    },
    {
      id: "status",
      header: "Status",
      ...tier("md"),
      sortValue: (idea) => STATUS_RANK[idea.status],
      cell: (idea) => <IdeaStatusChip status={idea.status} />,
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: (idea) => idea.score,
      cell: (idea) => <IdeaScoreBadge score={idea.score} />,
    },
    {
      id: "created",
      header: t("col_captured"),
      ...tier("6xl"),
      sortValue: (idea) => idea.created_at,
      cell: (idea) => <CapturedDate value={idea.created_at} now={now} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("col_actions")}</span>,
      className: "w-10",
      cell: (idea) => <IdeaActionsMenu idea={idea} />,
    },
  ]
}

/** Table view: selectable rows (bulk actions), sortable headers, rows open the detail sheet. */
export function IdeaTable({
  ideas,
  sort,
  lookups,
  now,
  selectedIds,
  onSelectionChange,
  onOpen,
  empty,
}: {
  ideas: ContentIdea[]
  sort: IdeaSort
  lookups: IdeaLookups
  now: Date
  selectedIds: ID[]
  onSelectionChange: (ids: ID[]) => void
  onOpen: (id: ID) => void
  empty: React.ReactNode
}) {
  const t = useT(ideaBankMessages)
  const columns = useMemo(() => buildColumns(lookups, now, t), [lookups, now, t])
  return (
    <DataTable
      // Re-mount when the sort control changes so the header arrow follows it.
      key={sort}
      aria-label={t("ideas")}
      className="@container"
      rows={ideas}
      columns={columns}
      getRowId={(idea) => idea.id}
      rowLabel={(idea) => idea.title || t("untitled_idea")}
      onRowClick={(idea) => onOpen(idea.id)}
      defaultSort={DEFAULT_SORTS[sort]}
      rowClassName={(idea) => (idea.status === "archived" ? "text-muted-foreground" : undefined)}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      pageSize={50}
      empty={empty}
    />
  )
}
