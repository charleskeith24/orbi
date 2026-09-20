"use client"

import { formatDistanceStrict } from "date-fns"
import { Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DataTable,
  EmptyState,
  FacetFilter,
  FilterBar,
  ProviderBadge,
  ResetFiltersButton,
  SectionCard,
  StatusPill,
  useConfirm,
  type DataTableColumn,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import type { AiTaskName } from "@/lib/ai"
import { formatDateTime, parseDate } from "@/lib/dates"
import { useT, type Translator } from "@/lib/i18n"
import { dataActions, useDb, useTable } from "@/lib/store"
import type { AiGeneration, Database } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { aiMessages } from "./ai-messages"

type AiT = Translator<(typeof aiMessages)["en"]>
type AiKey = keyof (typeof aiMessages)["en"] & string

/** Product names (ARCHITECTURE §9) stay English; the rest are message keys. */
const TASK_LABELS: Partial<Record<AiTaskName, string | { key: AiKey }>> = {
  capture_idea: "Quick Capture",
  generate_ideas: "Idea Generator",
  generate_hooks: { key: "task_hook_generation" },
  score_idea: "Idea Score",
  content_brief: "Content Brief",
  generate_script: "Script",
  score_content: "Content Score",
  repurpose: { key: "task_repurpose" },
  experience_to_content: "Experience → Content",
  analyze_reference: { key: "task_analyze_reference" },
  adapt_reference: "Inspiration → Original",
  what_to_post: { key: "task_what_to_post" },
  winner_replication: { key: "task_winner_replication" },
  weekly_review: "Weekly Report",
  monthly_review: "Monthly Review",
  weekly_plan: "Weekly Planner",
  strategist_chat: "Content Strategist",
  onboarding_strategy: { key: "task_onboarding_strategy" },
  niche_discovery: "Niche Discovery",
  collab_ideas: { key: "task_collab_ideas" },
  collab_pitch: { key: "task_collab_pitch" },
}

export function taskLabel(task: string, t: AiT): string {
  const label = TASK_LABELS[task as AiTaskName]
  if (label) return typeof label === "string" ? label : t(label.key)
  const words = task.replace(/_/g, " ").trim()
  return words ? words[0].toUpperCase() + words.slice(1) : t("unknown_task")
}

/** Where a logged generation's record lives (only when the record still exists). */
function entityLink(db: Database, row: AiGeneration, t: AiT): { href: string; label: string } | null {
  const id = row.entity_id
  if (!id || !row.entity_type) return null
  switch (row.entity_type) {
    case "content_items": {
      const item = db.content_items.find((i) => i.id === id)
      return item ? { href: `/studio/${id}`, label: item.title || t("entity_item") } : null
    }
    case "content_ideas": {
      const idea = db.content_ideas.find((i) => i.id === id)
      return idea ? { href: `/ideas?open=${id}`, label: idea.title || t("entity_idea") } : null
    }
    case "stories": {
      const story = db.stories.find((s) => s.id === id)
      return story ? { href: `/stories?open=${id}`, label: story.title || t("entity_story") } : null
    }
    case "research_items": {
      const item = db.research_items.find((r) => r.id === id)
      return item ? { href: `/research?open=${id}`, label: item.title || t("entity_reference") } : null
    }
    case "content_campaigns": {
      const campaign = db.content_campaigns.find((c) => c.id === id)
      return campaign ? { href: `/campaigns/${id}`, label: campaign.name || t("entity_campaign") } : null
    }
    case "collabs": {
      const collab = db.collabs.find((c) => c.id === id)
      return collab ? { href: `/collabs?open=${id}`, label: collab.title || t("entity_collab") } : null
    }
    default:
      return null
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—"
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** Every AI call the workspace made: task, engine, timing and outcome, with "Clear log". */
export function AiLog({ now }: { now: Date }) {
  const db = useDb()
  const generations = useTable("ai_generations")
  const [confirm, confirmDialog] = useConfirm()
  const t = useT(aiMessages)
  const count = (key: Parameters<AiT["plural"]>[0], n: number) => t.plural(key, n, { count: formatNumber(n) })
  const [statuses, setStatuses] = useState<string[]>([])
  const [tasks, setTasks] = useState<string[]>([])

  const sorted = useMemo(() => [...generations].sort((a, b) => b.created_at.localeCompare(a.created_at)), [generations])
  const filtered = sorted.filter((g) => (!statuses.length || statuses.includes(g.status)) && (!tasks.length || tasks.includes(g.task)))

  const stats = useMemo(() => {
    const ok = generations.filter((g) => g.status === "success")
    const timed = ok.map((g) => g.duration_ms).filter((d): d is number => typeof d === "number" && Number.isFinite(d))
    return {
      success: ok.length,
      errors: generations.length - ok.length,
      avgMs: timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : null,
      live: generations.filter((g) => g.provider !== "offline").length,
    }
  }, [generations])

  const taskOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of generations) counts.set(g.task, (counts.get(g.task) ?? 0) + 1)
    return [...counts.entries()]
      .map(([value, count]) => ({ value, label: taskLabel(value, t), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [generations, t])
  const statusOptions = [
    { value: "success", label: t("status_success"), count: stats.success },
    { value: "error", label: t("status_error"), count: stats.errors },
  ]

  async function clearLog() {
    const total = generations.length
    const ok = await confirm({
      title: t("clear_title"),
      description: t("clear_description", { records: count("generation_records", total) }),
      confirmLabel: t("clear_action"),
    })
    if (!ok) return
    dataActions.remove(
      "ai_generations",
      generations.map((g) => g.id)
    )
    setStatuses([])
    setTasks([])
    toast.success(t("cleared"), { description: t("cleared_description", { records: count("records", total) }) })
  }

  const columns: DataTableColumn<AiGeneration>[] = [
    {
      id: "when",
      header: t("col_when"),
      sortValue: (g) => g.created_at,
      cell: (g) => {
        const at = parseDate(g.created_at)
        return (
          <span className="whitespace-nowrap text-muted-foreground" title={formatDateTime(g.created_at)}>
            {at ? (at.getTime() >= now.getTime() ? t("just_now_title") : formatDistanceStrict(at, now, { addSuffix: true })) : "—"}
          </span>
        )
      },
    },
    {
      id: "task",
      header: t("col_task"),
      sortValue: (g) => taskLabel(g.task, t),
      cell: (g) => {
        const link = entityLink(db, g, t)
        return (
          <div className="min-w-0">
            <p className="font-medium whitespace-nowrap">{taskLabel(g.task, t)}</p>
            {link ? (
              <Link
                href={link.href}
                className="block max-w-[16rem] truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            ) : null}
          </div>
        )
      },
    },
    {
      id: "engine",
      header: t("col_engine"),
      hideBelow: "sm",
      sortValue: (g) => g.provider,
      cell: (g) => <ProviderBadge provider={g.provider} model={g.model || undefined} />,
    },
    {
      id: "duration",
      header: t("col_duration"),
      align: "right",
      hideBelow: "md",
      sortValue: (g) => g.duration_ms,
      cell: (g) => formatDuration(g.duration_ms),
    },
    {
      id: "status",
      header: t("col_status"),
      sortValue: (g) => g.status,
      cell: (g) =>
        g.status === "success" ? (
          <StatusPill tone="good">{t("status_success")}</StatusPill>
        ) : (
          <StatusPill tone="critical" title={g.error ?? undefined} className="max-w-[14rem]">
            {g.error ? t("error_detail", { message: g.error }) : t("status_error")}
          </StatusPill>
        ),
    },
  ]

  const filtering = Boolean(statuses.length || tasks.length)

  return (
    <SectionCard
      title={t("log_title")}
      info={t("log_info")}
      description={
        generations.length
          ? t("log_summary", {
              summary: [
                count("generations", generations.length),
                stats.errors ? count("errors", stats.errors) : "",
                stats.avgMs !== null ? t("avg", { duration: formatDuration(stats.avgMs) }) : t("no_timings"),
                stats.live ? t("by_claude", { count: formatNumber(stats.live) }) : t("all_offline"),
              ]
                .filter(Boolean)
                .join(" · "),
            })
          : undefined
      }
      action={
        generations.length ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void clearLog()}>
            <Trash2 aria-hidden />
            {t("clear_action")}
          </Button>
        ) : undefined
      }
      contentClassName={generations.length ? "flex flex-col gap-3" : undefined}
    >
      {generations.length ? (
        <>
          <FilterBar
            actions={
              <span className="text-xs text-muted-foreground num">
                {filtered.length === sorted.length ? count("records", sorted.length) : t("filtered", { shown: filtered.length, total: sorted.length })}
              </span>
            }
          >
            <FacetFilter title={t("col_task")} options={taskOptions} value={tasks} onChange={setTasks} />
            <FacetFilter title={t("col_status")} options={statusOptions} value={statuses} onChange={setStatuses} />
            <ResetFiltersButton
              show={filtering}
              onClick={() => {
                setStatuses([])
                setTasks([])
              }}
            />
          </FilterBar>
          <DataTable
            rows={filtered}
            columns={columns}
            getRowId={(g) => g.id}
            dense
            pageSize={15}
            aria-label={t("table_aria")}
            defaultSort={{ id: "when", desc: true }}
            empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("no_match")}</p>}
          />
        </>
      ) : (
        <EmptyState
          compact
          icon={Sparkles}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/ideas/generator">{t("open_generator")}</Link>
            </Button>
          }
        />
      )}
      {confirmDialog}
    </SectionCard>
  )
}
