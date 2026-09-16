"use client"

import { FilePlus2, Link2, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { FormField, OptionSelect, PlatformIcon, StageBadge, type SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useBrand, useLookup, useTable } from "@/lib/store"
import type { BrandDeal, ContentItem, ID, PlatformId } from "@/lib/types"
import { dealSheetMessages } from "./deals-messages"
import { moneyMessages } from "./messages"
import { createContentForDeal, setItemDeal } from "./money-actions"
import { ContentCombobox } from "./money-ui"

/** Content made for the deal: linked items, "Link content" (moves an item from another deal) and "Create content". */
export function DealContentSection({ deal }: { deal: BrandDeal }) {
  const t = useT(dealSheetMessages)
  const m = useT(moneyMessages)
  const items = useLookup("content_items")
  const deals = useTable("brand_deals")
  const [creating, setCreating] = useState(false)
  const linked = deal.content_item_ids.map((id) => items.get(id)).filter((i): i is ContentItem => Boolean(i))
  const brand = deal.brand_name || m("untitled_deal")

  function link(itemId: ID | null) {
    if (!itemId) return
    const previous = deals.find((d) => d.id !== deal.id && d.content_item_ids.includes(itemId))
    setItemDeal(itemId, deal.id, { silent: true })
    toast.success(t("linked", { brand }), {
      description: previous ? t("moved_from", { brand: previous.brand_name || m("untitled_deal") }) : undefined,
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {linked.length ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {linked.map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-2 py-1.5 pr-1.5 pl-3">
              <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
              <Link
                href={`/studio/${item.id}`}
                className="min-w-0 flex-1 truncate text-sm underline-offset-2 outline-none hover:underline focus-visible:underline"
              >
                {item.title.trim() || m("untitled_content")}
              </Link>
              <StageBadge stage={item.stage} className="max-sm:hidden" />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={t("unlink", { title: item.title.trim() || m("untitled_content") })}
                onClick={() => {
                  setItemDeal(item.id, null, { silent: true })
                  toast.success(t("unlinked"), { description: item.title })
                }}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">{t("linked_empty")}</p>
      )}

      {creating ? (
        <CreateContentForm deal={deal} onDone={() => setCreating(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <ContentCombobox
            value={null}
            onChange={link}
            excludeIds={deal.content_item_ids}
            placeholder={t("link_existing")}
            searchPlaceholder={t("search_content")}
            emptyText={t("no_content")}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Link2 aria-hidden />
                {t("link_existing")}
              </Button>
            }
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
            <FilePlus2 aria-hidden />
            {t("create_content")}
          </Button>
        </div>
      )}
    </div>
  )
}

function CreateContentForm({ deal, onDone }: { deal: BrandDeal; onDone: () => void }) {
  const t = useT(dealSheetMessages)
  const m = useT(moneyMessages)
  const router = useRouter()
  const brand = useBrand()
  const id = useId()
  const brandName = deal.brand_name || m("untitled_deal")
  const [title, setTitle] = useState("")
  const [touched, setTouched] = useState(false)
  const [platform, setPlatform] = useState<PlatformId>(deal.platforms[0] ?? brand.main_platforms[0] ?? "facebook")
  const options = useMemo<SelectOption<PlatformId>[]>(
    () =>
      PLATFORM_IDS.map((p) => ({
        value: p,
        label: PLATFORMS[p].label,
        icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
      })),
    []
  )
  const error = title.trim() ? undefined : t("error_title")

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (error) return
    const item = createContentForDeal(deal, { title, platform })
    toast.success(t("created", { brand: brandName }), {
      description: item.title,
      action: { label: t("open_studio"), onClick: () => router.push(`/studio/${item.id}`) },
    })
    onDone()
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <FormField label={t("create_title")} htmlFor={`${id}-title`} error={touched ? error : undefined}>
          <Input
            id={`${id}-title`}
            autoFocus
            value={title}
            maxLength={200}
            placeholder={t("create_placeholder", { brand: brandName })}
            aria-invalid={Boolean(touched && error) || undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
        <FormField label={t("create_platform")} htmlFor={`${id}-platform`}>
          <OptionSelect id={`${id}-platform`} options={options} value={platform} onChange={(next) => next && setPlatform(next)} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={Boolean(error)}>
          {t("create_submit")}
        </Button>
      </div>
    </form>
  )
}
