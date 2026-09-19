"use client"

/**
 * The frame shared by the public legal pages, /privacy and /terms: header, article, the Contact block, the
 * account-deletion lines and the footer links. Copy: ./legal-messages.ts. Contact email: ./contact-email.ts.
 */
import { ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"
import { OrbiLogo } from "@/components/app-shell/orbi-logo"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { authLinkClass, fillTemplate } from "@/components/features/auth/legal-links"
import { Button } from "@/components/ui/button"
import { legalMessages } from "./legal-messages"

export type LegalPageKey = "privacy" | "terms"

const LEGAL_PAGES: { key: LegalPageKey; href: string }[] = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
]

export const legalBodyClass = "text-sm text-pretty text-muted-foreground"

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** Bulleted list of already-translated lines (strings or nodes with links). */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className={`flex list-disc flex-col gap-1.5 pl-5 ${legalBodyClass} marker:text-muted-foreground/60`}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

/** An in-text link to the other legal page, e.g. `{privacy}` in a Terms sentence. */
export function LegalPageLink({ page }: { page: LegalPageKey }) {
  const t = useScreenT(legalMessages)
  return (
    <Link href={`/${page}`} className={`${authLinkClass} underline decoration-muted-foreground/40`}>
      {t(page)}
    </Link>
  )
}

export function MailtoLink({ email }: { email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className="font-medium wrap-break-word text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
    >
      {email}
    </a>
  )
}

/** "Delete your account" and "remove my access request": by email when one is configured, else the honest fallback. */
export function useDeletionLines(email: string | null): React.ReactNode[] {
  const t = useScreenT(legalMessages)
  if (!email) return [t("delete_feedback"), t("request_none")]
  const link = <MailtoLink email={email} />
  return [fillTemplate(t("delete_email"), { email: link }), fillTemplate(t("request_email"), { email: link })]
}

/** "Email us at …", or — while `NEXT_PUBLIC_CONTACT_EMAIL` isn't set — says so and points to the Feedback button. */
export function ContactSection({ email }: { email: string | null }) {
  const t = useScreenT(legalMessages)
  return (
    <LegalSection title={t("contact_title")}>
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Mail className="size-4" aria-hidden />
        </span>
        <p className={`min-w-0 self-center ${legalBodyClass}`}>
          {email ? fillTemplate(t("contact_email"), { email: <MailtoLink email={email} /> }) : t("contact_none")}
        </p>
      </div>
    </LegalSection>
  )
}

export function LegalPage({
  current,
  title,
  updated,
  intro,
  showRequestAccess,
  children,
}: {
  current: LegalPageKey
  title: string
  updated: string
  intro: React.ReactNode
  /** Online version only: the waitlist form exists. */
  showRequestAccess: boolean
  children: React.ReactNode
}) {
  const t = useScreenT(legalMessages)
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" aria-label={t("back")} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <OrbiLogo className="h-7 text-foreground" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-16 md:pt-8">
        <article className="flex w-full max-w-2xl min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground">{updated}</p>
            <p className={`mt-2 ${legalBodyClass}`}>{intro}</p>
          </header>

          {children}

          <footer className="flex flex-col gap-4 border-t pt-6">
            <div className="flex flex-wrap gap-2">
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
            <nav aria-label={t("legal_nav")} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {LEGAL_PAGES.map((page, index) => (
                <span key={page.key} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  {page.key === current ? (
                    <span aria-current="page">{t(page.key)}</span>
                  ) : (
                    <Link href={page.href} className={`${authLinkClass} underline decoration-muted-foreground/40`}>
                      {t(page.key)}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          </footer>
        </article>
      </main>
    </div>
  )
}
