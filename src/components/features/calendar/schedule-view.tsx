"use client"

import { Plus, RotateCcw, Target } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { dataActions, useBrand, useSettings, useTable } from "@/lib/store"
import type { PostingSlot } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { weekdayOrder } from "./calendar-model"
import { anyPlatformPosts, capacitySummary, platformLoad, recommendedSlots, slotPillarMix, slotPosts } from "./schedule-model"
import { ScheduleSummary } from "./schedule-summary"
import { ScheduleWeek } from "./schedule-week"
import { SlotFormDialog, type SlotDraftTarget } from "./slot-form-dialog"
import { replaceSearchParams } from "./use-calendar-nav"

/**
 * Posting Schedule (spec §19, §49): fully customisable weekly posting slots with capacity, pillar-mix and
 * platform summaries, and a reset to the recommended weekly strategy. `?open=<slotId>` opens a slot's editor.
 */
export function ScheduleView() {
  const searchParams = useSearchParams()
  const slots = useTable("content_calendar")
  const pillars = useTable("content_pillars")
  const formats = useTable("content_formats")
  const strategies = useTable("content_platforms")
  const settings = useSettings()
  const brand = useBrand()
  const [confirm, confirmDialog] = useConfirm()
  const [adding, setAdding] = useState<{ day: number; nonce: number } | null>(null)
  const weekStartsOn = settings.week_starts_on

  const capacity = useMemo(() => capacitySummary(slots, settings), [slots, settings])
  const platforms = useMemo(() => platformLoad(slots, strategies), [slots, strategies])
  const anyPlatform = useMemo(() => anyPlatformPosts(slots), [slots])
  const mix = useMemo(() => slotPillarMix(slots, pillars, settings.pillar_tolerance), [slots, pillars, settings.pillar_tolerance])

  const openId = searchParams.get("open")
  const openSlot = openId ? slots.find((s) => s.id === openId) : undefined
  const target: SlotDraftTarget | null = openSlot ? { slot: openSlot, day: openSlot.day_of_week } : adding ? { slot: null, day: adding.day } : null
  const targetKey = openSlot ? `edit:${openSlot.id}` : adding ? `add:${adding.day}:${adding.nonce}` : null
  // Keep the last form mounted while the dialog animates out.
  const [shown, setShown] = useState<{ key: string; target: SlotDraftTarget } | null>(null)
  if (target && targetKey && shown?.key !== targetKey) setShown({ key: targetKey, target })

  const setOpen = useCallback(
    (id: string | null) =>
      replaceSearchParams((params) => {
        if (id) params.set("open", id)
        else params.delete("open")
      }),
    []
  )
  const add = (day: number) => {
    if (openId) setOpen(null)
    setAdding({ day, nonce: Date.now() })
  }
  // "Add slot" in the header starts on the first rest day of the week.
  const firstRestDay = weekdayOrder(weekStartsOn).find((d) => !slots.some((s) => s.is_active && s.day_of_week === d)) ?? weekStartsOn

  async function resetToRecommended() {
    const previous: PostingSlot[] = dataActions.getDb().content_calendar
    if (previous.length) {
      const ok = await confirm({
        title: "Reset to the recommended weekly strategy?",
        description: `Your ${pluralize(previous.length, "posting slot")} will be replaced by seven themed slots — Monday Educational / Authority through Sunday Reflection / Community — matched to your pillars, formats and active platforms. You can undo right after.`,
        confirmLabel: "Reset schedule",
      })
      if (!ok) return
      dataActions.remove(
        "content_calendar",
        previous.map((s) => s.id)
      )
    }
    const created = dataActions.insertMany("content_calendar", recommendedSlots({ pillars, formats, strategies, brand }))
    const posts = created.reduce((n, s) => n + slotPosts(s), 0)
    if (openId) setOpen(null)
    toast.success(previous.length ? "Posting Schedule reset to the recommended weekly strategy" : "Recommended weekly strategy added", {
      description: `${pluralize(created.length, "slot")} · ${pluralize(posts, "post")} a week`,
      action: {
        label: "Undo",
        onClick: () => {
          dataActions.remove(
            "content_calendar",
            created.map((s) => s.id)
          )
          if (previous.length) dataActions.insertMany("content_calendar", previous)
        },
      },
    })
  }

  return (
    <PageContainer>
      <PageHeader
        title="Posting Schedule"
        icon={Target}
        description="Your recurring weekly posting targets — shape them however you work. The Calendar shows them as lanes and the Weekly Planner fills them first."
        actions={
          slots.length ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => void resetToRecommended()}>
                <RotateCcw aria-hidden />
                Reset to recommended
              </Button>
              <Button type="button" size="sm" onClick={() => add(firstRestDay)}>
                <Plus aria-hidden />
                Add slot
              </Button>
            </>
          ) : null
        }
      />

      {slots.length ? (
        <>
          <ScheduleSummary capacity={capacity} platforms={platforms} anyPlatform={anyPlatform} mix={mix} />
          <ScheduleWeek slots={slots} weekStartsOn={weekStartsOn} highlightId={openSlot ? openSlot.id : null} onAdd={add} onEdit={(slot) => setOpen(slot.id)} />
        </>
      ) : (
        <EmptyState
          icon={Target}
          title="No posting schedule yet"
          description="Posting slots are recurring weekly targets — like Monday Educational / Authority on TikTok and Facebook. They turn “post more” into a plan the Calendar and the Weekly Planner can fill."
          action={
            <Button type="button" size="sm" onClick={() => void resetToRecommended()}>
              <RotateCcw aria-hidden />
              Use the recommended weekly strategy
            </Button>
          }
          secondaryAction={
            <Button type="button" size="sm" variant="outline" onClick={() => add(weekStartsOn)}>
              <Plus aria-hidden />
              Add a slot
            </Button>
          }
        />
      )}

      <SlotFormDialog
        target={shown?.target ?? null}
        open={Boolean(target)}
        formKey={shown?.key ?? ""}
        weekStartsOn={weekStartsOn}
        onOpenChange={(open) => {
          if (open) return
          setAdding(null)
          if (openId) setOpen(null)
        }}
      />
      {confirmDialog}
    </PageContainer>
  )
}
