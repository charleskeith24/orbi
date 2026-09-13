"use client"

import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { CopyButton, DefinitionList, KeyValue, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { buildBrandContext } from "@/lib/ai"
import { LANGUAGE_MAP } from "@/lib/constants"
import { useDb } from "@/lib/store"
import { cn, formatNumber, pluralize } from "@/lib/utils"

const list = (values: string[], max = 4) =>
  values.length > max ? `${values.slice(0, max).join(", ")} +${values.length - max}` : values.join(", ")

/** What every AI request is told about the brand (spec §29) — summarised, with the raw JSON. */
export function BrandContextCard({ now }: { now: Date }) {
  const db = useDb()
  const [open, setOpen] = useState(false)
  const context = useMemo(() => buildBrandContext(db, now), [db, now])
  const json = useMemo(() => JSON.stringify(context, null, 2), [context])
  const size = useMemo(() => JSON.stringify(context).length, [context])

  const { brand } = context
  const primary = context.goals.find((g) => g.is_primary)
  const missing = [
    !brand.name && "your name",
    !brand.positioning_statement && "positioning statement",
    !brand.known_for && "what you want to be known for",
    !brand.point_of_view && "point of view",
    !brand.tones.length && "tone",
  ].filter((v): v is string => Boolean(v))
  const topHooks = context.hook_performance.slice(0, 3).map((h) => (h.ratio !== null ? `${h.label} ${h.ratio}×` : h.label))

  return (
    <SectionCard
      title="Brand Context"
      description="Sent with every AI request so drafts sound like you. Each request re-ranks stories, problems and questions by relevance to what you asked."
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/strategy">Brand HQ</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="num">
            ≈ {formatNumber(size / 1024)} KB · ~{formatNumber(size / 4)} tokens
          </span>
          {missing.length ? (
            <StatusPill tone="warning">Missing from Brand HQ: {missing.join(", ")}</StatusPill>
          ) : (
            <StatusPill tone="good">Brand HQ essentials complete</StatusPill>
          )}
        </div>

        <DefinitionList layout="vertical" columns={2}>
          <KeyValue label="Who you are">
            {[brand.name, brand.role, brand.brand_name].filter(Boolean).join(" · ") || "Not set"}
          </KeyValue>
          <KeyValue label="Positioning">{brand.positioning_statement || "Not set"}</KeyValue>
          <KeyValue label="Voice">
            {[LANGUAGE_MAP[brand.language]?.label, list(brand.tones, 3), list(brand.personality, 3)].filter(Boolean).join(" · ")}
          </KeyValue>
          <KeyValue label="Goals">
            {context.goals.length ? `${pluralize(context.goals.length, "active goal")}${primary ? ` · primary: ${primary.name}` : ""}` : "None"}
          </KeyValue>
          <KeyValue label="Content pillars">{context.pillars.length ? list(context.pillars.map((p) => p.name)) : "None"}</KeyValue>
          <KeyValue label="Audience">
            {`${pluralize(context.personas.length, "persona")} · ${pluralize(context.problems.length, "problem")} · ${pluralize(context.questions.length, "question")}`}
          </KeyValue>
          <KeyValue label="Platforms">
            {context.platforms.length
              ? list(context.platforms.map((p) => `${p.label} ${p.posting_frequency}/wk`))
              : "None active"}
          </KeyValue>
          <KeyValue label="What works">
            {topHooks.length || context.winners.length
              ? [topHooks.length ? `Hooks: ${topHooks.join(", ")}` : "", pluralize(context.winners.length, "recent winner")]
                  .filter(Boolean)
                  .join(" · ")
              : "Not enough analytics yet"}
          </KeyValue>
          <KeyValue label="Memory">
            {`${pluralize(context.stories.length, "story", "stories")} · ${pluralize(context.recent_titles.length, "recent title")} (so ideas don't repeat)`}
          </KeyValue>
          <KeyValue label="Rhythm & targets">
            {`${pluralize(context.schedule.length, "weekly slot")} · ${context.settings.weekly_post_target} posts/week · funnel ${context.settings.funnel_targets.tofu}/${context.settings.funnel_targets.mofu}/${context.settings.funnel_targets.bofu}`}
          </KeyValue>
        </DefinitionList>

        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
                {open ? "Hide the exact JSON" : "Show the exact JSON"}
              </Button>
            </CollapsibleTrigger>
            {open ? <CopyButton text={json} label="Copy" variant="ghost" successMessage="Brand Context copied" /> : null}
          </div>
          <CollapsibleContent>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed scrollbar-thin">
              {json}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </SectionCard>
  )
}
