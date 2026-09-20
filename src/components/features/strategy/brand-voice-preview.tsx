"use client"

import { ChevronDown, PenLine } from "lucide-react"
import Link from "next/link"
import { Fragment, useDeferredValue, useMemo, useState } from "react"
import { InfoHint, StatusPill, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { buildBrandContext } from "@/lib/ai"
import { LANGUAGE_MAP } from "@/lib/constants"
import { useT, type Translator } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useDb } from "@/lib/store"
import { cn, formatNumber } from "@/lib/utils"
import { VOICE_ICON } from "./brand-icons"
import { brandVoiceMessages } from "./brand-messages"
import { brandPatch, CONTEXT_LIMITS, type BrandField, type BrandFormValues, type BrandTextField } from "./brand-model"

type VoiceT = Translator<(typeof brandVoiceMessages)["en"]>

function years(value: number, t: VoiceT): string {
  const rounded = Math.round(value * 10) / 10
  return t.plural("years", rounded, { count: String(rounded) })
}

function VoiceRow({
  label,
  field,
  empty,
  trimmedAt,
  clamp,
  onEdit,
  children,
}: {
  label: string
  field: BrandField
  empty: boolean
  onEdit: (field: BrandField) => void
  /** The AI only reads this many characters of the field. */
  trimmedAt?: number
  clamp?: boolean
  children?: React.ReactNode
}) {
  const t = useT(brandVoiceMessages)
  const c = useT(commonMessages)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground/70 hover:text-foreground"
          aria-label={t("edit_row", { label: label.toLowerCase() })}
          title={c("edit")}
          onClick={() => onEdit(field)}
        >
          <PenLine aria-hidden />
        </Button>
      </div>
      <dd className={cn("min-w-0 text-sm leading-relaxed text-pretty break-words", clamp && "line-clamp-3")}>
        {empty ? <span className="text-muted-foreground italic">{t("not_set")}</span> : children}
      </dd>
      {trimmedAt ? <p className="text-xs text-muted-foreground">{t("trimmed", { count: trimmedAt })}</p> : null}
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
 * `buildBrandContext` with the current — possibly unsaved — Brand HQ values. The first rows show; the rest
 * wait behind "Show more". ✎ opens the field's section (`onEdit`).
 */
export function BrandVoicePreview({
  values,
  dirty,
  now,
  onEdit,
  className,
}: {
  values: BrandFormValues
  dirty: boolean
  now: Date
  onEdit: (field: BrandField) => void
  className?: string
}) {
  const db = useDb()
  const draft = useDeferredValue(values)
  const [expanded, setExpanded] = useState(false)
  const t = useT(brandVoiceMessages)
  const c = useT(commonMessages)

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
  const writesAs = [b.role, brandInRole ? "" : b.brand_name, b.years_experience !== null ? years(b.years_experience, t) : "", b.location]
    .filter(Boolean)
    .join(" · ")
  // Exactly what the Brand Context sends (clipped there), like every other row.
  const niche = b.niche
  const interests = b.interests
  const primary = context.goals.find((g) => g.is_primary)
  const count = (key: "goals" | "pillars" | "personas" | "problems" | "stories" | "winners", n: number) =>
    t.plural(key, n, { count: formatNumber(n) })
  const alsoSent: { label: string; href: string }[] = [
    { label: count("goals", context.goals.length), href: "/strategy/goals" },
    { label: count("pillars", context.pillars.length), href: "/pillars" },
    { label: count("personas", context.personas.length), href: "/audience" },
    { label: count("problems", context.problems.length), href: "/audience/problems" },
    { label: count("stories", context.stories.length), href: "/stories" },
    { label: count("winners", context.winners.length), href: "/winners" },
  ]
  const row = { onEdit }

  return (
    <section
      id="voice"
      aria-labelledby="voice-heading"
      className={cn("flex min-w-0 scroll-mt-16 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground", className)}
    >
      <div className="flex min-h-6 items-center justify-between gap-3 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <VOICE_ICON className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h3 id="voice-heading" className="text-sm leading-5 font-medium">
            {t("title")}
          </h3>
          <InfoHint title={t("title")}>
            <p>{t("description")}</p>
            <p>
              {t("also_sent")}{" "}
              {alsoSent.map((item, index) => (
                <Fragment key={item.href}>
                  {index ? " · " : ""}
                  <Link href={item.href} className="text-foreground underline-offset-2 hover:underline">
                    {item.label}
                  </Link>
                </Fragment>
              ))}
              {primary ? t("primary_goal", { name: primary.name }) : "."}
            </p>
            <Link href="/settings?tab=ai" className="w-fit font-medium text-foreground underline-offset-2 hover:underline">
              {t("see_context")}
            </Link>
          </InfoHint>
        </div>
        {dirty ? (
          <StatusPill tone="neutral" icon={PenLine}>
            {t("unsaved_edits")}
          </StatusPill>
        ) : null}
      </div>

      <dl className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <VoiceRow {...row} label={t("row_niche")} field="niche" empty={!niche && !interests.length}>
          {niche ? <span className="font-medium">{niche}</span> : <span className="text-muted-foreground italic">{t("no_niche")}</span>}
          {interests.length && (expanded || !niche) ? (
            <span className="mt-1.5 block">
              <Tokens values={interests} />
            </span>
          ) : null}
        </VoiceRow>
        <VoiceRow {...row} label={t("row_writes_as")} field="name" empty={!b.name}>
          <span className="font-medium">{b.name}</span>
          {writesAs ? <span className="text-muted-foreground"> — {writesAs}</span> : null}
          {b.industry && expanded ? <span className="block text-xs text-muted-foreground">{b.industry}</span> : null}
        </VoiceRow>
        <VoiceRow {...row} label={t("row_positioning")} field="positioning_audience" empty={!b.positioning_statement} clamp={!expanded}>
          {b.positioning_statement}
        </VoiceRow>
        <VoiceRow {...row} label={t("row_language")} field="tones" empty={false}>
          {LANGUAGE_MAP[b.language]?.label ?? b.language}
          {b.tones.length ? <span className="text-muted-foreground"> · {b.tones.join(", ")}</span> : null}
        </VoiceRow>
        {expanded ? (
          <>
            <VoiceRow {...row} label={t("row_personality")} field="personality_traits" empty={!b.personality.length}>
              <Tokens values={b.personality} />
            </VoiceRow>
            <VoiceRow {...row} label={t("row_expertise")} field="expertise_areas" empty={!b.expertise_areas.length}>
              <Tokens values={b.expertise_areas} />
            </VoiceRow>
            <VoiceRow {...row} label={t("row_known_for")} field="known_for" empty={!b.known_for} trimmedAt={trimmed("known_for")}>
              {b.known_for}
            </VoiceRow>
            <VoiceRow {...row} label={t("row_point_of_view")} field="point_of_view" empty={!b.point_of_view} trimmedAt={trimmed("point_of_view")}>
              {b.point_of_view}
            </VoiceRow>
            <VoiceRow {...row} label={t("row_always")} field="always_do" empty={!b.always_do} trimmedAt={trimmed("always_do")}>
              {b.always_do}
            </VoiceRow>
            <VoiceRow {...row} label={t("row_never")} field="never_do" empty={!b.never_do} trimmedAt={trimmed("never_do")}>
              {b.never_do}
            </VoiceRow>
            <VoiceRow {...row} label={t("row_says")} field="phrases_used" empty={!b.phrases_used.length}>
              <Tokens values={b.phrases_used} />
            </VoiceRow>
            <VoiceRow {...row} label={t("row_never_says")} field="phrases_avoid" empty={!b.phrases_avoid.length}>
              <Tokens values={b.phrases_avoid} strike />
            </VoiceRow>
            <VoiceRow {...row} label={t("row_cta")} field="cta_style" empty={!b.cta_style} trimmedAt={trimmed("cta_style")}>
              {b.cta_style}
            </VoiceRow>
            <VoiceRow {...row} label={t("row_storytelling")} field="storytelling_style" empty={!b.storytelling_style} trimmedAt={trimmed("storytelling_style")}>
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
          {expanded ? c("show_less") : c("show_more")}
        </Button>
      </dl>
    </section>
  )
}
