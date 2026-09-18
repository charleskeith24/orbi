"use client"

import { AlignLeft, BookOpen, ImageIcon, Mic, Radio, Video, X, type LucideIcon } from "lucide-react"
import { catVar } from "@/components/common/color"
import { entityBadgeMessages } from "@/components/common/messages"
import { FORMAT_CATEGORY_MAP } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useRow } from "@/lib/store"
import type {
  AudiencePersona,
  CategoricalColor,
  ContentCampaign,
  ContentFormat,
  ContentPillar,
  FormatCategory,
  ID,
  Tag,
  TagColor,
} from "@/lib/types"
import { cn } from "@/lib/utils"

/* ------------------------------ Format icons ------------------------------ */

export const FORMAT_CATEGORY_ICONS: Record<FormatCategory, LucideIcon> = {
  video: Video,
  text: AlignLeft,
  visual: ImageIcon,
  audio: Mic,
  long_form: BookOpen,
  live: Radio,
}

/** Icon component for a format category (for option lists and maps). */
export function formatCategoryIcon(category: FormatCategory | null | undefined): LucideIcon {
  return (category && FORMAT_CATEGORY_ICONS[category]) || AlignLeft
}

/** Format category glyph, safe to render inline (static per category). Decorative. */
export function FormatCategoryIcon({
  category,
  className,
  strokeWidth,
}: {
  category: FormatCategory | null | undefined
  className?: string
  strokeWidth?: number
}) {
  const props = { className, strokeWidth, "aria-hidden": true }
  switch (category) {
    case "video":
      return <Video {...props} />
    case "visual":
      return <ImageIcon {...props} />
    case "audio":
      return <Mic {...props} />
    case "long_form":
      return <BookOpen {...props} />
    case "live":
      return <Radio {...props} />
    default:
      return <AlignLeft {...props} />
  }
}

/* ------------------------------- Base chip -------------------------------- */

type BadgeSize = "sm" | "md"
type BadgeVariant = "outline" | "plain"

function IdentityChip({
  color,
  shape = "circle",
  label,
  muted = false,
  size = "sm",
  variant = "outline",
  className,
  title,
}: {
  color?: CategoricalColor | TagColor | null
  shape?: "circle" | "square"
  label: React.ReactNode
  muted?: boolean
  size?: BadgeSize
  variant?: BadgeVariant
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit max-w-full min-w-0 shrink-0 items-center gap-1.5 font-medium whitespace-nowrap",
        size === "sm" ? "text-xs" : "text-sm",
        variant === "outline" && "rounded-md border bg-card dark:bg-input/30",
        variant === "outline" && (size === "sm" ? "h-5 px-1.5" : "h-6 px-2"),
        muted ? "text-muted-foreground" : "text-foreground/90",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-2 shrink-0",
          shape === "circle" ? "rounded-full" : "rounded-[2.5px]",
          muted && "border border-dashed border-muted-foreground/60"
        )}
        style={muted ? undefined : { backgroundColor: catVar(color) }}
      />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}

interface EntityBadgeProps {
  size?: BadgeSize
  variant?: BadgeVariant
  className?: string
  /** Text shown when the entity is missing. */
  emptyLabel?: string
}

/** Pillar dot + name. Pass `pillar` directly or a `pillarId` to read from the store. */
export function PillarBadge({
  pillarId,
  pillar,
  emptyLabel,
  ...rest
}: EntityBadgeProps & { pillarId?: ID | null; pillar?: ContentPillar | null }) {
  const t = useT(entityBadgeMessages)
  const stored = useRow("content_pillars", pillar === undefined ? pillarId : null)
  const row = pillar === undefined ? stored : pillar
  if (!row) return <IdentityChip label={emptyLabel ?? t("no_pillar")} muted {...rest} />
  return <IdentityChip color={row.color} label={row.name || t("untitled_pillar")} title={row.description || undefined} {...rest} />
}

/** Persona dot + name. */
export function PersonaBadge({
  personaId,
  persona,
  emptyLabel,
  ...rest
}: EntityBadgeProps & { personaId?: ID | null; persona?: AudiencePersona | null }) {
  const t = useT(entityBadgeMessages)
  const stored = useRow("audience_personas", persona === undefined ? personaId : null)
  const row = persona === undefined ? stored : persona
  if (!row) return <IdentityChip label={emptyLabel ?? t("no_persona")} muted {...rest} />
  return <IdentityChip color={row.color} label={row.name || t("untitled_persona")} {...rest} />
}

/** Campaign square swatch + name (square distinguishes campaigns from pillars). */
export function CampaignBadge({
  campaignId,
  campaign,
  emptyLabel,
  ...rest
}: EntityBadgeProps & { campaignId?: ID | null; campaign?: ContentCampaign | null }) {
  const t = useT(entityBadgeMessages)
  const stored = useRow("content_campaigns", campaign === undefined ? campaignId : null)
  const row = campaign === undefined ? stored : campaign
  if (!row) return <IdentityChip label={emptyLabel ?? t("no_campaign")} shape="square" muted {...rest} />
  return <IdentityChip color={row.color} shape="square" label={row.name || t("untitled_campaign")} {...rest} />
}

/* ---------------------------------- Tags ---------------------------------- */

/** `#tag` chip with a colour dot; `onRemove` adds a remove button. */
export function TagChip({
  tag,
  name,
  color,
  onRemove,
  className,
}: {
  tag?: Pick<Tag, "name" | "color">
  name?: string
  color?: TagColor
  onRemove?: () => void
  className?: string
}) {
  const t = useT(entityBadgeMessages)
  const label = tag?.name ?? name ?? ""
  const swatch = tag?.color ?? color ?? "gray"
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full min-w-0 shrink-0 items-center gap-1 rounded-md border bg-card text-xs text-foreground/85 dark:bg-input/30",
        onRemove ? "pr-0.5 pl-1.5" : "px-1.5",
        className
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: catVar(swatch) }} />
      <span className="min-w-0 truncate">
        <span className="text-muted-foreground">#</span>
        {label}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("remove_tag", { name: label })}
          className="flex size-4 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </span>
  )
}

/** Tag chips with a "+N" overflow token. */
export function TagList({ tags, max = 3, className }: { tags: Tag[]; max?: number; className?: string }) {
  const t = useT(entityBadgeMessages)
  if (!tags.length) return null
  const shown = tags.slice(0, max)
  const hidden = tags.slice(max)
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {hidden.length ? (
        <span
          title={hidden.map((tag) => `#${tag.name}`).join(", ")}
          className="inline-flex h-5 items-center rounded-md px-1 text-xs text-muted-foreground"
        >
          <span aria-hidden>+{hidden.length}</span>
          <span className="sr-only">{t("and_more", { tags: hidden.map((tag) => `#${tag.name}`).join(", ") })}</span>
        </span>
      ) : null}
    </span>
  )
}

/* --------------------------------- Formats -------------------------------- */

/** Format name with its category glyph (video / text / visual …). */
export function FormatLabel({
  formatId,
  format,
  showIcon = true,
  emptyLabel,
  className,
}: {
  formatId?: ID | null
  format?: ContentFormat | null
  showIcon?: boolean
  emptyLabel?: string
  className?: string
}) {
  const t = useT(entityBadgeMessages)
  const stored = useRow("content_formats", format === undefined ? formatId : null)
  const row = format === undefined ? stored : format
  return (
    <span
      title={row ? FORMAT_CATEGORY_MAP[row.category]?.label : undefined}
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      {showIcon ? <FormatCategoryIcon category={row?.category} className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{row?.name || (emptyLabel ?? t("no_format"))}</span>
    </span>
  )
}
