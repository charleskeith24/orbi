import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { TONE_ICON, TONE_TEXT, type StatusTone } from "@/components/common"
import { cn } from "@/lib/utils"

export interface KpiTileProps {
  label: string
  href: string
  value: React.ReactNode
  /** Small text after the value ("days"). */
  unit?: React.ReactNode
  /** One status chip after the value (ToneText); wraps under it on narrow tiles. */
  status?: React.ReactNode
  /** Below the status (a meter). */
  children?: React.ReactNode
  className?: string
}

/**
 * Home KPI tile (Calm UI): a short label, one number and a status chip — no sentences. The whole tile links to
 * the page with the detail; the arrow appears on hover and focus.
 */
export function KpiTile({ label, href, value, unit, status, children, className }: KpiTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group/kpi flex min-w-0 flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 text-card-foreground transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 @xl:px-4 @xl:py-3",
        className
      )}
    >
      <span className="flex min-w-0 items-start justify-between gap-2">
        {/* Two lines on phone-width tiles rather than a cut-off term ("Content Buffer"). */}
        <span className="line-clamp-2 text-xs leading-4 font-medium text-muted-foreground @xl:truncate">{label}</span>
        <ArrowUpRight
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/kpi:opacity-100 group-focus-visible/kpi:opacity-100 @max-xl:hidden"
          aria-hidden
        />
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="text-xl leading-7 font-semibold tracking-tight whitespace-nowrap num @xl:text-2xl @xl:leading-8">{value}</span>
          {unit ? <span className="truncate text-xs text-muted-foreground">{unit}</span> : null}
        </span>
        {status ? <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">{status}</span> : null}
      </span>
      {children ? <div className="mt-auto pt-0.5">{children}</div> : null}
    </Link>
  )
}

/** Status label for tiles: tone icon + one or two words, never colour alone. */
export function ToneText({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  const Icon = TONE_ICON[tone]
  return (
    <span className={cn("inline-flex min-w-0 shrink-0 items-center gap-1 font-medium", TONE_TEXT[tone], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  )
}
