"use client"

import { MapPin, Star } from "lucide-react"
import Link from "next/link"
import { ColorDot, Meter, PlatformIcon, StatusPill } from "@/components/common"
import { PLATFORMS } from "@/lib/constants"
import type { AudiencePersona } from "@/lib/types"
import { cn, formatNumber, formatPercent } from "@/lib/utils"
import { personaCompleteness, RECENT_DAYS } from "./audience-model"
import { personaName, type PersonaActions } from "./persona-actions"
import { PersonaActionsMenu } from "./persona-actions-menu"

export interface PersonaStats {
  problems: number
  /** Problems with no idea or content yet. */
  untapped: number
  questions: number
  /** New or idea-created questions (not answered, not dismissed). */
  openQuestions: number
  /** Recent content targeting this persona, out of all recent dated content. */
  content: number
  contentTotal: number
}

function StatLink({ href, label, value, detail }: { href: string; label: string; value: number; detail: string }) {
  return (
    <Link
      href={href}
      className="relative z-10 flex min-w-0 flex-col gap-0.5 px-3 py-2 outline-none first:rounded-l-md hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-base leading-6 font-semibold num">{formatNumber(value)}</span>
      <span className="truncate text-xs text-muted-foreground">{detail}</span>
    </Link>
  )
}

/** Persona summary: identity, counts in the banks, share of recent content, platforms. */
export function PersonaCard({
  persona,
  stats,
  actions,
  onOpen,
}: {
  persona: AudiencePersona
  stats: PersonaStats
  actions: PersonaActions
  onOpen: () => void
}) {
  const name = personaName(persona)
  const share = stats.contentTotal ? (stats.content / stats.contentTotal) * 100 : null
  const completeness = personaCompleteness(persona)
  const meta = [persona.age_range ? `Age ${persona.age_range}` : "", persona.location].filter(Boolean).join(" · ")
  const goal = persona.goals[0]
  const pain = persona.problems[0] ?? persona.frustrations[0]

  return (
    <article
      className={cn(
        "group/card relative flex h-full min-w-0 flex-col rounded-lg border bg-card text-card-foreground transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm",
        "has-[[data-card-link]:focus-visible]:border-ring has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <ColorDot color={persona.color} className="mt-1.5 size-2.5" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm leading-5 font-semibold">
              <button
                type="button"
                data-card-link
                onClick={onOpen}
                className="text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
              >
                {name}
              </button>
            </h3>
            {/* Two-line slot so stat rows line up across a row of cards. */}
            <p className="mt-0.5 line-clamp-2 min-h-8 text-xs text-muted-foreground">{persona.profession}</p>
          </div>
          {persona.is_primary ? (
            <StatusPill icon={Star} title="Primary persona — ideas and AI drafts aim here first">
              Primary
            </StatusPill>
          ) : null}
          <div className="relative z-10 -mt-0.5 -mr-1.5">
            <PersonaActionsMenu persona={persona} actions={actions} onOpen={onOpen} />
          </div>
        </div>

        {meta ? (
          <p className="-mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate" title={meta}>
              {meta}
            </span>
          </p>
        ) : null}

        <div className="grid grid-cols-3 divide-x rounded-md border bg-muted/20 dark:bg-input/10">
          <StatLink
            href={`/audience/problems?persona=${persona.id}`}
            label="Problems"
            value={stats.problems}
            detail={stats.problems ? (stats.untapped ? `${formatNumber(stats.untapped)} untapped` : "All covered") : "None yet"}
          />
          <StatLink
            href={`/audience/questions?persona=${persona.id}`}
            label="Questions"
            value={stats.questions}
            detail={stats.questions ? `${formatNumber(stats.openQuestions)} open` : "None yet"}
          />
          <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2" title={`Content dated in the last ${RECENT_DAYS} days`}>
            <span className="truncate text-xs text-muted-foreground">Content share</span>
            <span className="text-base leading-6 font-semibold num">{share === null ? "—" : formatPercent(share, 0)}</span>
            <Meter
              size="sm"
              value={share ?? 0}
              color={persona.color}
              className="mt-1.5"
              aria-label={`${name}: share of recent content`}
              valueText={`${formatNumber(stats.content)} of ${formatNumber(stats.contentTotal)} pieces`}
            />
          </div>
        </div>

        {goal || pain ? (
          <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
            {goal ? (
              <>
                <dt className="text-muted-foreground">Wants</dt>
                <dd className="line-clamp-2">{goal}</dd>
              </>
            ) : null}
            {pain ? (
              <>
                <dt className="text-muted-foreground">Struggles</dt>
                <dd className="line-clamp-2">{pain}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
        {persona.platforms.length ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {persona.platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} label={PLATFORMS[platform].label} className="size-3.5" />
            ))}
          </span>
        ) : (
          <span>No platforms set</span>
        )}
        <span className="ml-auto shrink-0 num" title="How much of the persona profile is filled in">
          Profile {completeness}%
        </span>
      </div>
    </article>
  )
}
