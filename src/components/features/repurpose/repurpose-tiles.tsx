"use client"

import { AlignLeft, CircleCheck, Lightbulb, Mail, Sparkles, Video, X } from "lucide-react"
import Link from "next/link"
import { useId } from "react"
import { PlatformIcon, StageIcon, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PLATFORMS, REPURPOSE_TYPE_IDS, REPURPOSE_TYPES } from "@/lib/constants"
import type { ContentRepurpose, RepurposeType } from "@/lib/types"
import { cn } from "@/lib/utils"
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
  const id = useId()
  const spec = REPURPOSE_TYPES[state.type]
  const [first, ...more] = state.created
  const suggestion = state.suggestion
  const where = spec.platform ? PLATFORMS[spec.platform].label : "Any platform"
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
          <span
            id={`${id}-desc`}
            className="mt-0.5 block text-xs text-pretty text-muted-foreground"
            title={spec.platform ? undefined : `Defaults to ${PLATFORMS[state.platform].label}, the source's platform — pick another on the draft.`}
          >
            {spec.description} · {where}
          </span>
        </label>
        {recommended ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] leading-5 font-medium text-brand">
            <Sparkles className="size-3" aria-hidden />
            Recommended
          </span>
        ) : state.samePlatform ? (
          <span className="shrink-0 text-[11px] leading-5 text-muted-foreground">Same platform</span>
        ) : null}
      </div>

      {first ? (
        <div className="flex min-w-0 items-center gap-2 pl-[26px]">
          <StatusPill tone="good" icon={CircleCheck}>
            {state.created.length > 1 ? `${state.created.length} created` : "Created"}
          </StatusPill>
          <Link
            href={`/studio/${first.id}`}
            title={`Open “${first.title || "Untitled content"}” in the Content Studio`}
            className="inline-flex min-w-0 items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <StageIcon stage={first.stage} className="size-3" />
            <span className="truncate">{first.title || "Untitled content"}</span>
          </Link>
          {more.length ? (
            <span className="shrink-0 text-xs text-muted-foreground num" title={more.map((i) => i.title || "Untitled content").join("\n")}>
              +{more.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {suggestion ? (
        <div className="flex min-w-0 items-center gap-1.5 pl-[26px]">
          <StatusPill tone="neutral" icon={Lightbulb}>
            Suggested
          </StatusPill>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={suggestion.title}>
            {suggestion.title}
          </span>
          <Button type="button" variant="ghost" size="xs" onClick={() => onReview(suggestion)}>
            Review
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={`Dismiss the ${spec.label} suggestion`}
                onClick={() => onDismiss(suggestion)}
              >
                <X aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dismiss suggestion</TooltipContent>
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
  return (
    <ul className="grid min-w-0 gap-2 @lg:grid-cols-2 @4xl:grid-cols-3" aria-label="Repurpose formats">
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
