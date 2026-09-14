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
import { dataActions, useDb, useTable } from "@/lib/store"
import type { AiGeneration, Database } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"

const TASK_LABELS: Partial<Record<AiTaskName, string>> = {
  capture_idea: "Quick Capture",
  generate_ideas: "Idea Generator",
  generate_hooks: "Hook generation",
  score_idea: "Idea Score",
  content_brief: "Content Brief",
  generate_script: "Script",
  score_content: "Content Score",
  repurpose: "Repurposing",
  experience_to_content: "Experience → Content",
  analyze_reference: "Reference analysis",
  adapt_reference: "Inspiration → Original",
  what_to_post: "What to post",
  winner_replication: "Winner replication",
  weekly_review: "Weekly Report",
  monthly_review: "Monthly Review",
  weekly_plan: "Weekly Planner",
  strategist_chat: "Content Strategist",
  onboarding_strategy: "Onboarding strategy",
  niche_discovery: "Niche Discovery",
}

export function taskLabel(task: string): string {
  const label = TASK_LABELS[task as AiTaskName]
  if (label) return label
  const words = task.replace(/_/g, " ").trim()
  return words ? words[0].toUpperCase() + words.slice(1) : "Unknown task"
}

/** Where a logged generation's record lives (only when the record still exists). */
function entityLink(db: Database, row: AiGeneration): { href: string; label: string } | null {
  const id = row.entity_id
  if (!id || !row.entity_type) return null
  switch (row.entity_type) {
    case "content_items": {
      const item = db.content_items.find((i) => i.id === id)
      return item ? { href: `/studio/${id}`, label: item.title || "Content item" } : null
    }
    case "content_ideas": {
      const idea = db.content_ideas.find((i) => i.id === id)
      return idea ? { href: `/ideas?open=${id}`, label: idea.title || "Idea" } : null
    }
    case "stories": {
      const story = db.stories.find((s) => s.id === id)
      return story ? { href: `/stories?open=${id}`, label: story.title || "Story" } : null
    }
    case "research_items": {
      const item = db.research_items.find((r) => r.id === id)
      return item ? { href: `/research?open=${id}`, label: item.title || "Reference" } : null
    }
    case "content_campaigns": {
      const campaign = db.content_campaigns.find((c) => c.id === id)
      return campaign ? { href: `/campaigns/${id}`, label: campaign.name || "Campaign" } : null
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
      .map(([value, count]) => ({ value, label: taskLabel(value), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [generations])
  const statusOptions = [
    { value: "success", label: "Success", count: stats.success },
    { value: "error", label: "Error", count: stats.errors },
  ]

  async function clearLog() {
    const count = generations.length
    const ok = await confirm({
      title: "Clear the AI log?",
      description: `Deletes all ${pluralize(count, "generation record")} — including the Content Strategist conversation and the Idea Generator results you could restore. Anything you already saved from AI output stays.`,
      confirmLabel: "Clear log",
    })
    if (!ok) return
    dataActions.remove(
      "ai_generations",
      generations.map((g) => g.id)
    )
    setStatuses([])
    setTasks([])
    toast.success("AI log cleared", { description: `${pluralize(count, "record")} deleted` })
  }

  const columns: DataTableColumn<AiGeneration>[] = [
    {
      id: "when",
      header: "When",
      sortValue: (g) => g.created_at,
      cell: (g) => {
        const at = parseDate(g.created_at)
        return (
          <span className="whitespace-nowrap text-muted-foreground" title={formatDateTime(g.created_at)}>
            {at ? (at.getTime() >= now.getTime() ? "Just now" : formatDistanceStrict(at, now, { addSuffix: true })) : "—"}
          </span>
        )
      },
    },
    {
      id: "task",
      header: "Task",
      sortValue: (g) => taskLabel(g.task),
      cell: (g) => {
        const link = entityLink(db, g)
        return (
          <div className="min-w-0">
            <p className="font-medium whitespace-nowrap">{taskLabel(g.task)}</p>
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
      header: "Engine",
      hideBelow: "sm",
      sortValue: (g) => g.provider,
      cell: (g) => <ProviderBadge provider={g.provider} model={g.model || undefined} />,
    },
    {
      id: "duration",
      header: "Duration",
      align: "right",
      hideBelow: "md",
      sortValue: (g) => g.duration_ms,
      cell: (g) => formatDuration(g.duration_ms),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (g) => g.status,
      cell: (g) =>
        g.status === "success" ? (
          <StatusPill tone="good">Success</StatusPill>
        ) : (
          <StatusPill tone="critical" title={g.error ?? undefined} className="max-w-[14rem]">
            {g.error ? `Error · ${g.error}` : "Error"}
          </StatusPill>
        ),
    },
  ]

  const filtering = Boolean(statuses.length || tasks.length)

  return (
    <SectionCard
      title="Recent generations"
      description={
        generations.length
          ? `${pluralize(generations.length, "generation")} · ${stats.errors ? `${pluralize(stats.errors, "error")} · ` : ""}${
              stats.avgMs !== null ? `avg ${formatDuration(stats.avgMs)}` : "no timings"
            } · ${stats.live ? `${formatNumber(stats.live)} by Claude` : "all by offline templates"}. The newest 200 are kept.`
          : "Every AI action is logged here with its engine, timing and outcome."
      }
      action={
        generations.length ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void clearLog()}>
            <Trash2 aria-hidden />
            Clear log
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
                {filtered.length === sorted.length ? pluralize(sorted.length, "record") : `${filtered.length} of ${sorted.length}`}
              </span>
            }
          >
            <FacetFilter title="Task" options={taskOptions} value={tasks} onChange={setTasks} />
            <FacetFilter title="Status" options={statusOptions} value={statuses} onChange={setStatuses} />
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
            aria-label="AI generations"
            defaultSort={{ id: "when", desc: true }}
            empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">No generations match these filters.</p>}
          />
        </>
      ) : (
        <EmptyState
          compact
          icon={Sparkles}
          title="No AI generations yet"
          description="Briefs, scripts, scores and ideas the AI writes for you are logged here with the engine that produced them."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/ideas/generator">Open the Idea Generator</Link>
            </Button>
          }
        />
      )}
      {confirmDialog}
    </SectionCard>
  )
}
