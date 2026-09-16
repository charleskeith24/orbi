"use client"

import { MessageSquarePlus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/lib/i18n"
import { FeedbackDialog } from "./feedback-dialog"
import { m } from "./messages"

/** Top-bar "Feedback" button: icon + label from md, icon-only (square, labelled) on phones. */
export function FeedbackButton() {
  const t = useT(m)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t("button_aria")} className="max-md:w-7 max-md:px-0" onClick={() => setOpen(true)}>
            <MessageSquarePlus aria-hidden />
            <span className="hidden md:inline">{t("button_label")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("button_tooltip")}</TooltipContent>
      </Tooltip>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
