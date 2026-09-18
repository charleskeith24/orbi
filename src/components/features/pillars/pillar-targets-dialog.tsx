"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions } from "@/lib/store"
import type { ContentPillar, ID } from "@/lib/types"
import { PillarIconTile } from "./pillar-icons"
import { sumValues, TARGET_TOTAL } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"
import { TargetsEditor, type TargetValues } from "./targets-editor"

/** Set Target % for every active pillar — saves only when the whole numbers add up to exactly 100. */
export function PillarTargetsDialog({
  open,
  onOpenChange,
  pillars,
  actualById,
  windowLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Active pillars in display order. */
  pillars: ContentPillar[]
  /** Actual share (0–100) per pillar id in the current window. */
  actualById: Map<ID, number>
  windowLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <TargetsForm pillars={pillars} actualById={actualById} windowLabel={windowLabel} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TargetsForm({
  pillars,
  actualById,
  windowLabel,
  onDone,
}: {
  pillars: ContentPillar[]
  actualById: Map<ID, number>
  windowLabel: string
  onDone: () => void
}) {
  const t = useT(pillarMessages)
  const c = useT(commonMessages)
  const [values, setValues] = useState<TargetValues>(() =>
    Object.fromEntries(pillars.map((p) => [p.id, p.target_percentage]))
  )
  const total = sumValues(pillars.map((p) => values[p.id]))
  const valid = pillars.length > 0 && total === TARGET_TOTAL

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    const updates = pillars.flatMap((p) => {
      const next = Math.round(values[p.id] ?? 0)
      return next === p.target_percentage ? [] : [{ id: p.id, patch: { target_percentage: next } }]
    })
    if (updates.length) dataActions.updateMany("content_pillars", updates)
    toast.success(updates.length ? t("targets_saved") : t("targets_unchanged"), {
      description: pillars.map((p) => `${p.name} ${Math.round(values[p.id] ?? 0)}%`).join(" · "),
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{t("targets_title")}</DialogTitle>
        <DialogDescription className="text-xs">{t("targets_description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {pillars.length ? (
          <TargetsEditor
            idPrefix="pillar-target"
            values={values}
            onChange={setValues}
            rows={pillars.map((p) => ({
              id: p.id,
              label: p.name || t("untitled_pillar"),
              mark: <PillarIconTile name={p.icon} color={p.color} size="sm" />,
              hint: t("actual_hint", { pct: Math.round(actualById.get(p.id) ?? 0), window: windowLabel }),
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("no_active_pillars")}</p>
        )}
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onDone}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("save_targets")}
        </Button>
      </DialogFooter>
    </form>
  )
}
