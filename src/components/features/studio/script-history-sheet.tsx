"use client"

import { ArrowLeftRight, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"
import { DetailSheet, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { SCRIPT_FORMATS } from "@/lib/constants"
import { formatDateTime } from "@/lib/dates"
import type { ContentScript, ScriptFormat } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { diffWords, type DiffPart } from "./script-diff"
import { scriptMessages } from "./script-messages"
import { wordsIn } from "./studio-utils"

/** Every saved version of one script format: compare any version with the current one, or restore it. */
export function ScriptHistorySheet({
  open,
  onOpenChange,
  format,
  versions,
  onRestore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  format: ScriptFormat
  /** Newest first. */
  versions: ContentScript[]
  onRestore: (version: ContentScript) => void
}) {
  const t = useT(scriptMessages)
  const latest = versions[0] ?? null
  const [compareId, setCompareId] = useState<string | null>(null)
  const compare = versions.find((v) => v.id === compareId && v.id !== latest?.id) ?? versions[1] ?? null

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="xl"
      title={t("version_history")}
      description={`${SCRIPT_FORMATS[format].label} · ${t.plural("saved_versions", versions.length, { count: formatNumber(versions.length) })}`}
      bodyClassName="flex flex-col gap-6"
    >
      <ol className="divide-y rounded-lg border" aria-label={t("versions")}>
        {versions.map((version) => {
          const isLatest = version.id === latest?.id
          const comparing = compare?.id === version.id
          return (
            <li key={version.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", comparing && "bg-muted/50")}>
              <span className="inline-flex h-5 shrink-0 items-center rounded-md border bg-card px-1.5 text-xs font-medium num dark:bg-input/30">
                v{version.version}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{isLatest ? t("current_version") : formatDateTime(version.created_at)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isLatest ? `${formatDateTime(version.created_at)} · ` : ""}
                  {t.plural("words", wordsIn(version.sections), { count: formatNumber(wordsIn(version.sections)) })}
                </p>
              </div>
              <ProviderBadge provider={version.generated_by} />
              {isLatest ? null : (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={comparing ? "secondary" : "ghost"}
                    size="xs"
                    aria-pressed={comparing}
                    onClick={() => setCompareId(version.id)}
                  >
                    <ArrowLeftRight aria-hidden />
                    {t("compare")}
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => onRestore(version)}>
                    <RotateCcw aria-hidden />
                    {t("restore")}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {latest && compare ? (
        <CompareView before={compare} after={latest} />
      ) : (
        <p className="text-sm text-pretty text-muted-foreground">{t("compare_hint")}</p>
      )}
    </DetailSheet>
  )
}

interface CompareRow {
  key: string
  label: string
  before: string
  after: string
  parts: DiffPart[] | null
}

function CompareView({ before, after }: { before: ContentScript; after: ContentScript }) {
  const t = useT(scriptMessages)
  const rows = useMemo<CompareRow[]>(() => {
    const keys: { key: string; label: string }[] = []
    const seen = new Set<string>()
    for (const s of [...after.sections, ...before.sections]) {
      if (seen.has(s.key)) continue
      seen.add(s.key)
      keys.push({ key: s.key, label: s.label })
    }
    const text = (script: ContentScript, key: string) => script.sections.find((s) => s.key === key)?.content ?? ""
    return [
      ...keys.map(({ key, label }) => ({ key, label, before: text(before, key), after: text(after, key) })),
      { key: "__caption", label: t("caption"), before: before.caption, after: after.caption },
      { key: "__hashtags", label: t("hashtags_row"), before: before.hashtags.join(" "), after: after.hashtags.join(" ") },
    ]
      .filter((row) => row.before || row.after)
      .map((row) => ({ ...row, parts: row.before === row.after ? null : diffWords(row.before, row.after) }))
  }, [before, after, t])
  const changed = rows.filter((r) => r.parts).length
  const delta = wordsIn(after.sections) - wordsIn(before.sections)

  return (
    <section aria-label={t("changes_aria", { before: before.version, after: after.version })} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-sm font-medium">{t("compare_heading", { before: before.version, after: after.version })}</h3>
        <span className="text-xs text-muted-foreground num">
          {changed ? t.plural("parts_changed", changed, { count: formatNumber(changed) }) : t("no_changes_diff")} · {delta >= 0 ? "+" : "−"}
          {t.plural("words", Math.abs(delta), { count: formatNumber(Math.abs(delta)) })}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground sm:ml-auto">
          <span className="inline-flex items-center gap-1">
            <del className="rounded-sm bg-critical/15 px-1 decoration-critical-fg/70 dark:bg-critical/25">{t("sample_text")}</del>
            {t("removed")}
          </span>
          <span className="inline-flex items-center gap-1">
            <ins className="rounded-sm bg-good/20 px-1 decoration-good-fg/50 underline-offset-2 dark:bg-good/25">{t("sample_text")}</ins>
            {t("added")}
          </span>
        </span>
      </div>
      <div className="hidden grid-cols-2 gap-2 text-xs font-medium text-muted-foreground md:grid">
        <span>{t("version_on", { version: before.version, date: formatDateTime(before.created_at) })}</span>
        <span>{t("version_current", { version: after.version })}</span>
      </div>
      <ol className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-foreground/80 uppercase">
              {row.label}
              {row.parts ? null : <span className="ml-1.5 font-normal tracking-normal text-muted-foreground normal-case">{t("unchanged")}</span>}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <DiffText side="before" version={before.version} text={row.before} parts={row.parts} />
              <DiffText side="after" version={after.version} text={row.after} parts={row.parts} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function DiffText({ side, version, text, parts }: { side: "before" | "after"; version: number; text: string; parts: DiffPart[] | null }) {
  const t = useT(scriptMessages)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] text-muted-foreground md:hidden">{t("version", { version })}</span>
      <p
        className={cn(
          "min-h-9 rounded-md border bg-muted/20 px-2.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap dark:bg-input/20",
          !parts && "text-muted-foreground"
        )}
      >
        {!text ? (
          <span className="text-muted-foreground">—</span>
        ) : !parts ? (
          text
        ) : (
          parts.map((part, index) => {
            if (part.type === "same") return <span key={index}>{part.text}</span>
            if (side === "before" && part.type === "del") {
              return (
                <del key={index} className="rounded-sm bg-critical/15 decoration-critical-fg/70 dark:bg-critical/25">
                  {part.text}
                </del>
              )
            }
            if (side === "after" && part.type === "add") {
              return (
                <ins key={index} className="rounded-sm bg-good/20 decoration-good-fg/50 underline-offset-2 dark:bg-good/25">
                  {part.text}
                </ins>
              )
            }
            return null
          })
        )}
      </p>
    </div>
  )
}
