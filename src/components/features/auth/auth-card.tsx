import type { LucideIcon } from "lucide-react"

/** Card frame shared by the sign-in and sign-up forms. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <header className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div className="space-y-4 p-5 sm:p-6">{children}</div>
      {footer ? (
        <footer className="border-t px-5 py-4 text-center text-sm text-muted-foreground sm:px-6">{footer}</footer>
      ) : null}
    </section>
  )
}

/** Confirmation state (e.g. "Check your inbox") that replaces a form after it succeeds. */
export function AuthNotice({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card p-5 text-center text-card-foreground shadow-xs sm:p-6" aria-live="polite">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      {actions ? <div className="mt-5 flex flex-col gap-2">{actions}</div> : null}
    </section>
  )
}

/** Thin "or" divider that sits on the card surface. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
