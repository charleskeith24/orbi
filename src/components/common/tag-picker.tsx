"use client"

import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { ColorDot } from "@/components/common/color"
import { TagChip } from "@/components/common/entity-badges"
import { tagPickerMessages } from "@/components/common/messages"
import { CheckboxIndicator, keywordFilter } from "@/components/common/multi-select"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import { ensureTag, setEntityTags, useEntityTags, useTable } from "@/lib/store"
import type { ID, Tag, TaggableEntity } from "@/lib/types"
import { cn } from "@/lib/utils"

const CREATE_PREFIX = "__create__:"

/** Same normalisation `ensureTag` applies, so "exists?" checks match what gets stored. */
function normalizeTagName(name: string): string {
  return name.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-")
}

function tagFilter(value: string, search: string, keywords?: string[]): number {
  return value.startsWith(CREATE_PREFIX) ? 1 : keywordFilter(value, search, keywords)
}

/** Selected tag chips + a searchable popover that can create tags inline. */
export function TagPicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: ID[]
  onChange: (ids: ID[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const t = useT(tagPickerMessages)
  const tags = useTable("tags")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const byId = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const sorted = useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags])
  const selected = value.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t))
  const clean = normalizeTagName(search)
  const exists = clean ? tags.some((tag) => tag.name.toLowerCase() === clean) : true

  function toggle(id: ID) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  function create() {
    if (!clean) return
    const tag = ensureTag(clean)
    if (!value.includes(tag.id)) onChange([...value, tag.id])
    setSearch("")
  }

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {selected.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          onRemove={disabled ? undefined : () => onChange(value.filter((id) => id !== tag.id))}
        />
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="text-muted-foreground"
            aria-label={selected.length ? t("edit_tags") : undefined}
          >
            <Plus aria-hidden />
            {selected.length ? t("tag") : (placeholder ?? t("add_tag"))}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-0 p-0">
          <Command filter={tagFilter}>
            <CommandInput value={search} onValueChange={setSearch} placeholder={t("search_or_create")} />
            <CommandList label={t("options_label")}>
              {exists ? (
                <CommandEmpty>{tags.length ? t("no_matching") : t("no_tags_yet")}</CommandEmpty>
              ) : null}
              {sorted.length ? (
                <CommandGroup heading={t("tags")}>
                  {sorted.map((tag) => {
                    const checked = value.includes(tag.id)
                    return (
                      <CommandItem
                        key={tag.id}
                        value={tag.id}
                        keywords={[tag.name]}
                        aria-checked={checked}
                        onSelect={() => toggle(tag.id)}
                      >
                        <CheckboxIndicator checked={checked} />
                        <ColorDot color={tag.color} className="size-1.5" />
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground">#</span>
                          {tag.name}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null}
              {!exists ? (
                // Last, so Enter picks an existing partial match first (cmdk highlights the first row).
                // cmdk hides groups without scored matches, so the create row's group must force-mount too.
                <CommandGroup forceMount>
                  <CommandItem value={`${CREATE_PREFIX}${clean}`} forceMount onSelect={create}>
                    <Plus aria-hidden />
                    <span className="min-w-0 truncate">
                      <CreateLabel template={t("create")} tag={`#${clean}`} />
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** "Create {tag}" with the tag name emphasized, in either word order. */
function CreateLabel({ template, tag }: { template: string; tag: string }) {
  const [before, after = ""] = template.split("{tag}")
  return (
    <>
      {before}
      <span className="font-medium">{tag}</span>
      {after}
    </>
  )
}

/** TagPicker bound to an entity's tags through `content_tags`. */
export function EntityTagEditor({
  entityType,
  entityId,
  disabled,
  className,
}: {
  entityType: TaggableEntity
  entityId: ID
  disabled?: boolean
  className?: string
}) {
  const tags = useEntityTags(entityType, entityId)
  const ids = useMemo(() => tags.map((t) => t.id), [tags])
  return (
    <TagPicker
      value={ids}
      onChange={(next) => setEntityTags(entityType, entityId, next)}
      disabled={disabled}
      className={className}
    />
  )
}
