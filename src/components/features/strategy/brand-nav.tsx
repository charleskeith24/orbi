"use client"

import { ArrowRight, CircleCheck } from "lucide-react"
import { InfoHint, Meter } from "@/components/common"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { SECTION_ICONS, VOICE_ICON } from "./brand-icons"
import { brandHqMessages, brandSectionMessages } from "./brand-messages"
import { BRAND_SECTIONS, type BrandCompleteness, type BrandSectionKey, type CompletenessItem } from "./brand-model"

/** "86% complete" + meter, why it matters behind the ⓘ, and a jump to the next gap. */
export function CompletenessCard({
  completeness,
  onNext,
  className,
}: {
  completeness: BrandCompleteness
  onNext: (item: CompletenessItem) => void
  className?: string
}) {
  const next = completeness.missing[0]
  const t = useT(brandHqMessages)
  const ts = useT(brandSectionMessages)
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5", className)}>
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="font-medium num">{completeness.pct}%</span>
        <span className="truncate text-muted-foreground">{t("complete")}</span>
        <InfoHint title="Brand HQ" className="ml-auto">
          {next ? t("complete_hint") : t("complete_done")}
        </InfoHint>
      </div>
      <Meter
        value={completeness.done}
        max={completeness.total}
        tone={next ? "brand" : "good"}
        size="sm"
        valueText={`${completeness.pct}%`}
        aria-label={t("completeness_label")}
      />
      {next ? (
        <button
          type="button"
          onClick={() => onNext(next)}
          className="group/next flex min-w-0 items-center gap-1 rounded-sm text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="shrink-0 text-muted-foreground">{t("next")}</span>
          <span className="truncate font-medium text-foreground group-hover/next:underline">{ts(`check_${next.field}`)}</span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

const itemClass =
  "flex h-8 min-w-0 items-center gap-2 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * Section switcher: a sticky vertical list on desktop, a sideways-scrolling row on smaller screens. One section
 * shows at a time (`#<key>` in the URL). "Brand Voice" (below the form until xl) scrolls to the preview.
 */
export function BrandSectionNav({
  active,
  completeness,
  dirtySections,
  onSelect,
  onVoice,
}: {
  active: BrandSectionKey
  completeness: BrandCompleteness
  dirtySections: ReadonlySet<BrandSectionKey>
  onSelect: (key: BrandSectionKey) => void
  onVoice: () => void
}) {
  const t = useT(brandHqMessages)
  const ts = useT(brandSectionMessages)
  return (
    <nav aria-label={t("sections_label")} className="-mx-4 min-w-0 md:-mx-6 lg:mx-0">
      <ul className="flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-thin md:px-6 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {BRAND_SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section.key]
          const progress = completeness.sections[section.key]
          const complete = progress.done >= progress.total
          const isActive = active === section.key
          return (
            <li key={section.key} className="shrink-0">
              <a
                href={`#${section.key}`}
                aria-current={isActive ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  onSelect(section.key)
                }}
                className={cn(
                  itemClass,
                  isActive ? "bg-muted font-medium text-foreground dark:bg-input/40" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0", isActive && "text-brand")} aria-hidden />
                <span className="truncate">{ts(`${section.key}_nav`)}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
                  {dirtySections.has(section.key) ? (
                    <>
                      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                      <span className="sr-only">{t("unsaved_sr")}</span>
                    </>
                  ) : null}
                  {complete ? (
                    <CircleCheck className="size-3.5 text-good-fg" aria-label={t("section_complete")} />
                  ) : (
                    <span className="hidden text-xs text-muted-foreground num lg:inline">
                      {progress.done}/{progress.total}
                      <span className="sr-only">{t("section_complete_sr")}</span>
                    </span>
                  )}
                </span>
              </a>
            </li>
          )
        })}
        <li className="shrink-0 xl:hidden">
          <a
            href="#voice"
            onClick={(event) => {
              event.preventDefault()
              onVoice()
            }}
            className={cn(itemClass, "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
          >
            <VOICE_ICON className="size-4 shrink-0" aria-hidden />
            <span>Brand Voice</span>
          </a>
        </li>
      </ul>
    </nav>
  )
}
