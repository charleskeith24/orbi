"use client"

import { RotateCcw, Upload, X } from "lucide-react"
import { useMemo, useState } from "react"
import {
  ChipToggleGroup,
  DataTable,
  OptionSelect,
  PlatformIcon,
  StatusPill,
  type DataTableColumn,
  type StatusTone,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { METRIC_FIELDS, PLATFORMS } from "@/lib/constants"
import { formatDate, formatShortDate } from "@/lib/dates"
import type { ImportCandidate, ImportSummary, PlannedImportRow, RowMatchStatus } from "@/lib/integrations"
import type { ID, ISODate } from "@/lib/types"
import { formatNumber, pluralize, truncate } from "@/lib/utils"

type Group = "ready" | "attention" | "skipped"
type Filter = "all" | Group

const STATUS_META: Record<RowMatchStatus, { label: string; tone: StatusTone; group: Group }> = {
  matched: { label: "Ready", tone: "good", group: "ready" },
  ambiguous: { label: "Choose a post", tone: "warning", group: "attention" },
  unmatched: { label: "Not found", tone: "neutral", group: "attention" },
  unpublished: { label: "Not published", tone: "neutral", group: "attention" },
  duplicate: { label: "Duplicate", tone: "neutral", group: "skipped" },
  no_values: { label: "No values", tone: "neutral", group: "skipped" },
  no_key: { label: "Nothing to match", tone: "neutral", group: "skipped" },
  skipped: { label: "Skipped", tone: "neutral", group: "skipped" },
}

const METRIC_LABEL = Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.label.toLowerCase()])) as Record<string, string>

function candidateLabel(c: ImportCandidate): string {
  return `${PLATFORMS[c.platform].label} · ${c.publishedAt ? formatShortDate(c.publishedAt) : "—"} · ${truncate(c.title || "Untitled", 48)}`
}

/** Step 3: every row with its match, manual fixes for ambiguous / missing ones, then import. */
export function CsvReview({
  plan,
  summary,
  candidates,
  overrides,
  onOverride,
  recordedOn,
  onBack,
  onImport,
}: {
  plan: PlannedImportRow[]
  summary: ImportSummary
  candidates: ImportCandidate[]
  overrides: ReadonlyMap<number, ID | null>
  onOverride: (rowIndex: number, itemId: ID | null | undefined) => void
  recordedOn: ISODate
  onBack: () => void
  onImport: () => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const published = useMemo(
    () =>
      candidates
        .filter((c) => c.published)
        .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)),
    [candidates]
  )

  const counts = { ready: 0, attention: 0, skipped: 0 }
  for (const { match } of plan) counts[STATUS_META[match.status].group]++
  const rows = filter === "all" ? plan : plan.filter((p) => STATUS_META[p.match.status].group === filter)

  const filterOptions = [
    { value: "all" as const, label: `All ${summary.total}` },
    { value: "ready" as const, label: `Ready ${counts.ready}` },
    { value: "attention" as const, label: `Needs attention ${counts.attention}` },
    { value: "skipped" as const, label: `Skipped ${counts.skipped}` },
  ]

  const columns: DataTableColumn<PlannedImportRow>[] = [
    { id: "line", header: "Line", width: 48, sortValue: (p) => p.row.line, cell: (p) => <span className="text-muted-foreground num">{p.row.line}</span> },
    {
      id: "file",
      header: "In the file",
      cell: ({ row }) => {
        const entries = Object.entries(row.metrics)
        const context = [row.platform ? PLATFORMS[row.platform].label : "", row.published ? formatShortDate(row.published) : ""].filter(Boolean)
        return (
          <div className="min-w-0 max-w-[15rem]">
            <p className="truncate" title={row.title || row.url || row.contentId}>
              {row.title || row.url || row.contentId || <span className="text-muted-foreground">Empty</span>}
            </p>
            <p
              className="truncate text-xs text-muted-foreground"
              title={entries.map(([k, v]) => `${METRIC_LABEL[k]} ${formatNumber(v)}`).join(" · ")}
            >
              {[
                ...context,
                entries.length
                  ? `${entries
                      .slice(0, 2)
                      .map(([k, v]) => `${formatNumber(v)} ${METRIC_LABEL[k]}`)
                      .join(" · ")}${entries.length > 2 ? ` +${entries.length - 2}` : ""}`
                  : "no values",
              ].join(" · ")}
            </p>
            {row.invalid.length ? <p className="text-xs text-warning-fg">{pluralize(row.invalid.length, "unreadable value")}</p> : null}
          </div>
        )
      },
    },
    {
      id: "post",
      header: "Matched post",
      className: "whitespace-normal",
      cell: ({ row, match }) => {
        const matched = match.itemId ? byId.get(match.itemId) : undefined
        if ((match.status === "matched" || match.status === "duplicate" || match.status === "no_values") && matched) {
          return (
            <div className="flex min-w-0 max-w-[18rem] items-center gap-2">
              <PlatformIcon platform={matched.platform} className="size-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate" title={matched.title}>
                  {matched.title || "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {matched.publishedAt ? formatShortDate(matched.publishedAt) : ""} · {match.message}
                </p>
              </div>
            </div>
          )
        }
        if (match.status === "ambiguous") {
          return (
            <div className="flex min-w-0 max-w-[18rem] flex-col gap-1">
              <OptionSelect
                size="sm"
                aria-label={`Choose the post for line ${row.line}`}
                placeholder="Choose the post…"
                value={null}
                options={match.candidateIds
                  .map((id) => byId.get(id))
                  .filter((c): c is ImportCandidate => Boolean(c))
                  .map((c) => ({ value: c.id, label: candidateLabel(c), icon: <PlatformIcon platform={c.platform} className="text-muted-foreground" /> }))}
                onChange={(id) => onOverride(row.index, id)}
              />
              <p className="text-xs text-muted-foreground">{match.message}</p>
            </div>
          )
        }
        if (match.status === "unmatched" || match.status === "unpublished") {
          return (
            <div className="flex min-w-0 max-w-[18rem] flex-col items-start gap-1">
              <p className="text-xs text-muted-foreground">{match.message}</p>
              <PostPicker posts={published} onPick={(id) => onOverride(row.index, id)} line={row.line} />
            </div>
          )
        }
        return <span className="text-xs text-muted-foreground">{match.message}</span>
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row, match }) => {
        const meta = STATUS_META[match.status]
        const overridden = overrides.has(row.index)
        return (
          <div className="flex items-center gap-1">
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            {overridden ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Undo choice for line ${row.line}`} onClick={() => onOverride(row.index, undefined)}>
                <RotateCcw aria-hidden />
              </Button>
            ) : match.status === "matched" ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Skip line ${row.line}`} onClick={() => onOverride(row.index, null)}>
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="good">{pluralize(summary.matched, "row")} ready</StatusPill>
        {counts.attention ? <StatusPill tone="warning">{counts.attention} need attention</StatusPill> : null}
        {counts.skipped ? <StatusPill tone="neutral">{counts.skipped} skipped</StatusPill> : null}
      </div>
      <ChipToggleGroup
        required
        size="xs"
        options={filterOptions}
        value={filter}
        onChange={(next) => {
          if (next) setFilter(next)
        }}
        aria-label="Show rows"
      />
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(p) => String(p.row.index)}
        dense
        pageSize={25}
        maxHeight={520}
        stickyHeader
        aria-label="Rows to import"
        empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">No rows in this group.</p>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="max-w-xl text-xs text-pretty text-muted-foreground">
          Snapshots are recorded on {formatDate(recordedOn)}. Metrics that aren&apos;t in the file carry over from each post&apos;s
          latest snapshot, so nothing you logged by hand is wiped.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            Back to columns
          </Button>
          <Button type="button" size="sm" onClick={onImport} disabled={!summary.matched}>
            <Upload aria-hidden />
            Import {pluralize(summary.matched, "snapshot")}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Search every published post and pick the one a row belongs to. */
function PostPicker({ posts, onPick, line }: { posts: ImportCandidate[]; onPick: (id: ID) => void; line: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={`Choose a post for line ${line}`}>
          Choose post
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <Command>
          <CommandInput placeholder="Search published posts…" />
          <CommandList>
            <CommandEmpty>No published post found.</CommandEmpty>
            <CommandGroup>
              {posts.map((post) => (
                <CommandItem
                  key={post.id}
                  value={post.id}
                  keywords={[post.title, PLATFORMS[post.platform].label]}
                  onSelect={() => {
                    onPick(post.id)
                    setOpen(false)
                  }}
                >
                  <PlatformIcon platform={post.platform} className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{post.title || "Untitled"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{post.publishedAt ? formatShortDate(post.publishedAt) : ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
