"use client"

import { Plus, RotateCcw, Upload, X } from "lucide-react"
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
import { useT, type Translator } from "@/lib/i18n"
import type { BootstrapRow, ImportCandidate, ImportSummary, MatchReason, PlannedImportRow, RowMatchStatus } from "@/lib/integrations"
import type { ID, ISODate } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { CsvBootstrap } from "./csv-bootstrap"
import { m, type CsvMessageKey } from "./csv-messages"

type T = Translator<(typeof m)["en"]>
type Group = "ready" | "attention" | "skipped"
type Filter = "all" | Group

const STATUS_META: Record<RowMatchStatus, { label: CsvMessageKey; tone: StatusTone; group: Group }> = {
  matched: { label: "status_ready", tone: "good", group: "ready" },
  ambiguous: { label: "status_choose", tone: "warning", group: "attention" },
  unmatched: { label: "status_not_found", tone: "neutral", group: "attention" },
  unpublished: { label: "status_not_published", tone: "neutral", group: "attention" },
  duplicate: { label: "status_duplicate", tone: "neutral", group: "skipped" },
  no_values: { label: "status_no_values", tone: "neutral", group: "skipped" },
  no_key: { label: "status_nothing", tone: "neutral", group: "skipped" },
  skipped: { label: "status_skipped", tone: "neutral", group: "skipped" },
  totals: { label: "status_totals", tone: "neutral", group: "skipped" },
}

const METRIC_LABEL = Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.label.toLowerCase()])) as Record<string, string>

/** Words for a match reason code (analytics-import.ts). */
export function reasonText(t: T, reason: MatchReason): string {
  switch (reason.code) {
    case "matched":
      return t(`reason_matched_${reason.via}` as const)
    case "ambiguous":
      return t(`reason_ambiguous_${reason.via}` as const, { count: reason.count })
    case "unpublished":
      return t("reason_unpublished", { title: truncate(reason.title || t("untitled"), 60) })
    case "other_platform":
      return t("reason_other_platform", {
        platforms: reason.published.map((p) => PLATFORMS[p].label).join(", "),
        platform: PLATFORMS[reason.platform].label,
      })
    case "no_url_match":
      return t("reason_no_url_match")
    case "no_match":
      return t("reason_no_match")
    case "no_key":
      return t("reason_no_key")
    case "no_values":
      return t(reason.unreadable ? "reason_unreadable" : "reason_no_values")
    case "duplicate":
      return t("reason_duplicate", { line: reason.line })
    case "skipped":
      return t("reason_skipped")
    case "totals":
      return t("reason_totals")
  }
}

function candidateLabel(t: T, c: ImportCandidate): string {
  return `${PLATFORMS[c.platform].label} · ${c.publishedAt ? formatShortDate(c.publishedAt) : "—"} · ${truncate(c.title || t("untitled"), 48)}`
}

/** Step 3: every row with its match, fixes for ambiguous / missing ones, optional new posts, then import. */
export function CsvReview({
  plan,
  summary,
  candidates,
  overrides,
  onOverride,
  bootstrap,
  bootstrapOn,
  onBootstrapChange,
  selected,
  onBootstrapRow,
  onBootstrapAll,
  recordedOn,
  onBack,
  onImport,
}: {
  plan: PlannedImportRow[]
  summary: ImportSummary
  candidates: ImportCandidate[]
  overrides: ReadonlyMap<number, ID | null>
  onOverride: (rowIndex: number, itemId: ID | null | undefined) => void
  bootstrap: BootstrapRow[]
  bootstrapOn: boolean
  onBootstrapChange: (on: boolean) => void
  selected: ReadonlySet<number>
  onBootstrapRow: (rowIndex: number, create: boolean) => void
  onBootstrapAll: (create: boolean) => void
  recordedOn: ISODate
  onBack: () => void
  onImport: () => void
}) {
  const t = useT(m)
  const [filter, setFilter] = useState<Filter>("all")
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const published = useMemo(
    () => candidates.filter((c) => c.published).sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)),
    [candidates]
  )

  const willCreate = (p: PlannedImportRow) => p.match.status === "unmatched" && selected.has(p.row.index)
  const groupOf = (p: PlannedImportRow): Group => (willCreate(p) ? "ready" : STATUS_META[p.match.status].group)
  const counts = { ready: 0, attention: 0, skipped: 0 }
  for (const p of plan) counts[groupOf(p)]++
  const rows = filter === "all" ? plan : plan.filter((p) => groupOf(p) === filter)
  const posts = selected.size
  const snapshots = summary.matched

  const filterOptions = [
    { value: "all" as const, label: t("filter_all", { count: summary.total }) },
    { value: "ready" as const, label: t("filter_ready", { count: counts.ready }) },
    { value: "attention" as const, label: t("filter_attention", { count: counts.attention }) },
    { value: "skipped" as const, label: t("filter_skipped", { count: counts.skipped }) },
  ]

  const columns: DataTableColumn<PlannedImportRow>[] = [
    { id: "line", header: t("col_row"), width: 48, sortValue: (p) => p.row.line, cell: (p) => <span className="text-muted-foreground num">{p.row.line}</span> },
    {
      id: "file",
      header: t("col_file"),
      cell: ({ row }) => {
        const entries = Object.entries(row.metrics)
        const context = [row.platform ? PLATFORMS[row.platform].label : "", row.published ? formatShortDate(row.published) : ""].filter(Boolean)
        const label = row.title || row.url || row.contentId
        return (
          <div className="min-w-0 max-w-[15rem]">
            <p className="truncate" title={label}>
              {label || <span className="text-muted-foreground">{t("empty_cell")}</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground" title={entries.map(([k, v]) => `${METRIC_LABEL[k]} ${formatNumber(v)}`).join(" · ")}>
              {[
                ...context,
                entries.length
                  ? `${entries
                      .slice(0, 2)
                      .map(([k, v]) => `${formatNumber(v)} ${METRIC_LABEL[k]}`)
                      .join(" · ")}${entries.length > 2 ? ` +${entries.length - 2}` : ""}`
                  : t("no_values_short"),
              ].join(" · ")}
            </p>
            {row.invalid.length ? <p className="text-xs text-warning-fg">{t.plural("unreadable", row.invalid.length)}</p> : null}
          </div>
        )
      },
    },
    {
      id: "post",
      header: t("col_post"),
      className: "whitespace-normal",
      cell: (p) => {
        const { row, match } = p
        const matched = match.itemId ? byId.get(match.itemId) : undefined
        if ((match.status === "matched" || match.status === "duplicate" || match.status === "no_values") && matched) {
          return (
            <div className="flex min-w-0 max-w-[18rem] items-center gap-2">
              <PlatformIcon platform={matched.platform} className="size-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate" title={matched.title}>
                  {matched.title || t("untitled")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {matched.publishedAt ? `${formatShortDate(matched.publishedAt)} · ` : ""}
                  {reasonText(t, match.reason)}
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
                aria-label={t("choose_post_for", { line: row.line })}
                placeholder={t("choose_post_placeholder")}
                value={null}
                options={match.candidateIds
                  .map((id) => byId.get(id))
                  .filter((c): c is ImportCandidate => Boolean(c))
                  .map((c) => ({ value: c.id, label: candidateLabel(t, c), icon: <PlatformIcon platform={c.platform} className="text-muted-foreground" /> }))}
                onChange={(id) => onOverride(row.index, id)}
              />
              <p className="text-xs text-muted-foreground">{reasonText(t, match.reason)}</p>
            </div>
          )
        }
        if (match.status === "unmatched" || match.status === "unpublished") {
          return (
            <div className="flex min-w-0 max-w-[18rem] flex-col items-start gap-1">
              <p className="text-xs text-muted-foreground">{reasonText(t, match.reason)}</p>
              {willCreate(p) ? <p className="text-xs font-medium">{t("will_create")}</p> : null}
              <PostPicker posts={published} onPick={(id) => onOverride(row.index, id)} line={row.line} t={t} />
            </div>
          )
        }
        return <span className="text-xs text-muted-foreground">{reasonText(t, match.reason)}</span>
      },
    },
    {
      id: "status",
      header: t("col_status"),
      cell: (p) => {
        const { row, match } = p
        const meta = STATUS_META[match.status]
        const overridden = overrides.has(row.index)
        return (
          <div className="flex items-center gap-1">
            {willCreate(p) ? (
              <StatusPill tone="good" icon={Plus}>
                {t("status_new_post")}
              </StatusPill>
            ) : (
              <StatusPill tone={meta.tone}>{t(meta.label)}</StatusPill>
            )}
            {overridden ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={t("undo_choice", { line: row.line })} onClick={() => onOverride(row.index, undefined)}>
                <RotateCcw aria-hidden />
              </Button>
            ) : match.status === "matched" ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={t("skip_row", { line: row.line })} onClick={() => onOverride(row.index, null)}>
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
        <StatusPill tone="good">{t.plural("ready", counts.ready)}</StatusPill>
        {counts.attention ? <StatusPill tone="warning">{t("attention", { count: counts.attention })}</StatusPill> : null}
        {counts.skipped ? <StatusPill tone="neutral">{t("skipped_count", { count: counts.skipped })}</StatusPill> : null}
      </div>

      {bootstrap.length ? (
        <CsvBootstrap
          rows={bootstrap}
          on={bootstrapOn}
          onChange={onBootstrapChange}
          selected={selected}
          onRow={onBootstrapRow}
          onAll={onBootstrapAll}
          recordedOn={recordedOn}
        />
      ) : null}

      <ChipToggleGroup
        required
        size="xs"
        options={filterOptions}
        value={filter}
        onChange={(next) => {
          if (next) setFilter(next)
        }}
        aria-label={t("filter_label")}
      />
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(p) => String(p.row.index)}
        dense
        pageSize={25}
        maxHeight={520}
        stickyHeader
        aria-label={t("table_label")}
        empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("table_empty")}</p>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="max-w-xl text-xs text-pretty text-muted-foreground">{t("carry_note", { date: formatDate(recordedOn) })}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            {t("back_columns")}
          </Button>
          <Button type="button" size="sm" onClick={onImport} disabled={!snapshots && !posts}>
            <Upload aria-hidden />
            {posts && snapshots
              ? t("import_and_create", { snapshots: t.plural("snapshot_count", snapshots), posts: t.plural("post_count", posts) })
              : posts
                ? t.plural("create_posts", posts)
                : t.plural("import_snapshots", snapshots)}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Search every published post and pick the one a row belongs to. */
function PostPicker({ posts, onPick, line, t }: { posts: ImportCandidate[]; onPick: (id: ID) => void; line: number; t: T }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={t("choose_post_for", { line })}>
          {t("choose_post")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <Command>
          <CommandInput placeholder={t("search_posts")} />
          <CommandList>
            <CommandEmpty>{t("no_post_found")}</CommandEmpty>
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
                  <span className="min-w-0 flex-1 truncate">{post.title || t("untitled")}</span>
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
