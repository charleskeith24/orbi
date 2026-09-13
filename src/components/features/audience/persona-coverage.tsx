"use client"

import Link from "next/link"
import { SectionCard, StatusPill } from "@/components/common"
import { MixBar, type MixSegment } from "@/components/charts"
import type { AudiencePersona } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { NONE, RECENT_DAYS, type ContentShare } from "./audience-model"
import { personaName } from "./persona-actions"

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
    .map((persona) => ({ id: persona.id, label: personaName(persona), value: share.counts.get(persona.id) ?? 0, color: persona.color }))
  if (folded + untargeted > 0) {
    segments.push({ id: NONE, label: folded ? "Other personas / none" : "No persona", value: folded + untargeted, color: "other" })
  }

  const untargetedPct = share.total ? (untargeted / share.total) * 100 : 0
  const missing = share.total ? personas.filter((p) => !share.counts.get(p.id)) : []

  return (
    <SectionCard
      className={className}
      title="Content by persona"
      description={`Pieces published, scheduled or due in the last ${RECENT_DAYS} days, by the persona they target.`}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <MixBar
          segments={segments}
          valueLabel="Pieces"
          valueFormatter={formatNumber}
          emptyMessage={`No dated content in the last ${RECENT_DAYS} days yet.`}
          aria-label="Share of recent content by persona"
        />
        {share.total ? (
          <ul className="flex flex-col gap-2 text-xs">
            {untargetedPct >= UNTARGETED_WARNING ? (
              <li className="flex flex-wrap items-center gap-2">
                <StatusPill tone="warning">{formatPercent(untargetedPct, 0)} targets no persona</StatusPill>
                <span className="text-muted-foreground">Set a persona on each piece in the Content Studio — content for everyone reaches no one.</span>
              </li>
            ) : null}
            {missing.map((persona) => (
              <li key={persona.id} className="flex flex-wrap items-center gap-2">
                <StatusPill tone="warning">No recent content for {personaName(persona)}</StatusPill>
                <Link
                  href={`/ideas/generator?persona=${persona.id}`}
                  className="text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
                >
                  Generate ideas for them
                </Link>
              </li>
            ))}
            {untargetedPct < UNTARGETED_WARNING && !missing.length ? (
              <li>
                <StatusPill tone="good">Every persona got content in the last {RECENT_DAYS} days</StatusPill>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  )
}
