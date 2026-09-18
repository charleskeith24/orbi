"use client"

import { Plus, Radio } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import {
  EmptyState,
  formatCategoryIcon,
  PageContainer,
  PageHeader,
  PageSection,
  PlatformIcon,
  type MultiSelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { translate, useT } from "@/lib/i18n"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions, useDb, useSettings } from "@/lib/store"
import type { PlatformId, PlatformStrategy } from "@/lib/types"
import { PausedPlatformCard, PlatformCard, type PlatformOptions } from "./platform-card"
import { PlatformPlanSummary } from "./platform-plan"
import { platformsMessages } from "./platforms-messages"
import { platformLabel, platformPlan, type PlatformPlanRow } from "./platforms-model"
import { StrategyTabs } from "./strategy-tabs"
import { useNow } from "./use-now"

type RowWithStrategy = PlatformPlanRow & { strategy: PlatformStrategy }
const hasStrategy = (row: PlatformPlanRow): row is RowWithStrategy => row.strategy !== null

function setUpPlatform(platform: PlatformId) {
  dataActions.insert("content_platforms", { platform, is_active: true })
  const lang = getUiLang()
  toast.success(translate(platformsMessages, lang, "added", { platform: platformLabel(platform) }), {
    description: translate(platformsMessages, lang, "added_description"),
  })
}

/** Strategy → Platforms (spec §15): per-platform strategy cards, the weekly plan vs target and 30-day performance. */
export function PlatformsView() {
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT(platformsMessages)

  const plan = useMemo(() => platformPlan(db, now, settings), [db, now, settings])
  const formats = db.content_formats
  const pillars = db.content_pillars
  const options = useMemo<PlatformOptions>(
    () => ({
      formats: [...formats]
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((f): MultiSelectOption => {
          const Icon = formatCategoryIcon(f.category)
          return { value: f.id, label: f.name || t("untitled_format"), icon: <Icon className="text-muted-foreground" aria-hidden /> }
        }),
      pillars: [...pillars]
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p): MultiSelectOption => ({ value: p.id, label: p.name || t("untitled_pillar"), color: p.color })),
    }),
    [formats, pillars, t]
  )

  const active = plan.rows.filter(hasStrategy).filter((r) => r.strategy.is_active)
  const paused = plan.rows.filter(hasStrategy).filter((r) => !r.strategy.is_active)
  const missing = plan.rows.filter((r) => !r.strategy)

  // `?open=<strategy id | platform>` scrolls to that card and highlights it briefly.
  const openKey = searchParams.get("open")
  const openPlatform = openKey ? (plan.rows.find((r) => r.strategy?.id === openKey || r.platform === openKey)?.platform ?? null) : null
  useEffect(() => {
    if (!openPlatform) return
    const frame = requestAnimationFrame(() =>
      document.getElementById(`platform-${openPlatform}`)?.scrollIntoView({ block: "start", behavior: "smooth" })
    )
    const timer = setTimeout(() => router.replace(pathname, { scroll: false }), 2600)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [openPlatform, router, pathname])

  return (
    <PageContainer>
      <PageHeader
        title="Platform Strategy"
        icon={Radio}
        description={t("description")}
      >
        <StrategyTabs />
      </PageHeader>

      <PlatformPlanSummary plan={plan} />

      <PageSection
        title={t("active_title")}
        description={t("active_description")}
      >
        {active.length ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {active.map((row) => (
              <PlatformCard key={row.strategy.id} row={row} options={options} highlighted={openPlatform === row.platform} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Radio}
            title={t("empty_title")}
            description={t("empty_description")}
          />
        )}
      </PageSection>

      {paused.length || missing.length ? (
        <PageSection
          title={t("paused_title")}
          description={t("paused_description")}
        >
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {paused.map((row) => (
              <PausedPlatformCard key={row.strategy.id} row={row} />
            ))}
            {missing.map((row) => (
              <div key={row.platform} id={`platform-${row.platform}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-dashed bg-card/50 p-4">
                <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card dark:bg-input/30">
                    <PlatformIcon platform={row.platform} />
                  </span>
                  {platformLabel(row.platform)}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setUpPlatform(row.platform)}>
                  <Plus aria-hidden />
                  {t("set_up")}
                </Button>
              </div>
            ))}
          </div>
        </PageSection>
      ) : null}
    </PageContainer>
  )
}
