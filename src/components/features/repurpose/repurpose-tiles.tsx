"use client"

import { AlignLeft, CircleCheck, Lightbulb, Mail, Sparkles, Video, X } from "lucide-react"
import Link from "next/link"
import { useId } from "react"
import { PlatformIcon, StageIcon, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/lib/i18n"
import { PLATFORMS, REPURPOSE_TYPE_IDS, REPURPOSE_TYPES } from "@/lib/constants"
import type { ContentRepurpose, RepurposeType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { repurposeMessages } from "./messages"
import type { TileState } from "./repurpose-model"

interface TileActions {
  onToggle: (type: RepurposeType) => void
  onReview: (row: ContentRepurpose) => void
  onDismiss: (row: ContentRepurpose) => void
}

function RepurposeTile({
  state,
  checked,
  recommended,
  generating,
  disabled,
  onToggle,
  onReview,
  onDismiss,
}: TileActions & { state: TileState; checked: boolean; recommended: boolean; generating: boolean; disabled: boolean }) {
  const t = useT(repurposeMessages)
  const id = useId()
  const spec = REPURPOSE_TYPES[state.type]
  const [first, ...more] = state.created
  const suggestion = state.suggestion
  const where = spec.platform ? PLATFORMS[spec.platform].label : t("any_platform")
  const Glyph = spec.scriptFormat === "newsletter" ? Mail : spec.scriptFormat === "short_video" ? Video : AlignLeft

  return (
    <li
      data-selected={checked || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2.5 transition-colors",
        checked && "border-brand/45 bg-brand-soft"
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={() => onToggle(state.type)}
          aria-describedby={`${id}-desc`}
          className="mt-0.5"
        />
        <label htmlFor={id} className={cn("min-w-0 flex-1 select-none", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          <span className="flex min-w-0 items-center gap-1.5">
            {spec.platform ? (
              <PlatformIcon platform={spec.platform} className="size-3.5 text-muted-foreground" />
            ) : (
              <Glyph className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="truncate text-sm font-medium">{spec.label}</span>
            {generating ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
          </span>
          {/* Where it goes out stays visible; what the format is, is the tooltip (and read to screen readers). */}
          <span
            id={`${id}-desc`}
            className="mt-0.5 block text-xs text-pretty text-muted-foreground"
            title={spec.platform ? spec.description : `${spec.description} · ${t("defaults_to", { platform: PLATFORMS[state.platform].label })}`}
          >
            <span className="sr-only">{spec.description} · </span>
            {where}
          </span>
        </label>
        {recommended ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] leading-5 font-medium text-brand">
            <Sparkles className="size-3" aria-hidden />
            {t("recommended")}
          </span>
        ) : state.samePlatform ? (
          <span className="shrink-0 text-[11px] leading-5 text-muted-foreground">{t("same_platform")}</span>
        ) : null}
      </div>

      {first ? (
        <div className="flex min-w-0 items-center gap-2 pl-[26px]">
          <StatusPill tone="good" icon={CircleCheck}>
            {state.created.length > 1 ? t("created_count", { count: state.created.length }) : t("created")}
          </StatusPill>
          <Link
            href={`/studio/${first.id}`}
            title={t("open_title", { title: first.title || t("untitled_content") })}
            className="inline-flex min-w-0 items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <StageIcon stage={first.stage} className="size-3" />
            <span className="truncate">{first.title || t("untitled_content")}</span>
          </Link>
          {more.length ? (
            <span className="shrink-0 text-xs text-muted-foreground num" title={more.map((i) => i.title || t("untitled_content")).join("\n")}>
              +{more.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {suggestion ? (
        <div className="flex min-w-0 items-center gap-1.5 pl-[26px]">
          <StatusPill tone="neutral" icon={Lightbulb}>
            {t("suggested")}
          </StatusPill>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={suggestion.title}>
            {suggestion.title}
          </span>
          <Button type="button" variant="ghost" size="xs" onClick={() => onReview(suggestion)}>
            {t("review")}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={t("dismiss_suggestion_aria", { type: spec.label })}
                onClick={() => onDismiss(suggestion)}
              >
                <X aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("dismiss_suggestion")}</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
    </li>
  )
}

/** One selectable tile per REPURPOSE_TYPES entry, showing what already exists for this source. */
export function RepurposeTiles({
  states,
  selected,
  recommended,
  generating,
  disabled = false,
  ...actions
}: TileActions & {
  states: Record<RepurposeType, TileState>
  selected: Set<RepurposeType>
  recommended: Set<RepurposeType>
  generating: Set<RepurposeType>
  disabled?: boolean
}) {
  const t = useT(repurposeMessages)
  return (
    <ul className="grid min-w-0 gap-2 @lg:grid-cols-2 @4xl:grid-cols-3" aria-label={t("formats_label")}>
      {REPURPOSE_TYPE_IDS.map((type) => (
        <RepurposeTile
          key={type}
          state={states[type]}
          checked={selected.has(type)}
          recommended={recommended.has(type)}
          generating={generating.has(type)}
          disabled={disabled}
          {...actions}
        />
      ))}
    </ul>
  )
}
