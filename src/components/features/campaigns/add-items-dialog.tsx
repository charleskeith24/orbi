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
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { ContentCampaign, ID } from "@/lib/types"
import { formatNumber, matchesQuery } from "@/lib/utils"
import { campaignDetailMessages } from "./messages"

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
  const t = useT(campaignDetailMessages)
  const c = useT(commonMessages)
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
    toast.success(t.plural("added", selected.length, { count: formatNumber(selected.length) }), { description: campaign.name })
    onDone()
  }

  return (
    <>
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{t("add_title")}</DialogTitle>
        <DialogDescription className="text-xs">{t("add_description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder={t("search_content")} className="sm:w-64" autoFocus />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="only-unassigned" size="sm" checked={onlyUnassigned} onCheckedChange={setOnlyUnassigned} />
          <Label htmlFor="only-unassigned" className="text-xs font-normal text-muted-foreground">
            {t("only_unassigned")}
          </Label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {shown.length ? (
          <ul className="divide-y" aria-label={t("can_add_aria")}>
            {shown.map(({ item, date, inWindow }) => {
              const checked = chosen.has(item.id)
              const inputId = `add-item-${item.id}`
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 has-[[data-state=checked]]:bg-muted/40">
                  <Checkbox id={inputId} checked={checked} onCheckedChange={() => toggle(item.id)} />
                  <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.title || t("untitled_content")}</span>
                      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">
                          {date ? formatDate(date, "MMM d") : t("no_date")}
                          {inWindow ? t("in_window") : ""}
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
            title={t("nothing_to_add")}
            description={onlyUnassigned ? t("nothing_unassigned") : t("nothing_matches")}
          />
        )}
        {candidates.length > shown.length ? (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {t("showing_of", { max: MAX_ROWS, count: candidates.length })}
          </p>
        ) : null}
      </div>

      <DialogFooter className="m-0 items-center rounded-b-xl px-4 py-3 sm:justify-between">
        <span className="text-xs text-muted-foreground num">
          {selected.length ? t.plural("selected", selected.length, { count: formatNumber(selected.length) }) : t("select_to_add")}
        </span>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            {c("cancel")}
          </Button>
          <Button type="button" disabled={!selected.length} onClick={add}>
            {selected.length ? t.plural("add_pieces", selected.length, { count: formatNumber(selected.length) }) : t("add_pieces")}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
