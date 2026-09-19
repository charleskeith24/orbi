"use client"

import { PageContainer } from "@/components/common"
import { CollabFollowUpsSection } from "@/components/features/collabs/today-follow-ups"
import { WhatToPost } from "@/components/features/recommendations/what-to-post"
import { useTable } from "@/lib/store"
import { EngagementTracker } from "./engagement-tracker"
import { IdeasTodaySection } from "./ideas-today"
import { RhythmStrip } from "./rhythm-strip"
import { TodayHeader } from "./today-header"
import { useTodayData } from "./use-today"
import { OverdueSection, TodaysContentSection, ToPostSection, ToRecordSection, ToReviewSection } from "./work-lists"

/**
 * Today — the Daily Content Command Center. Two columns from a 896px page width (work queues left;
 * what to create, engagement and today's ideas right); below that one column where `order-*` puts
 * today's work first and the suggestion last (the column wrappers are `display: contents`).
 */
export function TodayView() {
  const data = useTodayData()
  const logs = useTable("engagement_logs")

  return (
    <PageContainer className="@container gap-4">
      <TodayHeader data={data} />
      <RhythmStrip steps={data.rhythm} />
      <div className="flex min-w-0 flex-col gap-4 @4xl:grid @4xl:grid-cols-12 @4xl:items-start">
        <div className="contents @4xl:col-span-7 @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-4">
          <TodaysContentSection data={data} className="order-1 @4xl:order-none" />
          <OverdueSection data={data} className="order-2 @4xl:order-none" />
          <ToPostSection data={data} className="order-3 @4xl:order-none" />
          <ToReviewSection data={data} className="order-4 @4xl:order-none" />
          <ToRecordSection data={data} className="order-5 @4xl:order-none" />
          <CollabFollowUpsSection now={data.now} className="order-5 @4xl:order-none" />
        </div>
        <div className="contents @4xl:col-span-5 @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-4">
          <WhatToPost variant="full" className="order-8 @4xl:order-none" />
          <EngagementTracker
            log={data.log}
            logs={logs}
            tasks={data.tasks}
            now={data.now}
            className="order-6 @4xl:order-none"
          />
          <IdeasTodaySection ideas={data.today.ideasCapturedToday} className="order-7 @4xl:order-none" />
        </div>
      </div>
    </PageContainer>
  )
}
