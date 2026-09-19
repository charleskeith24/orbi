"use client"

/**
 * DRAFT — the privacy notice, for the owner to review before launch (copy in `privacy-messages.ts`).
 * Sources for each section, so it stays true when the code changes:
 * - account: Supabase Auth (`auth.users`), `public.users`; admins' 2-step: `auth.mfa` factors
 * - workspace: the 33 workspace tables (supabase/migrations/20260910000000_init.sql, RLS per user)
 * - access requests: `access_requests` (src/app/api/access-requests/route.ts — no IP read or stored)
 * - feedback: `feedback` (src/app/api/feedback/route.ts: kind, message, page, ui_language, viewport, user_agent, app_version)
 * - usage analytics: `usage_events`, opt-in per device (src/lib/telemetry, ARCHITECTURE §13)
 * - admins: metadata + counts only (src/lib/admin/types.ts `AdminUserRow`), audit log `admin_audit_log`
 * - export / start fresh: Settings → Data; account deletion: admin `DELETE /api/admin/users/:id` (workspace cascades)
 * - AI: `/api/ai` → Anthropic only with ANTHROPIC_API_KEY, otherwise the offline engine
 */
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { OrbiLogo } from "@/components/app-shell/orbi-logo"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { Button } from "@/components/ui/button"
import { privacyMessages } from "./privacy-messages"

type Key = keyof (typeof privacyMessages)["en"]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function PrivacyView({ showRequestAccess }: { showRequestAccess: boolean }) {
  const t = useScreenT(privacyMessages)
  const list = (keys: Key[]) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-pretty text-muted-foreground marker:text-muted-foreground/60">
      {keys.map((key) => (
        <li key={key}>{t(key)}</li>
      ))}
    </ul>
  )
  const stores: [Key, Key][] = [
    ["stores_account_title", "stores_account"],
    ["stores_workspace_title", "stores_workspace"],
    ["stores_requests_title", "stores_requests"],
    ["stores_feedback_title", "stores_feedback"],
    ["stores_usage_title", "stores_usage"],
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" aria-label={t("back")} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <OrbiLogo className="h-7 text-foreground" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-16 md:pt-8">
        <article className="flex w-full max-w-2xl flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("updated")}</p>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">{t("intro")}</p>
          </header>

          <Section title={t("stores_title")}>
            <dl className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              {stores.map(([title, body]) => (
                <div key={title} className="flex flex-col gap-0.5">
                  <dt className="text-sm font-medium">{t(title)}</dt>
                  <dd className="text-sm text-pretty text-muted-foreground">{t(body)}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title={t("see_title")}>{list(["see_you", "see_admins", "see_admins_read", "see_audit"])}</Section>
          <Section title={t("hosting_title")}>{list(["hosting_supabase", "hosting_vercel", "hosting_ai"])}</Section>
          <Section title={t("control_title")}>{list(["control_export", "control_clear", "control_delete", "control_usage"])}</Section>
          <Section title={t("storage_title")}>
            <p className="text-sm text-pretty text-muted-foreground">{t("storage_body")}</p>
          </Section>
          <Section title={t("local_title")}>
            <p className="text-sm text-pretty text-muted-foreground">{t("local_body")}</p>
          </Section>

          <div className="flex flex-wrap gap-2 border-t pt-6">
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <ArrowLeft aria-hidden />
                {t("back")}
              </Link>
            </Button>
            {showRequestAccess ? (
              <Button asChild size="sm">
                <Link href="/signup">{t("request_access")}</Link>
              </Button>
            ) : null}
          </div>
        </article>
      </main>
    </div>
  )
}
