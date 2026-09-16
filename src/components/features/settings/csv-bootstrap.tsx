"use client"

import { PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { METRIC_FIELDS, PLATFORMS } from "@/lib/constants"
import { formatDate, formatShortDate } from "@/lib/dates"
import { useT, type Translator } from "@/lib/i18n"
import type { BootstrapRow } from "@/lib/integrations"
import type { ISODate } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { m } from "./csv-messages"

type T = Translator<(typeof m)["en"]>

const METRIC_LABEL = Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.label.toLowerCase()])) as Record<string, string>

/** The name a new post gets: its title from the file, or "Instagram post · Sep 13, 2026". */
export function bootstrapTitle(t: T, entry: BootstrapRow, recordedOn: ISODate): string {
  if (entry.title) return entry.title
  const platform = entry.platform ? PLATFORMS[entry.platform].label : ""
  return t("untitled_post", { platform, date: formatDate(entry.publishedAt ?? recordedOn) }).trim()
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/**
 * Opt-in: turn rows that match no post into published posts (with their numbers). Off by default;
 * every creatable row is listed with a tick box, rows that can't become a post say why.
 */
export function CsvBootstrap({
  rows,
  on,
  onChange,
  selected,
  onRow,
  onAll,
  recordedOn,
}: {
  rows: BootstrapRow[]
  on: boolean
  onChange: (on: boolean) => void
  selected: ReadonlySet<number>
  onRow: (rowIndex: number, create: boolean) => void
  onAll: (create: boolean) => void
  recordedOn: ISODate
}) {
  const t = useT(m)
  const creatable = rows.filter((entry) => !entry.problem)
  const count = creatable.filter((entry) => selected.has(entry.row.index)).length

  return (
    <section aria-labelledby="csv-bootstrap-label" className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Switch id="csv-bootstrap" checked={on} onCheckedChange={onChange} aria-describedby="csv-bootstrap-hint" className="mt-0.5" />
        <div className="min-w-0">
          <Label id="csv-bootstrap-label" htmlFor="csv-bootstrap" className="text-sm leading-5 font-medium">
            {t("bootstrap_switch")}
          </Label>
          <p id="csv-bootstrap-hint" className="text-xs text-pretty text-muted-foreground">
            {t("bootstrap_hint")}
          </p>
        </div>
      </div>

      {on ? (
        <div className="flex min-w-0 flex-col gap-2 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium" aria-live="polite">
              {count ? t.plural("bootstrap_preview", count) : t("bootstrap_none")}
            </p>
            {creatable.length > 1 ? (
              <div className="flex gap-1">
                <Button type="button" size="xs" variant="ghost" onClick={() => onAll(true)} disabled={count === creatable.length}>
                  {t("select_all")}
                </Button>
                <Button type="button" size="xs" variant="ghost" onClick={() => onAll(false)} disabled={!count}>
                  {t("select_none")}
                </Button>
              </div>
            ) : null}
          </div>
          <ul className="flex max-h-80 min-w-0 flex-col divide-y overflow-y-auto rounded-md border" aria-label={t("bootstrap_label")}>
            {rows.map((entry) => (
              <BootstrapItem
                key={entry.row.index}
                entry={entry}
                checked={selected.has(entry.row.index)}
                onCheckedChange={(create) => onRow(entry.row.index, create)}
                recordedOn={recordedOn}
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function BootstrapItem({
  entry,
  checked,
  onCheckedChange,
  recordedOn,
  t,
}: {
  entry: BootstrapRow
  checked: boolean
  onCheckedChange: (create: boolean) => void
  recordedOn: ISODate
  t: T
}) {
  const id = `csv-bootstrap-row-${entry.row.index}`
  const title = bootstrapTitle(t, entry, recordedOn)
  const metrics = Object.entries(entry.row.metrics)
  const details = [
    t("row_n", { line: entry.row.line }),
    entry.publishedAt ? formatShortDate(entry.publishedAt) : t("bootstrap_no_date", { date: formatDate(recordedOn) }),
    entry.url ? hostOf(entry.url) : "",
    metrics
      .slice(0, 2)
      .map(([key, value]) => `${formatNumber(value)} ${METRIC_LABEL[key]}`)
      .join(" · "),
  ].filter(Boolean)
  const problem = entry.problem
    ? entry.problem === "in_file"
      ? t("bootstrap_problem_in_file", { line: entry.firstLine ?? "" })
      : t(`bootstrap_problem_${entry.problem}` as const)
    : null

  return (
    <li className="flex min-w-0 items-start gap-3 px-3 py-2">
      {problem ? (
        <span className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={t("bootstrap_create_row", { line: entry.row.line })}
          className="mt-0.5"
        />
      )}
      <div className="min-w-0 flex-1">
        <label htmlFor={problem ? undefined : id} className={cn("flex min-w-0 items-center gap-1.5 text-sm", !problem && "cursor-pointer")}>
          {entry.platform ? <PlatformIcon platform={entry.platform} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
          <span className={cn("truncate", (!entry.title || problem) && "text-muted-foreground")} title={title}>
            {title}
          </span>
        </label>
        <p className="truncate text-xs text-muted-foreground num" title={details.join(" · ")}>
          {details.join(" · ")}
        </p>
        {problem ? <p className="text-xs text-pretty text-muted-foreground">{problem}</p> : null}
      </div>
    </li>
  )
}
