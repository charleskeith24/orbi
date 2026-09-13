import Link from "next/link"
import { TONE_ICON, TONE_TEXT, type IconComponent, type StatusTone } from "@/components/common"
import { cn } from "@/lib/utils"

export interface KpiTileProps extends Omit<React.ComponentPropsWithRef<"a">, "href" | "children"> {
  label: string
  icon: IconComponent
  href: string
  value: React.ReactNode
  /** Beside the value ("days", a status). */
  unit?: React.ReactNode
  /** Right of the value (a sparkline); hidden when the tile is too narrow. */
  aside?: React.ReactNode
  /** Between the value and the footer (a meter). */
  children?: React.ReactNode
  footer?: React.ReactNode
  iconTone?: StatusTone
}

/**
 * KPI tile in the StatTile look, with slots StatTile doesn't have (meter, free-form footer)
 * and ref/prop forwarding so it can be a HoverCard trigger.
 */
export function KpiTile({ label, icon: Icon, href, value, unit, aside, children, footer, iconTone, className, ...rest }: KpiTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "@container flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground transition-colors outline-none hover:border-foreground/15 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      {...rest}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 shrink-0", iconTone ? TONE_TEXT[iconTone] : "text-muted-foreground")} aria-hidden />
      </div>
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-2xl leading-8 font-semibold tracking-tight whitespace-nowrap num">{value}</span>
          {unit ? <span className="min-w-0 truncate text-xs text-muted-foreground">{unit}</span> : null}
        </div>
        {aside ? <div className="mb-1.5 hidden shrink-0 @min-[13rem]:block">{aside}</div> : null}
      </div>
      {children}
      {footer ? <div className="mt-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">{footer}</div> : null}
    </Link>
  )
}

/** Status label for tile footers: tone icon + text, never colour alone. */
export function ToneText({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  const Icon = TONE_ICON[tone]
  return (
    <span className={cn("inline-flex min-w-0 shrink-0 items-center gap-1 font-medium", TONE_TEXT[tone], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  )
}
