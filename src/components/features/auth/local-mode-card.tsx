"use client"

import { ArrowRight, HardDrive } from "lucide-react"
import Link from "next/link"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { authMessages } from "@/components/features/auth/messages"
import { Button } from "@/components/ui/button"

const ENV_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]

/** Shown on /login and /signup when Supabase isn't configured: explains local mode instead of dead forms. */
export function LocalModeCard() {
  const t = useScreenT(authMessages)
  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <HardDrive className="size-4.5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-base font-semibold">{t("local_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("local_body")}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t("local_env")}</p>
      <ul
        aria-label={t("local_env_label")}
        className="mt-2 space-y-1 overflow-x-auto rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground"
      >
        {ENV_VARS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("local_guide")} <code className="font-mono text-foreground">docs/SUPABASE.md</code>
      </p>
      <Button asChild size="lg" className="mt-5 w-full">
        <Link href="/">
          {t("local_open")}
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Link>
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t("local_backup")}</p>
    </section>
  )
}
