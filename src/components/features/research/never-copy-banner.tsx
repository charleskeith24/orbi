"use client"

import { ShieldCheck } from "lucide-react"
import { InfoHint } from "@/components/common"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { researchMessages } from "./messages"

/**
 * The Research Library principle in one line (Calm UI): study why content works, then make your own — never copy.
 * The full rule and what happens to pasted text sit behind its ⓘ. Inline (a span), so it can be a page subtitle.
 */
export function NeverCopyBanner({ className }: { className?: string }) {
  const t = useT(researchMessages)
  return (
    <span role="note" className={cn("inline-flex max-w-full items-center gap-1.5 align-middle", className)}>
      <ShieldCheck className="size-3.5 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0">{t("never_copy_short")}</span>
      <InfoHint title={t("never_copy_title")}>
        <p>{t("never_copy")}</p>
        <p>{t("never_copy_detail")}</p>
      </InfoHint>
    </span>
  )
}
