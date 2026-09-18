"use client"

import { ArrowDown, ArrowUp, Ellipsis, Pencil, Plus, Shapes, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DataTable,
  EmptyState,
  FilterBar,
  FormatCategoryIcon,
  SearchInput,
  Token,
  useConfirm,
  type DataTableColumn,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FORMAT_CATEGORY_MAP, SCRIPT_FORMATS } from "@/lib/constants"
import { createStarterDatabase } from "@/lib/data/starter"
import { useT, type Translator } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useDataStore, useDb, useTable } from "@/lib/store"
import type { ContentFormat, Database, ID } from "@/lib/types"
import { formatNumber, matchesQuery } from "@/lib/utils"
import { FormatDialog } from "./format-dialog"
import { formatsMessages } from "./formats-messages"
import { replaceSettingsUrl } from "./tabs"

interface FormatUsage {
  items: number
  ideas: number
  slots: number
  series: number
  platforms: number
}

interface FormatRow {
  format: ContentFormat
  usage: FormatUsage
  total: number
}

const EMPTY_USAGE: FormatUsage = { items: 0, ideas: 0, slots: 0, series: 0, platforms: 0 }

function formatUsage(db: Database): Map<ID, FormatUsage> {
  const out = new Map<ID, FormatUsage>()
  const bump = (id: ID | null, key: keyof FormatUsage) => {
    if (!id) return
    const usage = out.get(id) ?? { ...EMPTY_USAGE }
    usage[key]++
    out.set(id, usage)
  }
  for (const item of db.content_items) bump(item.format_id, "items")
  for (const idea of db.content_ideas) bump(idea.format_id, "ideas")
  for (const slot of db.content_calendar) bump(slot.format_id, "slots")
  for (const series of db.content_series) bump(series.format_id, "series")
  for (const platform of db.content_platforms) for (const id of platform.preferred_format_ids) bump(id, "platforms")
  return out
}

type FormatsT = Translator<(typeof formatsMessages)["en"]>

/** "12 content items" — counts formatted like `pluralize`. */
const countOf = (t: FormatsT, key: Parameters<FormatsT["plural"]>[0], count: number) => t.plural(key, count, { count: formatNumber(count) })

function usageParts(usage: FormatUsage, t: FormatsT): string[] {
  return [
    usage.items ? countOf(t, "usage_items", usage.items) : "",
    usage.ideas ? countOf(t, "usage_ideas", usage.ideas) : "",
    usage.slots ? countOf(t, "usage_slots", usage.slots) : "",
    usage.series ? countOf(t, "usage_series", usage.series) : "",
    usage.platforms ? countOf(t, "usage_platforms", usage.platforms) : "",
  ].filter(Boolean)
}

export function FormatsTab({ openId, now }: { openId: string | null; now: Date }) {
  const db = useDb()
  const formats = useTable("content_formats")
  const userId = useDataStore((s) => s.userId)
  const [confirm, confirmDialog] = useConfirm()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const t = useT(formatsMessages)
  const c = useT(commonMessages)

  const usage = useMemo(() => formatUsage(db), [db])
  const sorted = useMemo(
    () => [...formats].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [formats]
  )
  const rows: FormatRow[] = useMemo(
    () =>
      sorted.map((format) => {
        const u = usage.get(format.id) ?? EMPTY_USAGE
        return { format, usage: u, total: u.items + u.ideas }
      }),
    [sorted, usage]
  )
  const filtered = rows.filter((r) =>
    matchesQuery(
      query,
      r.format.name,
      r.format.description,
      FORMAT_CATEGORY_MAP[r.format.category]?.label,
      SCRIPT_FORMATS[r.format.script_format]?.label
    )
  )

  // Starter formats that aren't in the library (matched by name).
  const missingDefaults = useMemo(() => {
    const have = new Set(formats.map((f) => f.name.trim().toLowerCase()))
    return createStarterDatabase(userId, now).content_formats.filter((f) => !have.has(f.name.toLowerCase()))
  }, [formats, userId, now])

  const editing = openId ? (formats.find((f) => f.id === openId) ?? null) : null
  const openEdit = (id: ID) => replaceSettingsUrl("formats", { open: id })
  const closeDialog = () => {
    setCreating(false)
    if (openId) replaceSettingsUrl("formats")
  }

  function move(format: ContentFormat, delta: number) {
    const ids = sorted.map((f) => f.id)
    const from = ids.indexOf(format.id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length) return
    ids.splice(from, 1)
    ids.splice(to, 0, format.id)
    const byId = new Map(sorted.map((f) => [f.id, f]))
    const updates = ids
      .map((id, index) => ({ id, patch: { sort_order: index } }))
      .filter((u) => byId.get(u.id)?.sort_order !== u.patch.sort_order)
    dataActions.updateMany("content_formats", updates)
    toast.success(t(delta < 0 ? "moved_up" : "moved_down", { name: format.name || t("untitled") }))
  }

  async function remove(format: ContentFormat) {
    const parts = usageParts(usage.get(format.id) ?? EMPTY_USAGE, t)
    const name = format.name || t("untitled")
    const ok = await confirm({
      title: t("delete_title", { name }),
      description: parts.length ? t("delete_used", { parts: parts.join(", ") }) : t("delete_unused"),
      confirmLabel: t("delete_action"),
    })
    if (!ok) return
    if (openId === format.id) replaceSettingsUrl("formats")
    dataActions.remove("content_formats", format.id)
    toast.success(t("deleted"), { description: name })
  }

  function addDefaults() {
    if (!missingDefaults.length) return
    const base = formats.reduce((max, f) => Math.max(max, f.sort_order), -1) + 1
    dataActions.insertMany(
      "content_formats",
      missingDefaults.map((f, i) => ({
        name: f.name,
        category: f.category,
        description: f.description,
        script_format: f.script_format,
        is_default: true,
        sort_order: base + i,
      }))
    )
    toast.success(countOf(t, "added_defaults", missingDefaults.length))
  }

  const columns: DataTableColumn<FormatRow>[] = [
    {
      id: "name",
      header: t("col_format"),
      sortValue: (r) => r.format.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground dark:bg-input/30">
            <FormatCategoryIcon category={r.format.category} className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium">{r.format.name || t("untitled")}</span>
              {r.format.is_default ? <Token className="font-normal text-muted-foreground">{t("default_token")}</Token> : null}
            </div>
            {r.format.description ? (
              <p className="max-w-[18rem] truncate text-xs text-muted-foreground xl:max-w-[24rem]" title={r.format.description}>
                {r.format.description}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: t("col_category"),
      hideBelow: "lg",
      sortValue: (r) => FORMAT_CATEGORY_MAP[r.format.category]?.label ?? "",
      cell: (r) => <span className="text-muted-foreground">{FORMAT_CATEGORY_MAP[r.format.category]?.label ?? "—"}</span>,
    },
    {
      id: "script",
      header: t("col_script"),
      hideBelow: "md",
      sortValue: (r) => SCRIPT_FORMATS[r.format.script_format]?.label ?? "",
      cell: (r) => {
        const spec = SCRIPT_FORMATS[r.format.script_format]
        return spec ? (
          <div className="min-w-0">
            <p className="whitespace-nowrap">{spec.label}</p>
            <p className="text-xs text-muted-foreground">{countOf(t, "sections", spec.sections.length)}</p>
          </div>
        ) : (
          "—"
        )
      },
    },
    {
      id: "usage",
      header: t("col_used_by"),
      align: "right",
      hideBelow: "sm",
      sortValue: (r) => r.total,
      cell: (r) =>
        r.total ? (
          <div className="whitespace-nowrap" title={usageParts(r.usage, t).join(", ")}>
            <p>{countOf(t, "items", r.usage.items)}</p>
            <p className="text-xs text-muted-foreground">{countOf(t, "usage_ideas", r.usage.ideas)}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">{t("not_used")}</span>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("col_actions")}</span>,
      align: "right",
      width: 52,
      cell: (r) => {
        const index = sorted.findIndex((f) => f.id === r.format.id)
        const name = r.format.name || t("untitled")
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions_for", { name })}>
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => openEdit(r.format.id)}>
                <Pencil aria-hidden />
                {c("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index <= 0} onSelect={() => move(r.format, -1)}>
                <ArrowUp aria-hidden />
                {t("move_up")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index >= sorted.length - 1} onSelect={() => move(r.format, 1)}>
                <ArrowDown aria-hidden />
                {t("move_down")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void remove(r.format)}>
                <Trash2 aria-hidden />
                {c("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const addButtons = (
    <>
      {missingDefaults.length ? (
        <Button type="button" variant="outline" size="sm" onClick={addDefaults}>
          {countOf(t, "add_defaults", missingDefaults.length)}
        </Button>
      ) : null}
      <Button type="button" size="sm" onClick={() => setCreating(true)}>
        <Plus aria-hidden />
        {t("new_format")}
      </Button>
    </>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {formats.length ? (
        <>
          <FilterBar
            actions={
              <>
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === rows.length ? countOf(t, "count", rows.length) : t("filtered", { shown: filtered.length, total: rows.length })}
                </span>
                {addButtons}
              </>
            }
          >
            <SearchInput value={query} onChange={setQuery} placeholder={t("search")} />
          </FilterBar>
          <DataTable
            rows={filtered}
            columns={columns}
            getRowId={(r) => r.format.id}
            onRowClick={(r) => openEdit(r.format.id)}
            rowLabel={(r) => t("edit_row", { name: r.format.name || t("untitled") })}
            aria-label={t("table_aria")}
            empty={
              <EmptyState
                compact
                icon={Shapes}
                title={t("no_match_title")}
                description={t("no_match_description")}
                action={
                  <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
                    {t("clear_search")}
                  </Button>
                }
              />
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("order_note")}
          </p>
        </>
      ) : (
        <EmptyState
          icon={Shapes}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("new_format")}
            </Button>
          }
          secondaryAction={
            missingDefaults.length ? (
              <Button type="button" size="sm" variant="outline" onClick={addDefaults}>
                {countOf(t, "add_defaults", missingDefaults.length)}
              </Button>
            ) : undefined
          }
        />
      )}

      <FormatDialog
        open={creating || Boolean(editing)}
        format={creating ? null : editing}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      />
      {confirmDialog}
    </div>
  )
}
