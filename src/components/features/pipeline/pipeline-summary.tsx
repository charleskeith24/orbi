"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { InfoHint, Meter, StageIcon, StatusPill } from "@/components/common"
import type { BufferStatus, ContentBuffer, PipelineCounts } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import type { PipelineStage } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { firstStageOfGroup } from "./board-model"
import { pipelineMessages } from "./messages"

const BUFFER_TONE: Record<BufferStatus, "good" | "warning" | "critical"> = {
  healthy: "good",
  ok: "warning",
  low: "critical",
}

const formatDays = (days: number) => (Number.isInteger(days) ? formatNumber(days) : days.toFixed(1))

/**
 * The flow at a glance (Calm UI): Idea → … → Published with each group's count, one quiet row. A click jumps to
 * that group's first column. Desktop only — phones pick a stage in the board itself.
 */
export function StageRail({ counts, onJump, className }: { counts: PipelineCounts; onJump: (stage: PipelineStage) => void; className?: string }) {
  const t = useT(pipelineMessages)
  const last = counts.groupList.length - 1
  return (
    <nav aria-label={t("stages_aria")} className={cn("scrollbar-none -mx-1 min-w-0 overflow-x-auto", className)}>
      <ol className="flex w-max items-center">
        {counts.groupList.map((group, index) => {
          const stage = firstStageOfGroup(group.id)
          const published = group.id === "published"
          return (
            <li key={group.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onJump(stage)}
                aria-label={`${group.label} ${formatNumber(group.count)}`}
                title={published ? t("published_window", { days: counts.publishedWindowDays }) : t("show_group", { group: group.label })}
                className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <StageIcon stage={stage} />
                <span>{group.label}</span>
                <span className={cn("font-medium num", group.count ? "text-foreground" : "text-muted-foreground")}>{formatNumber(group.count)}</span>
              </button>
              {index < last ? <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" aria-hidden /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

type BufferCell = { key: string; label: string; value: number; title: string } & ({ href: string } | { stage: PipelineStage })

/**
 * Content Buffer as one inline stat — days, status — with the breakdown (what's ready at each step, the target and
 * the warning line) behind its ⓘ.
 */
export function BufferStat({
  buffer,
  empty = false,
  onJump,
}: {
  buffer: ContentBuffer
  /** No content in the workspace yet: the buffer is neutral, not an alarm. */
  empty?: boolean
  onJump: (stage: PipelineStage) => void
}) {
  const t = useT(pipelineMessages)
  const tone = empty ? "neutral" : BUFFER_TONE[buffer.status]
  const days = formatDays(buffer.days)
  const hint = empty
    ? t("buffer_hint_empty", { days: buffer.targetDays })
    : buffer.status === "low"
      ? t("buffer_hint_low", { days: buffer.warningDays })
      : buffer.status === "ok"
        ? t("buffer_hint_ok", { days: buffer.targetDays })
        : t("buffer_hint_healthy", { days: buffer.targetDays })
  const cells: BufferCell[] = [
    { key: "publish", label: t("cell_publish"), value: buffer.breakdown.readyToPublish, stage: "ready_to_post", title: t("cell_publish_title") },
    { key: "edited", label: t("cell_edited"), value: buffer.breakdown.edited, stage: "editing", title: t("cell_edited_title") },
    { key: "record", label: t("cell_record"), value: buffer.breakdown.readyToRecord, stage: "ready_for_production", title: t("cell_record_title") },
    { key: "scripts", label: t("cell_scripts"), value: buffer.breakdown.readyScripts, stage: "scripting", title: t("cell_scripts_title") },
    { key: "ideas", label: t("cell_ideas"), value: buffer.breakdown.readyIdeas, href: "/ideas", title: t("cell_ideas_title") },
  ]
  const row = "flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("content_buffer")}</span>
      <span className="text-sm leading-5 whitespace-nowrap">
        <span className="font-semibold num">{days}</span> <span className="text-xs text-muted-foreground">{buffer.days === 1 ? t("day") : t("days")}</span>
      </span>
      <StatusPill tone={tone}>{empty ? t("empty_short") : buffer.label}</StatusPill>
      <InfoHint title={t("content_buffer")} align="end">
        <p>
          {t.plural("posts_ready", buffer.readyCount, { count: formatNumber(buffer.readyCount) })} · {hint}
        </p>
        <Meter
          value={buffer.days}
          max={Math.max(buffer.targetDays * 2, buffer.days, 1)}
          target={buffer.targetDays}
          tone={tone}
          size="sm"
          aria-label={t("buffer_aria")}
          valueText={t("buffer_value", { days, target: buffer.targetDays })}
          className="my-1"
        />
        <ul className="-mx-1.5 flex flex-col text-foreground">
          {cells.map((cell) => {
            const body = (
              <>
                <span className="text-muted-foreground">{cell.label}</span>
                <span className="font-medium num">{formatNumber(cell.value)}</span>
              </>
            )
            return (
              <li key={cell.key}>
                {"href" in cell ? (
                  <Link href={cell.href} title={cell.title} className={row}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" title={cell.title} onClick={() => onJump(cell.stage)} className={row}>
                    {body}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </InfoHint>
    </div>
  )
}
