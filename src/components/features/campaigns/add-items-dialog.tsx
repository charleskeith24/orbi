"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CampaignBadge, EmptyState, PlatformIcon, SearchInput, StageBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { contentItemDate, formatDate, parseDate } from "@/lib/dates"
import { dataActions, useTable } from "@/lib/store"
import type { ContentCampaign, ID } from "@/lib/types"
import { matchesQuery, pluralize } from "@/lib/utils"

const MAX_ROWS = 60

/** Attach existing content items to a campaign (sets `campaign_id`). */
export function AddItemsDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: ContentCampaign
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-xl">
        <AddItemsForm key={campaign.id} campaign={campaign} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AddItemsForm({ campaign, onDone }: { campaign: ContentCampaign; onDone: () => void }) {
  const items = useTable("content_items")
  const [query, setQuery] = useState("")
  const [onlyUnassigned, setOnlyUnassigned] = useState(true)
  const [selected, setSelected] = useState<ID[]>([])

  const candidates = useMemo(() => {
    const start = parseDate(campaign.start_date)
    const end = parseDate(campaign.end_date)
    return items
      .filter(
        (i) =>
          i.campaign_id !== campaign.id &&
          (!onlyUnassigned || !i.campaign_id) &&
          matchesQuery(query, i.title, i.hook, i.notes)
      )
      .map((item) => {
        const date = contentItemDate(item)
        const inWindow = Boolean(date && start && end && date >= start && date <= new Date(end.getTime() + 86_399_999))
        return { item, date, inWindow }
      })
      .sort((a, b) => Number(b.inWindow) - Number(a.inWindow) || (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
  }, [items, campaign, onlyUnassigned, query])

  const shown = candidates.slice(0, MAX_ROWS)
  const chosen = new Set(selected)

  function toggle(id: ID) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  }

  function add() {
    if (!selected.length) return
    dataActions.updateMany(
      "content_items",
      selected.map((id) => ({ id, patch: { campaign_id: campaign.id } }))
    )
    toast.success(`${pluralize(selected.length, "piece")} added to campaign`, { description: campaign.name })
    onDone()
  }

  return (
    <>
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>Add existing content</DialogTitle>
        <DialogDescription className="text-xs">
          Pieces dated inside the campaign window are listed first.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search content…" className="sm:w-64" autoFocus />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="only-unassigned" size="sm" checked={onlyUnassigned} onCheckedChange={setOnlyUnassigned} />
          <Label htmlFor="only-unassigned" className="text-xs font-normal text-muted-foreground">
            Only pieces without a campaign
          </Label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {shown.length ? (
          <ul className="divide-y" aria-label="Content you can add">
            {shown.map(({ item, date, inWindow }) => {
              const checked = chosen.has(item.id)
              const inputId = `add-item-${item.id}`
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 has-[[data-state=checked]]:bg-muted/40">
                  <Checkbox id={inputId} checked={checked} onCheckedChange={() => toggle(item.id)} />
                  <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.title || "Untitled content"}</span>
                      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">
                          {date ? formatDate(date, "MMM d") : "No date"}
                          {inWindow ? " · in window" : ""}
                        </span>
                        {item.campaign_id ? <CampaignBadge campaignId={item.campaign_id} variant="plain" className="min-w-0" /> : null}
                      </span>
                    </span>
                    <StageBadge stage={item.stage} className="hidden sm:inline-flex" />
                  </label>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            compact
            title="Nothing to add"
            description={
              onlyUnassigned
                ? "Every matching piece already belongs to a campaign. Turn off the filter to move pieces from another campaign."
                : "No content matches your search."
            }
          />
        )}
        {candidates.length > shown.length ? (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Showing {MAX_ROWS} of {candidates.length} — search to narrow the list.
          </p>
        ) : null}
      </div>

      <DialogFooter className="m-0 items-center rounded-b-xl px-4 py-3 sm:justify-between">
        <span className="text-xs text-muted-foreground num">
          {selected.length ? `${pluralize(selected.length, "piece")} selected` : "Select pieces to add"}
        </span>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="button" disabled={!selected.length} onClick={add}>
            {selected.length ? `Add ${pluralize(selected.length, "piece")}` : "Add pieces"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
