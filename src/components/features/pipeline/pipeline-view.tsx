"use client"

import { Plus, SquareKanban } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { ReadOnlyNotice } from "@/components/features/team/team-ui"
import { useIsMobile } from "@/hooks/use-mobile"
import { computeTiers, contentBuffer, pipelineCounts } from "@/lib/analytics"
import { getUiLang, translate, useT, useUiLang } from "@/lib/i18n"
import { dataActions, useDb, useSettings } from "@/lib/store"
import type { ID, PerformanceTier, PipelineStage } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  buildColumns,
  cardDomId,
  columnDomId,
  hasActiveFilters,
  isOnBoard,
  knownOwners,
  matchesFilters,
  quickAddDefaults,
  STAGE_IDS,
} from "./board-model"
import { pipelineCardMessages, pipelineMessages } from "./messages"
import { MOBILE_STAGE_LIST_ID, MobileBoard } from "./mobile-board"
import { PipelineActionsProvider } from "./pipeline-actions"
import { PipelineBoard } from "./pipeline-board"
import { ColumnsMenu, PipelineFilterBar } from "./pipeline-filter-bar"
import { BufferStat, StageRail } from "./pipeline-summary"
import { useCollapsedStages } from "./use-collapsed-stages"
import { useNow } from "./use-now"
import { replaceSearchParams, usePipelineFilters } from "./use-pipeline-filters"

const BOARD_MIN_HEIGHT = 420
/** The page container's bottom padding (md:p-6). */
const BOARD_BOTTOM_GAP = 24

const parseStage = (value: string | null): PipelineStage | null =>
  value && STAGE_IDS.includes(value as PipelineStage) ? (value as PipelineStage) : null

const flashTimers = new WeakMap<Element, number>()

/** Brief ring on a column the user jumped to (a data attribute, so no re-render). */
function flash(element: HTMLElement) {
  element.setAttribute("data-flash", "")
  window.clearTimeout(flashTimers.get(element))
  flashTimers.set(
    element,
    window.setTimeout(() => element.removeAttribute("data-flash"), 1200)
  )
}

/** Fits the board to the viewport so columns scroll inside it instead of the page. */
function useBoardHeight(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return
    const update = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      setHeight(Math.max(BOARD_MIN_HEIGHT, Math.floor(window.innerHeight - top - BOARD_BOTTOM_GAP)))
    }
    // Reports once on observe, then whenever anything above the board changes height.
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [enabled])
  return [ref, enabled ? height : null] as const
}

/**
 * Pipeline (spec §18, §55; Calm UI): the title with its ⓘ, the Content Buffer as one inline stat (breakdown in
 * its ⓘ), a quiet stage rail and the 13-column Kanban. New content comes from the top bar's New menu.
 * URL: `?open=<itemId>` reveals and highlights a card, `?stage=<stage>` jumps to a column
 * (the selected stage on phones), facet filters are `?platform=…&pillar=…&owner=…`.
 */
export function PipelineView() {
  return (
    <PipelineActionsProvider>
      <PipelineScreen />
    </PipelineActionsProvider>
  )
}

function PipelineScreen() {
  const t = useT(pipelineMessages)
  const lang = useUiLang()
  const isMobile = useIsMobile()
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("open")
  const stageParam = parseStage(searchParams.get("stage"))
  const { filters, setQ, setFacet, reset } = usePipelineFilters()
  const { collapsed, setCollapsed, setAll } = useCollapsedStages()
  const [quickAdd, setQuickAdd] = useState<PipelineStage | null>(null)
  const [boardRef, boardHeight] = useBoardHeight(!isMobile)

  const items = db.content_items
  const counts = useMemo(() => pipelineCounts(db, now), [db, now])
  const buffer = useMemo(() => contentBuffer(db, now, settings, lang), [db, now, settings, lang])
  const tiers = useMemo(() => {
    const out = new Map<ID, PerformanceTier>()
    for (const [id, info] of computeTiers(db, settings, now)) out.set(id, info.tier)
    return out
  }, [db, settings, now])
  // A card opened via ?open stays on the board even when it's an older published post.
  const pool = useMemo(
    () => items.filter((item) => item.id === highlightId || isOnBoard(item, now)),
    [items, highlightId, now]
  )
  const columns = useMemo(() => buildColumns(pool, filters, now), [pool, filters, now])
  const owners = useMemo(() => knownOwners(items, settings.default_owner), [items, settings.default_owner])
  const defaults = useMemo(() => quickAddDefaults(filters), [filters])
  const filtered = hasActiveFilters(filters)
  const shown = STAGE_IDS.reduce((total, stage) => total + columns[stage].items.length, 0)
  const openItem = highlightId ? items.find((item) => item.id === highlightId) : undefined
  const [defaultMobileStage] = useState<PipelineStage>(
    () => STAGE_IDS.find((stage) => columns[stage].items.length > 0) ?? "idea"
  )
  const mobileStage = openItem?.stage ?? stageParam ?? defaultMobileStage

  const selectMobileStage = useCallback((stage: PipelineStage) => {
    replaceSearchParams((params) => {
      params.set("stage", stage)
      params.delete("open")
    })
  }, [])

  const jumpToStage = useCallback(
    (stage: PipelineStage, behavior: ScrollBehavior = "smooth") => {
      if (isMobile) {
        selectMobileStage(stage)
        document.getElementById(MOBILE_STAGE_LIST_ID)?.scrollIntoView({ behavior, block: "start" })
        return
      }
      setCollapsed(stage, false)
      requestAnimationFrame(() => {
        const column = document.getElementById(columnDomId(stage))
        if (!column) return
        column.scrollIntoView({ behavior, block: "nearest", inline: "start" })
        flash(column)
      })
    },
    [isMobile, selectMobileStage, setCollapsed]
  )

  const startQuickAdd = useCallback(
    (stage: PipelineStage) => {
      setQuickAdd(stage)
      jumpToStage(stage)
    },
    [jumpToStage]
  )

  // ?stage=<stage> on desktop: bring that column into view (phones select it instead).
  // Instant on load — a smooth scroll can be cut short while the board settles its height.
  const revealStage = useEffectEvent((stage: PipelineStage) => {
    if (!isMobile) jumpToStage(stage, "auto")
  })
  useEffect(() => {
    if (stageParam) revealStage(stageParam)
  }, [stageParam])

  // ?open=<id>: clear filters that hide the card, expand its column, scroll to it and focus it.
  const revealCard = useEffectEvent((id: ID) => {
    const item = dataActions.getDb().content_items.find((row) => row.id === id)
    if (!item) {
      toast.error(translate(pipelineCardMessages, getUiLang(), "not_found"))
      replaceSearchParams((params) => params.delete("open"))
      return
    }
    if (!matchesFilters(item, filters)) reset()
    if (isMobile) replaceSearchParams((params) => params.set("stage", item.stage))
    else setCollapsed(item.stage, false)
    let frames = 0
    let handle = 0
    const focusCard = () => {
      const card = document.getElementById(cardDomId(id))
      if (!card) {
        if (frames++ < 30) handle = requestAnimationFrame(focusCard)
        return
      }
      card.scrollIntoView({ behavior: "auto", block: "center", inline: "center" })
      card.querySelector<HTMLElement>("[data-card-link]")?.focus({ preventScroll: true })
    }
    handle = requestAnimationFrame(focusCard)
    return () => cancelAnimationFrame(handle)
  })
  useEffect(() => (highlightId ? revealCard(highlightId) : undefined), [highlightId])

  // The highlight (and ?open) clears on Escape or the next click outside the card.
  useEffect(() => {
    if (!highlightId) return
    const clear = () => replaceSearchParams((params) => params.delete("open"))
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(`[id="${cardDomId(highlightId)}"]`)) return
      clear()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true)
      document.addEventListener("keydown", onKeyDown)
    }, 400)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [highlightId])

  return (
    <PageContainer width="wide" className="gap-4">
      <PageHeader
        title="Pipeline"
        info={t("info")}
        actions={<BufferStat buffer={buffer} empty={items.length === 0} onJump={jumpToStage} />}
      >
        {isMobile || items.length === 0 ? null : <StageRail counts={counts} onJump={jumpToStage} />}
      </PageHeader>

      <ReadOnlyNotice table="content_items" />

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={SquareKanban}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button type="button" size="sm" onClick={() => startQuickAdd("idea")}>
              <Plus aria-hidden />
              {t("quick_add_idea")}
            </Button>
          }
          secondaryAction={
            <Button asChild size="sm" variant="outline">
              <Link href="/ideas">{t("open_idea_bank")}</Link>
            </Button>
          }
          className="rounded-lg border border-dashed bg-card/50"
        />
      ) : null}

      <PipelineFilterBar
        pool={pool}
        owners={owners}
        filters={filters}
        shown={shown}
        onSearch={setQ}
        onFacet={setFacet}
        onReset={reset}
        compact={isMobile}
        actions={
          isMobile ? null : (
            <ColumnsMenu columns={columns} collapsed={collapsed} onToggle={setCollapsed} onSetAll={setAll} />
          )
        }
      />

      {isMobile ? (
        <MobileBoard
          columns={columns}
          stage={mobileStage}
          onStageChange={selectMobileStage}
          filtered={filtered}
          now={now}
          tiers={tiers}
          highlightId={highlightId}
          quickAdd={quickAdd}
          quickAddDefaults={defaults}
          onQuickAdd={setQuickAdd}
          onResetFilters={reset}
        />
      ) : (
        <div
          ref={boardRef}
          className={cn("min-h-0", boardHeight === null && "h-[calc(100svh-18rem)] min-h-[26rem]")}
          style={boardHeight === null ? undefined : { height: boardHeight }}
        >
          <PipelineBoard
            columns={columns}
            collapsed={collapsed}
            filtered={filtered}
            now={now}
            tiers={tiers}
            highlightId={highlightId}
            quickAdd={quickAdd}
            quickAddDefaults={defaults}
            onQuickAdd={setQuickAdd}
            onCollapsedChange={setCollapsed}
          />
        </div>
      )}
    </PageContainer>
  )
}
