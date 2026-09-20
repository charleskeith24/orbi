"use client"

import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { CopyButton, DefinitionList, KeyValue, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { buildBrandContext } from "@/lib/ai"
import { LANGUAGE_MAP } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useDb } from "@/lib/store"
import { cn, formatNumber } from "@/lib/utils"
import { aiMessages } from "./ai-messages"

const list = (values: string[], max = 4) =>
  values.length > max ? `${values.slice(0, max).join(", ")} +${values.length - max}` : values.join(", ")

/** What every AI request is told about the brand (spec §29) — summarised, with the raw JSON. */
export function BrandContextCard({ now }: { now: Date }) {
  const db = useDb()
  const t = useT(aiMessages)
  const c = useT(commonMessages)
  const count = (key: Parameters<typeof t.plural>[0], n: number) => t.plural(key, n, { count: formatNumber(n) })
  const [open, setOpen] = useState(false)
  const context = useMemo(() => buildBrandContext(db, now), [db, now])
  const json = useMemo(() => JSON.stringify(context, null, 2), [context])
  const size = useMemo(() => JSON.stringify(context).length, [context])

  const { brand } = context
  const primary = context.goals.find((g) => g.is_primary)
  const missing = [
    !brand.name && t("missing_name"),
    !brand.positioning_statement && t("missing_positioning"),
    !brand.known_for && t("missing_known_for"),
    !brand.point_of_view && t("missing_pov"),
    !brand.tones.length && t("missing_tone"),
  ].filter((v): v is string => Boolean(v))
  const topHooks = context.hook_performance.slice(0, 3).map((h) => (h.ratio !== null ? `${h.label} ${h.ratio}×` : h.label))

  return (
    <SectionCard
      title="Brand Context"
      info={t("context_info")}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/strategy">Brand HQ</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="num">{t("context_size", { kb: formatNumber(size / 1024), tokens: formatNumber(size / 4) })}</span>
          {missing.length ? (
            <StatusPill tone="warning">{t("missing", { fields: missing.join(", ") })}</StatusPill>
          ) : (
            <StatusPill tone="good">{t("complete")}</StatusPill>
          )}
        </div>

        <DefinitionList layout="vertical" columns={2}>
          <KeyValue label={t("kv_who")}>{[brand.name, brand.role, brand.brand_name].filter(Boolean).join(" · ") || t("not_set")}</KeyValue>
          <KeyValue label={t("kv_positioning")}>{brand.positioning_statement || t("not_set")}</KeyValue>
          <KeyValue label={t("kv_voice")}>
            {[LANGUAGE_MAP[brand.language]?.label, list(brand.tones, 3), list(brand.personality, 3)].filter(Boolean).join(" · ")}
          </KeyValue>
          <KeyValue label={t("kv_goals")}>
            {context.goals.length
              ? primary
                ? t("primary_goal", { goals: count("active_goals", context.goals.length), name: primary.name })
                : count("active_goals", context.goals.length)
              : t("none")}
          </KeyValue>
          <KeyValue label={t("kv_pillars")}>{context.pillars.length ? list(context.pillars.map((p) => p.name)) : t("none")}</KeyValue>
          <KeyValue label={t("kv_audience")}>
            {[count("personas", context.personas.length), count("problems", context.problems.length), count("questions", context.questions.length)].join(
              " · "
            )}
          </KeyValue>
          <KeyValue label={t("kv_platforms")}>
            {context.platforms.length
              ? list(context.platforms.map((p) => t("per_week", { label: p.label, count: p.posting_frequency })))
              : t("none_active")}
          </KeyValue>
          <KeyValue label={t("kv_works")}>
            {topHooks.length || context.winners.length
              ? [topHooks.length ? t("hooks", { hooks: topHooks.join(", ") }) : "", count("recent_winners", context.winners.length)]
                  .filter(Boolean)
                  .join(" · ")
              : t("not_enough")}
          </KeyValue>
          <KeyValue label={t("kv_memory")}>
            {t("memory", { stories: count("stories", context.stories.length), titles: count("recent_titles", context.recent_titles.length) })}
          </KeyValue>
          <KeyValue label={t("kv_rhythm")}>
            {t("rhythm", {
              slots: count("weekly_slots", context.schedule.length),
              target: context.settings.weekly_post_target,
              tofu: context.settings.funnel_targets.tofu,
              mofu: context.settings.funnel_targets.mofu,
              bofu: context.settings.funnel_targets.bofu,
            })}
          </KeyValue>
        </DefinitionList>

        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
                {open ? t("hide_json") : t("show_json")}
              </Button>
            </CollapsibleTrigger>
            {open ? <CopyButton text={json} label={c("copy")} variant="ghost" successMessage={t("context_copied")} /> : null}
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
