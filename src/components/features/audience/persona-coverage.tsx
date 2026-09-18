"use client"

import Link from "next/link"
import { SectionCard, StatusPill } from "@/components/common"
import { MixBar, type MixSegment } from "@/components/charts"
import { useT, useUiLang } from "@/lib/i18n"
import type { AudiencePersona } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { NONE, RECENT_DAYS, type ContentShare } from "./audience-model"
import { audienceMessages } from "./messages"
import { personaName } from "./persona-actions"
import { personaMessages } from "./persona-messages"

const MAX_PERSONA_SEGMENTS = 7
/** Untargeted share above which the mix gets a warning. */
const UNTARGETED_WARNING = 20

/** 100% bar of recent content by target persona, with coverage warnings. */
export function PersonaCoverage({
  personas,
  share,
  className,
}: {
  personas: AudiencePersona[]
  share: ContentShare
  className?: string
}) {
  const t = useT(personaMessages)
  const a = useT(audienceMessages)
  const lang = useUiLang()
  const ranked = personas
    .map((persona) => ({ persona, value: share.counts.get(persona.id) ?? 0 }))
    .sort((a, b) => b.value - a.value)
  const shown = ranked.slice(0, MAX_PERSONA_SEGMENTS)
  const known = new Set(personas.map((p) => p.id))
  const folded = ranked.slice(MAX_PERSONA_SEGMENTS).reduce((acc, r) => acc + r.value, 0)
  let untargeted = 0
  for (const [key, count] of share.counts) if (key === NONE || !known.has(key)) untargeted += count

  // Colour follows the entity; the display order follows the persona list, not the rank.
  const segments: MixSegment[] = personas
    .filter((persona) => shown.some((r) => r.persona.id === persona.id))
    .map((persona) => ({ id: persona.id, label: personaName(persona, lang), value: share.counts.get(persona.id) ?? 0, color: persona.color }))
  if (folded + untargeted > 0) {
    segments.push({ id: NONE, label: folded ? t("other_personas") : a("no_persona"), value: folded + untargeted, color: "other" })
  }

  const untargetedPct = share.total ? (untargeted / share.total) * 100 : 0
  const missing = share.total ? personas.filter((p) => !share.counts.get(p.id)) : []

  return (
    <SectionCard
      className={className}
      title={t("coverage_title")}
      description={t("coverage_description", { days: RECENT_DAYS })}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <MixBar
          segments={segments}
          valueLabel={t("pieces")}
          valueFormatter={formatNumber}
          emptyMessage={t("coverage_empty", { days: RECENT_DAYS })}
          aria-label={t("coverage_aria")}
        />
        {share.total ? (
          <ul className="flex flex-col gap-2 text-xs">
            {untargetedPct >= UNTARGETED_WARNING ? (
              <li className="flex flex-wrap items-center gap-2">
                <StatusPill tone="warning">{t("targets_no_persona", { pct: formatPercent(untargetedPct, 0) })}</StatusPill>
                <span className="text-muted-foreground">{t("targets_no_persona_hint")}</span>
              </li>
            ) : null}
            {missing.map((persona) => (
              <li key={persona.id} className="flex flex-wrap items-center gap-2">
                <StatusPill tone="warning">{t("no_recent_for", { name: personaName(persona, lang) })}</StatusPill>
                <Link
                  href={`/ideas/generator?persona=${persona.id}`}
                  className="text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
                >
                  {t("generate_for_them")}
                </Link>
              </li>
            ))}
            {untargetedPct < UNTARGETED_WARNING && !missing.length ? (
              <li>
                <StatusPill tone="good">{t("every_persona_covered", { days: RECENT_DAYS })}</StatusPill>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  )
}
