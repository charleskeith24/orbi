import { PieChart, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { MixBar } from "@/components/charts"
import { EmptyState, SectionCard, StatusPill } from "@/components/common"
import { MIN_MIX_SAMPLE, type PillarMix } from "@/lib/analytics"
import { pluralize } from "@/lib/utils"
import { CardLink } from "./card-link"

/** Actual vs target pillar mix with imbalance warnings — the dashboard's content-mix alarm. */
export function PillarDistributionCard({ mix, tolerance, className }: { mix: PillarMix; tolerance: number; className?: string }) {
  const unbalanced = mix.warnings.length > 0
  const segments = mix.rows.map((row) => ({ id: row.key, label: row.label, value: row.count, color: row.pillar.color }))
  const targets = mix.rows.map((row) => ({ id: row.key, value: row.targetPct }))
  const status = unbalanced ? (
    <StatusPill tone="warning">Unbalanced</StatusPill>
  ) : mix.enoughData ? (
    <StatusPill tone="good">Balanced</StatusPill>
  ) : null

  return (
    <SectionCard
      title="Pillar Distribution"
      description="Last 30 days + next 7 scheduled · actual vs target"
      action={status}
      className={className}
      contentClassName="flex flex-col gap-3"
    >
      {!mix.rows.length ? (
        <EmptyState
          compact
          icon={PieChart}
          title="No active Content Pillars"
          description="Set pillar targets to see whether your content mix matches your strategy."
          action={<CardLink href="/pillars">Content Pillars</CardLink>}
        />
      ) : mix.total === 0 ? (
        <EmptyState
          compact
          icon={PieChart}
          title="Nothing published or scheduled in this window"
          description="Your mix appears as soon as posts with a pillar go out or get scheduled."
        />
      ) : (
        <MixBar segments={segments} targets={targets} valueLabel="Posts" aria-label="Pillar distribution, actual vs target" />
      )}

      {unbalanced ? (
        <ul className="-mx-2 flex flex-col">
          {mix.warnings.map((warning) => (
            <li key={warning.key}>
              <Link
                href={`/pillars?open=${warning.key}`}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-fg" aria-hidden />
                <span className="sr-only">Warning: </span>
                <span className="text-pretty">{warning.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : mix.rows.length && mix.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {mix.enoughData
            ? `Every pillar is within ${tolerance} points of its target.`
            : `Only ${pluralize(mix.total, "post")} in this window — balance warnings start at ${MIN_MIX_SAMPLE}.`}
        </p>
      ) : null}
      {mix.unassigned > 0 ? (
        <p className="text-xs text-muted-foreground">{pluralize(mix.unassigned, "post")} in this window without a pillar aren&apos;t counted.</p>
      ) : null}
    </SectionCard>
  )
}
