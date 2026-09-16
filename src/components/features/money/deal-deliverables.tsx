"use client"

import { X } from "lucide-react"
import { useId, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { BrandDeal } from "@/lib/types"
import { cn } from "@/lib/utils"
import { dealSheetMessages } from "./deals-messages"
import { formatDeliverable, parseDeliverable, toggleDeliverable } from "./money-model"

/** Checklist of what the deal asks for; check state is stored in the text ("[x] …"). */
export function DealDeliverables({ deal }: { deal: BrandDeal }) {
  const t = useT(dealSheetMessages)
  const id = useId()
  const [draft, setDraft] = useState("")
  const save = (deliverables: string[]) => dataActions.update("brand_deals", deal.id, { deliverables })

  function add() {
    const label = draft.trim()
    if (!label) return
    save([...deal.deliverables, formatDeliverable(label, false)])
    setDraft("")
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {deal.deliverables.length ? (
        <ul className="flex flex-col">
          {deal.deliverables.map((text, index) => {
            const { label, done } = parseDeliverable(text)
            const checkboxId = `${id}-${index}`
            return (
              <li key={`${index}-${label}`} className="group/deliverable -mx-2 flex min-w-0 items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50">
                <Checkbox
                  id={checkboxId}
                  checked={done}
                  className="mt-0.5"
                  onCheckedChange={() => save(toggleDeliverable(deal.deliverables, index))}
                />
                <label htmlFor={checkboxId} className={cn("min-w-0 flex-1 text-sm text-pretty", done && "text-muted-foreground line-through")}>
                  {label}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground opacity-60 group-hover/deliverable:opacity-100 focus-visible:opacity-100"
                  aria-label={t("remove_deliverable", { label })}
                  onClick={() => save(deal.deliverables.filter((_, i) => i !== index))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("deliverables_empty")}</p>
      )}
      <Input
        value={draft}
        maxLength={200}
        placeholder={t("add_deliverable")}
        aria-label={t("add_deliverable_label")}
        className="h-8"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
            add()
          }
        }}
        onBlur={add}
      />
    </div>
  )
}
