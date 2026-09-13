import type { PerformanceRow } from "@/lib/analytics"
import { RATE_FIELDS } from "@/lib/constants"
import type { RateKey } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"

/** The formula applied to this post's own numbers, e.g. "591 ÷ 9,800 reach". */
function computation(key: RateKey, r: PerformanceRow): string {
  const base = `${formatNumber(r.base)} ${r.reach > 0 ? "reach" : "views"}`
  switch (key) {
    case "engagement_rate":
      return `${formatNumber(r.engagements)} ÷ ${base}`
    case "share_rate":
      return `${formatNumber(r.shares)} ÷ ${base}`
    case "save_rate":
      return `${formatNumber(r.saves)} ÷ ${base}`
    case "lead_conversion_rate":
      return r.linkClicks > 0
        ? `${formatNumber(r.leads)} ÷ ${formatNumber(r.linkClicks)} link clicks`
        : `${formatNumber(r.leads)} ÷ ${formatNumber(r.profileVisits)} profile visits`
    case "follower_conversion_rate":
      return `${formatNumber(r.followersGained)} ÷ ${formatNumber(r.profileVisits)} profile visits`
  }
}

/** Every derived rate with its formula (RATE_FIELDS) and the inputs used. */
export function RateList({ row }: { row: PerformanceRow }) {
  return (
    <ul className="divide-y rounded-lg border">
      {RATE_FIELDS.map((field) => {
        const value = row.rates[field.key]
        return (
          <li key={field.key} className="flex items-start justify-between gap-4 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm">{field.label}</p>
              <p className="text-xs text-pretty text-muted-foreground">
                {field.formula}
                <span className="num text-foreground/70"> · {computation(field.key, row)}</span>
              </p>
            </div>
            <span className="num shrink-0 pt-px text-sm font-medium">{value === null ? "—" : formatPercent(value)}</span>
          </li>
        )
      })}
    </ul>
  )
}
