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
import { createStarterDatabase } from "@/lib/data/seed"
import { dataActions, useDataStore, useDb, useTable } from "@/lib/store"
import type { ContentFormat, Database, ID } from "@/lib/types"
import { matchesQuery, pluralize } from "@/lib/utils"
import { FormatDialog } from "./format-dialog"
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

function usageParts(usage: FormatUsage): string[] {
  return [
    usage.items ? pluralize(usage.items, "content item") : "",
    usage.ideas ? pluralize(usage.ideas, "idea") : "",
    usage.slots ? pluralize(usage.slots, "posting slot") : "",
    usage.series ? pluralize(usage.series, "series", "series") : "",
    usage.platforms ? pluralize(usage.platforms, "platform strategy", "platform strategies") : "",
  ].filter(Boolean)
}

export function FormatsTab({ openId, now }: { openId: string | null; now: Date }) {
  const db = useDb()
  const formats = useTable("content_formats")
  const userId = useDataStore((s) => s.userId)
  const [confirm, confirmDialog] = useConfirm()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)

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
    toast.success(`Moved “${format.name || "Untitled format"}” ${delta < 0 ? "up" : "down"}`)
  }

  async function remove(format: ContentFormat) {
    const parts = usageParts(usage.get(format.id) ?? EMPTY_USAGE)
    const name = format.name || "Untitled format"
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: parts.length
        ? `It's used by ${parts.join(", ")}. They keep all their data but lose this format.`
        : "Nothing uses this format yet. This can't be undone.",
      confirmLabel: "Delete format",
    })
    if (!ok) return
    if (openId === format.id) replaceSettingsUrl("formats")
    dataActions.remove("content_formats", format.id)
    toast.success("Format deleted", { description: name })
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
    toast.success(`Added ${pluralize(missingDefaults.length, "default format")}`)
  }

  const columns: DataTableColumn<FormatRow>[] = [
    {
      id: "name",
      header: "Format",
      sortValue: (r) => r.format.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground dark:bg-input/30">
            <FormatCategoryIcon category={r.format.category} className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium">{r.format.name || "Untitled format"}</span>
              {r.format.is_default ? <Token className="font-normal text-muted-foreground">Default</Token> : null}
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
      header: "Category",
      hideBelow: "lg",
      sortValue: (r) => FORMAT_CATEGORY_MAP[r.format.category]?.label ?? "",
      cell: (r) => <span className="text-muted-foreground">{FORMAT_CATEGORY_MAP[r.format.category]?.label ?? "—"}</span>,
    },
    {
      id: "script",
      header: "Script structure",
      hideBelow: "md",
      sortValue: (r) => SCRIPT_FORMATS[r.format.script_format]?.label ?? "",
      cell: (r) => {
        const spec = SCRIPT_FORMATS[r.format.script_format]
        return spec ? (
          <div className="min-w-0">
            <p className="whitespace-nowrap">{spec.label}</p>
            <p className="text-xs text-muted-foreground">{pluralize(spec.sections.length, "section")}</p>
          </div>
        ) : (
          "—"
        )
      },
    },
    {
      id: "usage",
      header: "Used by",
      align: "right",
      hideBelow: "sm",
      sortValue: (r) => r.total,
      cell: (r) =>
        r.total ? (
          <div className="whitespace-nowrap" title={usageParts(r.usage).join(", ")}>
            <p>{pluralize(r.usage.items, "item")}</p>
            <p className="text-xs text-muted-foreground">{pluralize(r.usage.ideas, "idea")}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">Not used</span>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: 52,
      cell: (r) => {
        const index = sorted.findIndex((f) => f.id === r.format.id)
        const name = r.format.name || "Untitled format"
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => openEdit(r.format.id)}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index <= 0} onSelect={() => move(r.format, -1)}>
                <ArrowUp aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index >= sorted.length - 1} onSelect={() => move(r.format, 1)}>
                <ArrowDown aria-hidden />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void remove(r.format)}>
                <Trash2 aria-hidden />
                Delete
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
          Add {pluralize(missingDefaults.length, "default format")}
        </Button>
      ) : null}
      <Button type="button" size="sm" onClick={() => setCreating(true)}>
        <Plus aria-hidden />
        New format
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
                  {filtered.length === rows.length ? pluralize(rows.length, "format") : `${filtered.length} of ${rows.length}`}
                </span>
                {addButtons}
              </>
            }
          >
            <SearchInput value={query} onChange={setQuery} placeholder="Search formats…" />
          </FilterBar>
          <DataTable
            rows={filtered}
            columns={columns}
            getRowId={(r) => r.format.id}
            onRowClick={(r) => openEdit(r.format.id)}
            rowLabel={(r) => `Edit ${r.format.name || "Untitled format"}`}
            aria-label="Content formats"
            empty={
              <EmptyState
                compact
                icon={Shapes}
                title="No formats match"
                description="Try a different search."
                action={
                  <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            }
          />
          <p className="text-xs text-muted-foreground">
            Order here is the order formats appear in pickers. Deleting a format keeps content that uses it — it just loses the
            format.
          </p>
        </>
      ) : (
        <EmptyState
          icon={Shapes}
          title="No content formats yet"
          description="Formats — Reels, carousels, LinkedIn posts, long-form videos — tell Content Studio which script structure to start from."
          action={
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New format
            </Button>
          }
          secondaryAction={
            missingDefaults.length ? (
              <Button type="button" size="sm" variant="outline" onClick={addDefaults}>
                Add {pluralize(missingDefaults.length, "default format")}
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
