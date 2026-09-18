"use client"

import { Ellipsis, Pencil, Plus, Tags as TagsIcon, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DataTable,
  EmptyState,
  FilterBar,
  OptionSelect,
  SearchInput,
  TagChip,
  useConfirm,
  type DataTableColumn,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useT, type Translator } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { ID, Tag, TaggableEntity } from "@/lib/types"
import { formatNumber, matchesQuery } from "@/lib/utils"
import { TagDialog } from "./tag-dialog"
import { replaceSettingsUrl } from "./tabs"
import { tagsMessages } from "./tags-messages"

const ENTITY_ORDER: TaggableEntity[] = ["content_ideas", "content_items", "stories", "hooks", "research_items", "content_campaigns"]

type SortKey = "usage" | "name"
type TagsT = Translator<(typeof tagsMessages)["en"]>

/** "3 unused tags" — counts formatted like `pluralize`. */
const countOf = (t: TagsT, key: Parameters<TagsT["plural"]>[0], count: number) => t.plural(key, count, { count: formatNumber(count) })

interface TagRow {
  tag: Tag
  total: number
  by: Partial<Record<TaggableEntity, number>>
}

function breakdown(row: TagRow, t: TagsT): string {
  return ENTITY_ORDER.filter((e) => row.by[e])
    .map((e) => countOf(t, `entity_${e}`, row.by[e] ?? 0))
    .join(" · ")
}

export function TagsTab({ openId }: { openId: string | null }) {
  const tags = useTable("tags")
  const links = useTable("content_tags")
  const [confirm, confirmDialog] = useConfirm()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("usage")
  const [creating, setCreating] = useState(false)
  const t = useT(tagsMessages)
  const c = useT(commonMessages)
  const sortOptions = [
    { value: "usage" as const, label: t("sort_usage") },
    { value: "name" as const, label: t("sort_name") },
  ]

  const rows = useMemo(() => {
    const byTag = new Map<ID, TagRow>(tags.map((tag) => [tag.id, { tag, total: 0, by: {} }]))
    for (const link of links) {
      const row = byTag.get(link.tag_id)
      if (!row) continue
      row.total++
      row.by[link.entity_type] = (row.by[link.entity_type] ?? 0) + 1
    }
    return [...byTag.values()]
  }, [tags, links])

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sort === "usage" ? b.total - a.total || a.tag.name.localeCompare(b.tag.name) : a.tag.name.localeCompare(b.tag.name)
      ),
    [rows, sort]
  )
  const filtered = sorted.filter((r) => matchesQuery(query.replace(/^#/, ""), r.tag.name))
  const unused = rows.filter((r) => r.total === 0)

  const editing = openId ? (tags.find((t) => t.id === openId) ?? null) : null
  const openEdit = (id: ID) => replaceSettingsUrl("tags", { open: id })
  const closeDialog = () => {
    setCreating(false)
    if (openId) replaceSettingsUrl("tags")
  }

  async function remove(row: TagRow) {
    const ok = await confirm({
      title: t("delete_title", { name: row.tag.name }),
      description: row.total ? t("delete_used", { breakdown: breakdown(row, t) }) : t("delete_unused"),
      confirmLabel: t("delete_action"),
    })
    if (!ok) return
    if (openId === row.tag.id) replaceSettingsUrl("tags")
    dataActions.remove("tags", row.tag.id)
    toast.success(t("deleted"), { description: `#${row.tag.name}` })
  }

  async function removeUnused() {
    if (!unused.length) return
    const names = unused.map((r) => `#${r.tag.name}`)
    const ok = await confirm({
      title: countOf(t, "delete_unused_title", unused.length),
      description: t("delete_unused_description", {
        names: names.length > 8 ? t("names_more", { names: names.slice(0, 8).join(", "), count: names.length - 8 }) : names.join(", "),
      }),
      confirmLabel: t("delete_unused_action"),
    })
    if (!ok) return
    dataActions.remove(
      "tags",
      unused.map((r) => r.tag.id)
    )
    toast.success(countOf(t, "deleted_unused", unused.length))
  }

  const columns: DataTableColumn<TagRow>[] = [
    { id: "tag", header: t("col_tag"), sortValue: (r) => r.tag.name, cell: (r) => <TagChip tag={r.tag} /> },
    {
      id: "breakdown",
      header: t("col_used_on"),
      hideBelow: "sm",
      cell: (r) =>
        r.total ? (
          <span className="text-muted-foreground">{breakdown(r, t)}</span>
        ) : (
          <span className="text-muted-foreground/80">{t("not_used")}</span>
        ),
    },
    { id: "total", header: t("col_total"), align: "right", width: 80, sortValue: (r) => r.total, cell: (r) => formatNumber(r.total) },
    {
      id: "actions",
      header: <span className="sr-only">{t("col_actions")}</span>,
      align: "right",
      width: 52,
      cell: (r) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions_for", { name: r.tag.name })}>
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => openEdit(r.tag.id)}>
              <Pencil aria-hidden />
              {c("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => void remove(r)}>
              <Trash2 aria-hidden />
              {c("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const newButton = (
    <Button type="button" size="sm" onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      {t("new_tag")}
    </Button>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {tags.length ? (
        <>
          <FilterBar
            actions={
              <>
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === rows.length ? countOf(t, "count", rows.length) : t("filtered", { shown: filtered.length, total: rows.length })}
                </span>
                {unused.length ? (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void removeUnused()}>
                    <Trash2 aria-hidden />
                    {countOf(t, "delete_unused_button", unused.length)}
                  </Button>
                ) : null}
                {newButton}
              </>
            }
          >
            <SearchInput value={query} onChange={setQuery} placeholder={t("search")} />
            <OptionSelect
              size="sm"
              options={sortOptions}
              value={sort}
              onChange={(next) => {
                if (next) setSort(next)
              }}
              className="w-36"
              aria-label={t("sort_aria")}
            />
          </FilterBar>
          <DataTable
            rows={filtered}
            columns={columns}
            getRowId={(r) => r.tag.id}
            onRowClick={(r) => openEdit(r.tag.id)}
            rowLabel={(r) => t("edit_row", { name: r.tag.name })}
            aria-label={t("table_aria")}
            dense
            empty={
              <EmptyState
                compact
                icon={TagsIcon}
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
        </>
      ) : (
        <EmptyState
          icon={TagsIcon}
          title={t("empty_title")}
          description={t("empty_description")}
          action={newButton}
        />
      )}
      <TagDialog
        open={creating || Boolean(editing)}
        tag={creating ? null : editing}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      />
      {confirmDialog}
    </div>
  )
}
