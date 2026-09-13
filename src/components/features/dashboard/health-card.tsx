import Link from "next/link"
import { Meter, ScoreRing, SectionCard, TONE_ICON, TONE_TEXT, toneForScore } from "@/components/common"
import type { ContentHealth, HealthComponent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function HealthRow({ component }: { component: HealthComponent }) {
  const pct = component.max ? (component.score / component.max) * 100 : 0
  const tone = toneForScore(pct)
  const Icon = tone === "good" || tone === "neutral" ? null : TONE_ICON[tone]
  return (
    <Link
      href={component.href}
      className="flex min-w-0 flex-col gap-1 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{component.label}</span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground num">
          {Icon ? <Icon className={cn("size-3.5", TONE_TEXT[tone])} aria-hidden /> : null}
          <span className="font-medium text-foreground">{formatPoints(component.score)}</span>/{component.max}
        </span>
      </span>
      <Meter
        value={component.score}
        max={component.max}
        tone={tone}
        size="sm"
        aria-label={`${component.label}: ${formatPoints(component.score)} of ${component.max} points`}
      />
      <span className="line-clamp-2 text-xs text-pretty text-muted-foreground">{component.detail}</span>
    </Link>
  )
}

/** Score ring, band and the six weighted components with their explanations. */
export function HealthCard({ health, className }: { health: ContentHealth; className?: string }) {
  const weakest = [...health.components].sort((a, b) => a.score / a.max - b.score / b.max)[0]
  const BandIcon = TONE_ICON[health.band.tone]
  return (
    <SectionCard title="Content Health Score" className={className} contentClassName="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <ScoreRing value={health.score} size={64} strokeWidth={5} tone="auto" label="Content Health Score" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn("flex items-start gap-1 text-sm leading-snug font-medium", TONE_TEXT[health.band.tone])}>
            <BandIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="text-pretty">{health.band.label}</span>
          </p>
          {weakest && weakest.score < weakest.max ? (
            <p className="text-xs text-muted-foreground">
              Biggest gap: <span className="text-foreground">{weakest.label}</span>
            </p>
          ) : null}
        </div>
      </div>
      <ul className="-mx-2 flex flex-col">
        {health.components.map((component) => (
          <li key={component.key}>
            <HealthRow component={component} />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
