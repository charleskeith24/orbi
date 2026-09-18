"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FormField, TagChip } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { CATEGORICAL_COLORS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { Tag, TagColor } from "@/lib/types"
import { TagColorPicker } from "./tag-color-picker"
import { tagsMessages } from "./tags-messages"

const NAME_MAX = 40

/** Same normalisation `ensureTag` applies, so names typed here match names created inline. */
export function normalizeTagName(name: string): string {
  return name.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-")
}

/** Create / edit a tag. Remounts per tag so the form starts from saved values. */
export function TagDialog({ open, onOpenChange, tag }: { open: boolean; onOpenChange: (open: boolean) => void; tag: Tag | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-md">
        <TagForm key={tag?.id ?? "new"} tag={tag} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TagForm({ tag, onDone }: { tag: Tag | null; onDone: () => void }) {
  const tags = useTable("tags")
  const t = useT(tagsMessages)
  const c = useT(commonMessages)
  const [name, setName] = useState(tag?.name ?? "")
  const [color, setColor] = useState<TagColor>(() => tag?.color ?? CATEGORICAL_COLORS[tags.length % CATEGORICAL_COLORS.length])
  const [touched, setTouched] = useState(false)

  const clean = normalizeTagName(name)
  const taken = tags.some((t) => t.id !== tag?.id && t.name.toLowerCase() === clean)
  const error = !clean
    ? t("name_required")
    : clean.length > NAME_MAX
      ? t("name_too_long", { max: NAME_MAX })
      : taken
        ? t("name_taken", { name: clean })
        : undefined
  const shownError = touched ? error : undefined

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (error) return
    if (tag) {
      dataActions.update("tags", tag.id, { name: clean, color })
      toast.success(t("updated"), { description: `#${clean}` })
    } else {
      dataActions.insert("tags", { name: clean, color })
      toast.success(t("created"), { description: `#${clean}` })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{tag ? t("edit_title") : t("new_tag")}</DialogTitle>
        <DialogDescription className="text-xs">
          {t("dialog_description")}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-4 py-4">
        <FormField
          label={t("name")}
          htmlFor="tag-name"
          required
          error={shownError}
          description={clean && clean !== name.trim() && !shownError ? t("saved_as", { name: clean }) : t("name_hint")}
        >
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>#</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="tag-name"
              value={name}
              autoFocus
              maxLength={NAME_MAX + 10}
              placeholder="launch-week"
              aria-invalid={Boolean(shownError) || undefined}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </InputGroup>
        </FormField>
        <FormField label={t("colour")}>
          <TagColorPicker value={color} onChange={setColor} aria-label={t("colour_aria")} />
        </FormField>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {t("preview")}
          <TagChip name={clean || "tag"} color={color} />
        </div>
      </div>
      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onDone}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={Boolean(shownError)}>
          {tag ? c("save_changes") : t("create_tag")}
        </Button>
      </DialogFooter>
    </form>
  )
}
