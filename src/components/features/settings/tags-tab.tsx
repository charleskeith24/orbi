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
import { dataActions, useTable } from "@/lib/store"
import type { ID, Tag, TaggableEntity } from "@/lib/types"
import { formatNumber, matchesQuery, pluralize } from "@/lib/utils"
import { TagDialog } from "./tag-dialog"
import { replaceSettingsUrl } from "./tabs"

const ENTITY_NOUNS: Record<TaggableEntity, [string, string]> = {
  content_ideas: ["idea", "ideas"],
  content_items: ["content item", "content items"],
  stories: ["story", "stories"],
  hooks: ["hook", "hooks"],
  research_items: ["research item", "research items"],
  content_campaigns: ["campaign", "campaigns"],
}
const ENTITY_ORDER = Object.keys(ENTITY_NOUNS) as TaggableEntity[]

type SortKey = "usage" | "name"
const SORT_OPTIONS = [
  { value: "usage" as const, label: "Most used" },
  { value: "name" as const, label: "A–Z" },
]

interface TagRow {
  tag: Tag
  total: number
  by: Partial<Record<TaggableEntity, number>>
}

function breakdown(row: TagRow): string {
  return ENTITY_ORDER.filter((e) => row.by[e])
    .map((e) => pluralize(row.by[e] ?? 0, ENTITY_NOUNS[e][0], ENTITY_NOUNS[e][1]))
    .join(" · ")
}

export function TagsTab({ openId }: { openId: string | null }) {
  const tags = useTable("tags")
  const links = useTable("content_tags")
  const [confirm, confirmDialog] = useConfirm()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("usage")
  const [creating, setCreating] = useState(false)

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
      title: `Delete #${row.tag.name}?`,
      description: row.total
        ? `It's attached to ${breakdown(row)}. They keep everything else — only the tag is removed.`
        : "Nothing uses this tag. This can't be undone.",
      confirmLabel: "Delete tag",
    })
    if (!ok) return
    if (openId === row.tag.id) replaceSettingsUrl("tags")
    dataActions.remove("tags", row.tag.id)
    toast.success("Tag deleted", { description: `#${row.tag.name}` })
  }

  async function removeUnused() {
    if (!unused.length) return
    const names = unused.map((r) => `#${r.tag.name}`)
    const ok = await confirm({
      title: `Delete ${pluralize(unused.length, "unused tag")}?`,
      description: `${names.slice(0, 8).join(", ")}${names.length > 8 ? ` and ${names.length - 8} more` : ""}. None of them is attached to anything.`,
      confirmLabel: "Delete unused tags",
    })
    if (!ok) return
    dataActions.remove(
      "tags",
      unused.map((r) => r.tag.id)
    )
    toast.success(`Deleted ${pluralize(unused.length, "unused tag")}`)
  }

  const columns: DataTableColumn<TagRow>[] = [
    { id: "tag", header: "Tag", sortValue: (r) => r.tag.name, cell: (r) => <TagChip tag={r.tag} /> },
    {
      id: "breakdown",
      header: "Used on",
      hideBelow: "sm",
      cell: (r) =>
        r.total ? (
          <span className="text-muted-foreground">{breakdown(r)}</span>
        ) : (
          <span className="text-muted-foreground/80">Not used</span>
        ),
    },
    { id: "total", header: "Total", align: "right", width: 80, sortValue: (r) => r.total, cell: (r) => formatNumber(r.total) },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: 52,
      cell: (r) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for #${r.tag.name}`}>
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => openEdit(r.tag.id)}>
              <Pencil aria-hidden />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => void remove(r)}>
              <Trash2 aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const newButton = (
    <Button type="button" size="sm" onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      New tag
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
                  {filtered.length === rows.length ? pluralize(rows.length, "tag") : `${filtered.length} of ${rows.length}`}
                </span>
                {unused.length ? (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void removeUnused()}>
                    <Trash2 aria-hidden />
                    Delete {pluralize(unused.length, "unused tag")}
                  </Button>
                ) : null}
                {newButton}
              </>
            }
          >
            <SearchInput value={query} onChange={setQuery} placeholder="Search tags…" />
            <OptionSelect
              size="sm"
              options={SORT_OPTIONS}
              value={sort}
              onChange={(next) => {
                if (next) setSort(next)
              }}
              className="w-36"
              aria-label="Sort tags"
            />
          </FilterBar>
          <DataTable
            rows={filtered}
            columns={columns}
            getRowId={(r) => r.tag.id}
            onRowClick={(r) => openEdit(r.tag.id)}
            rowLabel={(r) => `Edit #${r.tag.name}`}
            aria-label="Tags"
            dense
            empty={
              <EmptyState
                compact
                icon={TagsIcon}
                title="No tags match"
                description="Try a different search."
                action={
                  <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            }
          />
        </>
      ) : (
        <EmptyState
          icon={TagsIcon}
          title="No tags yet"
          description="Tags cut across pillars — a launch, a client, a recurring theme — so you can find everything about it in one search."
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
