"use client"

import {
  ChevronDown,
  Compass,
  Filter,
  Flag,
  Layers,
  Library,
  MessageCircleQuestion,
  Share2,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { ColorDot, PlatformIcon, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useLookup } from "@/lib/store"
import type { CategoricalColor } from "@/lib/types"
import { cn } from "@/lib/utils"
import { contextChipMessages } from "./strategist-messages"
import type { ContextChip, ContextKey } from "./turns"

const CHIP_ICONS: Record<ContextKey, LucideIcon> = {
  positioning: Compass,
  audience: Users,
  goal: Flag,
  platform: Share2,
  pillar: Layers,
  funnel: Filter,
  performance: TrendingUp,
  content: Library,
  problems: MessageCircleQuestion,
  winners: Trophy,
}

/** Audience and goal chips show just the entity — the icon says which; everything else shows its label. */
function chipText(chip: ContextChip): string {
  if (chip.key !== "audience" && chip.key !== "goal") return chip.label
  return chip.label.split(" · ").slice(1).join(" · ") || chip.label
}

function ChipGlyph({ chip, color }: { chip: ContextChip; color: CategoricalColor | null }) {
  if (chip.platform) return <PlatformIcon platform={chip.platform} className="size-3" />
  if (chip.key === "pillar" && color) return <ColorDot color={color} />
  const Icon = CHIP_ICONS[chip.key]
  return <Icon className="size-3" aria-hidden />
}

/** "Considered" chips under an answer (spec §57); Details lists the specifics behind each one. */
export function ContextChips({ chips, visible = 4 }: { chips: ContextChip[]; visible?: number }) {
  const [open, setOpen] = useState(false)
  const pillars = useLookup("content_pillars")
  const t = useT(contextChipMessages)
  if (!chips.length) return null
  const colorOf = (chip: ContextChip) => (chip.pillar_id ? (pillars.get(chip.pillar_id)?.color ?? null) : null)
  const hidden = Math.max(0, chips.length - visible)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-xs text-muted-foreground">{t("considered")}</span>
        {chips.slice(0, visible).map((chip) => (
          <Token key={chip.key} title={`${chip.label} — ${chip.detail}`} className="max-w-[12rem] font-normal text-muted-foreground">
            <ChipGlyph chip={chip} color={colorOf(chip)} />
            <span className="truncate">
              {chipText(chip) !== chip.label ? <span className="sr-only">{t(`title_${chip.key}`)}: </span> : null}
              {chipText(chip)}
            </span>
          </Token>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="h-5 px-1.5 text-muted-foreground"
        >
          {open ? t("hide_details") : hidden ? t("more_details", { count: hidden }) : t("details")}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      {open ? (
        <ul aria-label={t("list_label")} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2.5">
          {chips.map((chip) => (
            <li key={chip.key} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="flex h-[1.1rem] w-3.5 shrink-0 items-center justify-center text-muted-foreground">
                <ChipGlyph chip={chip} color={colorOf(chip)} />
              </span>
              <p className="min-w-0 text-pretty">
                <span className="font-medium">{chip.label}</span>
                {chip.detail ? <span className="text-muted-foreground"> — {chip.detail}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
