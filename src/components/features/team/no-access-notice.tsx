"use client"

/**
 * The honest wall in front of a module this person can't see in the workspace they're in — today only
 * Money, which is hidden until the owner grants Money access. Postgres doesn't send the rows either, so
 * this exists to explain rather than to protect.
 */
import { Lock } from "lucide-react"
import Link from "next/link"
import { PageContainer } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useCanSeeMoney } from "@/lib/store"
import { teamMessages } from "@/lib/team/messages"

/** Renders Money's pages, or the notice when this person has no Money access here. */
export function MoneyAccessGate({ children }: { children: React.ReactNode }) {
  const allowed = useCanSeeMoney()
  const t = useT(teamMessages)
  if (allowed) return <>{children}</>
  return (
    <PageContainer width="narrow">
      <section className="mx-auto mt-4 w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:mt-10 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Lock className="size-4.5 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-base font-semibold">{t("refused_no_money")}</h1>
            <p className="text-sm text-muted-foreground">{t("money_access_info")}</p>
          </div>
        </div>
        <Button asChild size="lg" variant="outline" className="mt-5 w-full">
          <Link href="/">{t("back_home")}</Link>
        </Button>
      </section>
    </PageContainer>
  )
}
