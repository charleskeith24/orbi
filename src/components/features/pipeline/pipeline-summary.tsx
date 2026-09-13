"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { Meter, StageIcon, StatusPill } from "@/components/common"
import type { BufferStatus, ContentBuffer, PipelineCounts } from "@/lib/analytics"
import type { PipelineStage } from "@/lib/types"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import { firstStageOfGroup } from "./board-model"

const BUFFER_TONE: Record<BufferStatus, "good" | "warning" | "critical"> = {
  healthy: "good",
  ok: "warning",
  low: "critical",
}

const CELL =
  "flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted/50"

const formatDays = (days: number) => (Number.isInteger(days) ? formatNumber(days) : days.toFixed(1))

/** Header roll-up: items per stage group and the Content Buffer (spec §55). */
export function PipelineSummary({
  counts,
  buffer,
  onJump,
}: {
  counts: PipelineCounts
  buffer: ContentBuffer
  onJump: (stage: PipelineStage) => void
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <StageGroups counts={counts} onJump={onJump} />
      <BufferPanel buffer={buffer} onJump={onJump} />
    </div>
  )
}

function StageGroups({ counts, onJump }: { counts: PipelineCounts; onJump: (stage: PipelineStage) => void }) {
  const last = counts.groupList.length - 1
  return (
    <section aria-labelledby="pipeline-groups-title" className="flex min-w-0 flex-col rounded-lg border bg-card">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <h2 id="pipeline-groups-title" className="text-xs font-medium text-muted-foreground">
          Stage groups
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground num">{formatNumber(counts.inProgress)}</span> in progress
        </p>
      </div>
      <ol className="grid flex-1 grid-cols-4 content-center gap-x-1 gap-y-0.5 p-2 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
        {counts.groupList.map((group, index) => {
          const stage = firstStageOfGroup(group.id)
          const published = group.id === "published"
          return (
            <li key={group.id} className="relative min-w-0">
              <button
                type="button"
                onClick={() => onJump(stage)}
                title={published ? `Published in the last ${counts.publishedWindowDays} days` : `Show ${group.label} on the board`}
                className={cn(CELL, "w-full")}
              >
                <span className="truncate text-xs text-muted-foreground">{group.label}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <StageIcon stage={stage} />
                  <span
                    className={cn(
                      "text-xl leading-7 font-semibold tracking-tight num",
                      group.count === 0 && "text-muted-foreground"
                    )}
                  >
                    {formatNumber(group.count)}
                  </span>
                  {published ? (
                    <span className="-ml-0.5 text-[11px] text-muted-foreground">{counts.publishedWindowDays}d</span>
                  ) : null}
                </span>
              </button>
              {index < last ? (
                <ChevronRight
                  className="pointer-events-none absolute top-1/2 -right-1.5 hidden size-3 -translate-y-1/2 text-muted-foreground/50 sm:block lg:hidden xl:block"
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

type BufferCell = { key: string; label: string; value: number; title: string } & (
  | { href: string }
  | { stage: PipelineStage }
)

function BufferPanel({ buffer, onJump }: { buffer: ContentBuffer; onJump: (stage: PipelineStage) => void }) {
  const tone = BUFFER_TONE[buffer.status]
  const days = formatDays(buffer.days)
  const hint =
    buffer.status === "low"
      ? `under your ${buffer.warningDays}-day warning line`
      : buffer.status === "ok"
        ? `below your ${buffer.targetDays}-day target`
        : `target ${buffer.targetDays} days`
  const cells: BufferCell[] = [
    { key: "ideas", label: "Ready Ideas", value: buffer.breakdown.readyIdeas, href: "/ideas", title: "Validated or selected ideas in the Idea Bank" },
    { key: "scripts", label: "Ready Scripts", value: buffer.breakdown.readyScripts, stage: "scripting", title: "Written scripts plus Ready for Production" },
    { key: "record", label: "Ready to Record", value: buffer.breakdown.readyToRecord, stage: "ready_for_production", title: "Ready for Production" },
    { key: "edited", label: "Edited Content", value: buffer.breakdown.edited, stage: "editing", title: "Editing, Review and Revision" },
    { key: "publish", label: "Ready to Publish", value: buffer.breakdown.readyToPublish, stage: "ready_to_post", title: "Ready to Post plus upcoming Scheduled posts" },
  ]

  return (
    <section aria-labelledby="pipeline-buffer-title" className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-4 pt-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pipeline-buffer-title" className="text-xs font-medium text-muted-foreground">
          Content Buffer
        </h2>
        <StatusPill tone={tone}>{buffer.label}</StatusPill>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <p className="shrink-0 leading-7">
          <span className="text-2xl font-semibold tracking-tight num">{days}</span>{" "}
          <span className="text-sm text-muted-foreground">{buffer.days === 1 ? "day" : "days"}</span>
        </p>
        <div className="min-w-0 flex-1">
          <Meter
            value={buffer.days}
            max={Math.max(buffer.targetDays * 2, buffer.days, 1)}
            target={buffer.targetDays}
            tone={tone}
            size="sm"
            aria-label="Content buffer"
            valueText={`${days} of ${buffer.targetDays} days`}
          />
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {pluralize(buffer.readyCount, "post")} ready to go live · {hint}
          </p>
        </div>
      </div>
      <div className="-mx-2 grid grid-cols-5 gap-0.5">
        {cells.map((cell) => {
          const body = (
            <>
              <span className="text-sm font-medium num">{formatNumber(cell.value)}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{cell.label}</span>
            </>
          )
          return "href" in cell ? (
            <Link key={cell.key} href={cell.href} title={cell.title} className={CELL}>
              {body}
            </Link>
          ) : (
            <button key={cell.key} type="button" title={cell.title} onClick={() => onJump(cell.stage)} className={CELL}>
              {body}
            </button>
          )
        })}
      </div>
    </section>
  )
}
