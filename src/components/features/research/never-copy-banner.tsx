"use client"

import { ShieldCheck } from "lucide-react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { researchMessages } from "./messages"

/** The Research Library principle: study why content works, then make your own. */
export function NeverCopyBanner({ className }: { className?: string }) {
  const t = useT(researchMessages)
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <p className="min-w-0 text-pretty">
        <span className="font-medium">{t("never_copy")}</span> <span className="text-muted-foreground">{t("never_copy_detail")}</span>
      </p>
    </div>
  )
}
