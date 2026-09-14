"use client"

import { ChevronDown, PenLine } from "lucide-react"
import Link from "next/link"
import { Fragment, useDeferredValue, useMemo, useState } from "react"
import { StatusPill, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { buildBrandContext } from "@/lib/ai"
import { LANGUAGE_MAP } from "@/lib/constants"
import { useDb } from "@/lib/store"
import { cn, pluralize } from "@/lib/utils"
import { VOICE_ICON } from "./brand-icons"
import { brandPatch, CONTEXT_LIMITS, fieldId, type BrandField, type BrandFormValues, type BrandTextField } from "./brand-model"
import { focusControl } from "./use-scroll-spy"

function years(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded} ${rounded === 1 ? "year" : "years"}`
}

function VoiceRow({
  label,
  field,
  empty,
  trimmedAt,
  clamp,
  children,
}: {
  label: string
  field: BrandField
  empty: boolean
  /** The AI only reads this many characters of the field. */
  trimmedAt?: number
  clamp?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground/70 hover:text-foreground"
          aria-label={`Edit ${label.toLowerCase()}`}
          title="Edit"
          onClick={() => focusControl(fieldId(field))}
        >
          <PenLine aria-hidden />
        </Button>
      </div>
      <dd className={cn("min-w-0 text-sm leading-relaxed text-pretty break-words", clamp && "line-clamp-3")}>
        {empty ? <span className="text-muted-foreground italic">Not set — the AI has nothing to go on.</span> : children}
      </dd>
      {trimmedAt ? <p className="text-xs text-muted-foreground">Trimmed to {trimmedAt} characters in the AI context.</p> : null}
    </div>
  )
}

function Tokens({ values, strike = false }: { values: string[]; strike?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Token key={value} className={cn(strike && "text-muted-foreground line-through decoration-muted-foreground/60")}>
          <span className="truncate">{value}</span>
        </Token>
      ))}
    </span>
  )
}

/**
 * Read-only Brand Voice: what every AI generation is told about the brand (spec §29), derived from
 * `buildBrandContext` with the current — possibly unsaved — Brand HQ values.
 */
export function BrandVoicePreview({
  values,
  dirty,
  now,
  className,
}: {
  values: BrandFormValues
  dirty: boolean
  now: Date
  className?: string
}) {
  const db = useDb()
  const draft = useDeferredValue(values)
  const [expanded, setExpanded] = useState(false)

  const context = useMemo(() => {
    const brand = db.brand_profiles[0]
    const workspace = brand ? { ...db, brand_profiles: [{ ...brand, ...brandPatch(draft) }] } : db
    return buildBrandContext(workspace, now)
  }, [db, draft, now])

  const b = context.brand
  const trimmed = (field: BrandTextField) => {
    const limit = CONTEXT_LIMITS[field]
    return limit && draft[field].trim().length > limit ? limit : undefined
  }
  const brandInRole = b.brand_name && b.role.toLowerCase().includes(b.brand_name.toLowerCase())
  const writesAs = [b.role, brandInRole ? "" : b.brand_name, b.years_experience !== null ? years(b.years_experience) : "", b.location]
    .filter(Boolean)
    .join(" · ")
  // Exactly what the Brand Context sends (clipped there), like every other row.
  const niche = b.niche
  const interests = b.interests
  const primary = context.goals.find((g) => g.is_primary)
  const alsoSent: { label: string; href: string }[] = [
    { label: pluralize(context.goals.length, "goal"), href: "/strategy/goals" },
    { label: pluralize(context.pillars.length, "pillar"), href: "/pillars" },
    { label: pluralize(context.personas.length, "persona"), href: "/audience" },
    { label: pluralize(context.problems.length, "problem"), href: "/audience/problems" },
    { label: pluralize(context.stories.length, "story", "stories"), href: "/stories" },
    { label: pluralize(context.winners.length, "winner"), href: "/winners" },
  ]
  const clamp = !expanded

  return (
    <section
      id="voice"
      aria-labelledby="voice-heading"
      className={cn("flex min-w-0 scroll-mt-16 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground", className)}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="flex min-w-0 items-start gap-2">
          <VOICE_ICON className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <h3 id="voice-heading" className="text-sm leading-5 font-medium">
              Brand Voice
            </h3>
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">What every AI generation is told about you.</p>
          </div>
        </div>
        {dirty ? (
          <StatusPill tone="neutral" icon={PenLine} className="mt-0.5">
            Unsaved edits
          </StatusPill>
        ) : null}
      </div>

      <dl className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <VoiceRow label="Niche" field="niche" empty={!niche && !interests.length}>
          {niche ? <span className="font-medium">{niche}</span> : <span className="text-muted-foreground italic">No niche line yet</span>}
          {interests.length ? (
            <span className="mt-1.5 block">
              <Tokens values={interests} />
            </span>
          ) : null}
        </VoiceRow>
        <VoiceRow label="Writes as" field="name" empty={!b.name}>
          <span className="font-medium">{b.name}</span>
          {writesAs ? <span className="text-muted-foreground"> — {writesAs}</span> : null}
          {b.industry ? <span className="block text-xs text-muted-foreground">{b.industry}</span> : null}
        </VoiceRow>
        <VoiceRow label="Positioning" field="positioning_audience" empty={!b.positioning_statement}>
          {b.positioning_statement}
        </VoiceRow>
        <VoiceRow label="Language & tone" field="tones" empty={false}>
          {LANGUAGE_MAP[b.language]?.label ?? b.language}
          {b.tones.length ? <span className="text-muted-foreground"> · {b.tones.join(", ")}</span> : null}
        </VoiceRow>
        <VoiceRow label="Personality" field="personality_traits" empty={!b.personality.length}>
          <Tokens values={b.personality} />
        </VoiceRow>
        <VoiceRow label="Expertise" field="expertise_areas" empty={!b.expertise_areas.length}>
          <Tokens values={b.expertise_areas} />
        </VoiceRow>
        <VoiceRow label="Known for" field="known_for" empty={!b.known_for} clamp={clamp} trimmedAt={trimmed("known_for")}>
          {b.known_for}
        </VoiceRow>
        <VoiceRow label="Point of view" field="point_of_view" empty={!b.point_of_view} clamp={clamp} trimmedAt={trimmed("point_of_view")}>
          {b.point_of_view}
        </VoiceRow>
        {expanded ? (
          <>
            <VoiceRow label="Always" field="always_do" empty={!b.always_do} trimmedAt={trimmed("always_do")}>
              {b.always_do}
            </VoiceRow>
            <VoiceRow label="Never" field="never_do" empty={!b.never_do} trimmedAt={trimmed("never_do")}>
              {b.never_do}
            </VoiceRow>
            <VoiceRow label="Says" field="phrases_used" empty={!b.phrases_used.length}>
              <Tokens values={b.phrases_used} />
            </VoiceRow>
            <VoiceRow label="Never says" field="phrases_avoid" empty={!b.phrases_avoid.length}>
              <Tokens values={b.phrases_avoid} strike />
            </VoiceRow>
            <VoiceRow label="Calls to action" field="cta_style" empty={!b.cta_style} trimmedAt={trimmed("cta_style")}>
              {b.cta_style}
            </VoiceRow>
            <VoiceRow label="Storytelling" field="storytelling_style" empty={!b.storytelling_style} trimmedAt={trimmed("storytelling_style")}>
              {b.storytelling_style}
            </VoiceRow>
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
          {expanded ? "Show less" : "Show rules, phrases & CTAs"}
        </Button>
      </dl>

      <div className="flex flex-col gap-1.5 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <p className="text-pretty">
          Also in every request:{" "}
          {alsoSent.map((item, index) => (
            <Fragment key={item.href}>
              {index ? " · " : ""}
              <Link href={item.href} className="text-foreground underline-offset-2 hover:underline">
                {item.label}
              </Link>
            </Fragment>
          ))}
          {primary ? <> — primary goal “{primary.name}”.</> : "."}
        </p>
        <Link href="/settings?tab=ai" className="w-fit font-medium text-foreground underline-offset-2 hover:underline">
          See the exact Brand Context in Settings → AI
        </Link>
      </div>
    </section>
  )
}
