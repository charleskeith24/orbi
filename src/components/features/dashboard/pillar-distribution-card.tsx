import { PieChart, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { MixBar } from "@/components/charts"
import { EmptyState, SectionCard, StatusPill } from "@/components/common"
import { MIN_MIX_SAMPLE, type PillarMix } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { formatNumber } from "@/lib/utils"
import { CardLink } from "./card-link"
import { dashboardMessages } from "./messages"

/** Actual vs target pillar mix with imbalance warnings — the dashboard's content-mix alarm. */
export function PillarDistributionCard({ mix, tolerance, className }: { mix: PillarMix; tolerance: number; className?: string }) {
  const t = useT(dashboardMessages)
  const unbalanced = mix.warnings.length > 0
  const segments = mix.rows.map((row) => ({ id: row.key, label: row.label, value: row.count, color: row.pillar.color }))
  const targets = mix.rows.map((row) => ({ id: row.key, value: row.targetPct }))
  const status = unbalanced ? (
    <StatusPill tone="warning">{t("unbalanced")}</StatusPill>
  ) : mix.enoughData ? (
    <StatusPill tone="good">{t("balanced")}</StatusPill>
  ) : null

  return (
    <SectionCard
      title={t("distribution_title")}
      description={t("distribution_description")}
      action={status}
      className={className}
      contentClassName="flex flex-col gap-3"
    >
      {!mix.rows.length ? (
        <EmptyState
          compact
          icon={PieChart}
          title={t("no_active_pillars")}
          description={t("no_active_pillars_description")}
          action={<CardLink href="/pillars">Content Pillars</CardLink>}
        />
      ) : mix.total === 0 ? (
        <EmptyState
          compact
          icon={PieChart}
          title={t("nothing_in_window")}
          description={t("nothing_in_window_description")}
        />
      ) : (
        <MixBar segments={segments} targets={targets} valueLabel="Posts" aria-label={t("mix_aria")} />
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
                <span className="sr-only">{t("warning_sr")}</span>
                <span className="text-pretty">{warning.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : mix.rows.length && mix.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {mix.enoughData
            ? t("every_pillar_within", { tolerance })
            : t.plural("only_posts", mix.total, { count: formatNumber(mix.total), min: MIN_MIX_SAMPLE })}
        </p>
      ) : null}
      {mix.unassigned > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t.plural("without_pillar", mix.unassigned, { count: formatNumber(mix.unassigned) })}
        </p>
      ) : null}
    </SectionCard>
  )
}
