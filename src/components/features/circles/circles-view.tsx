"use client"

import { CircleCheck, CircleDashed, Link2, LogIn, Plus, ShieldCheck, UsersRound } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader, StatusPill } from "@/components/common"
import { useAdminResource as useResource } from "@/components/features/admin/use-admin-resource"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { circleWeek } from "@/lib/circles/streak"
import type { Circle, CirclesOverview } from "@/lib/circles/types"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { CreateCircleDialog, JoinCircleDialog } from "./circle-dialogs"
import { MemberStack, StreakLabel } from "./circle-ui"
import { CirclesFrame, CirclesLoadError, SampleDataNote, useCircles } from "./circles-client"
import { circlesMessages } from "./messages"

/** `/circles` — your circles as cards, "Create a circle" and "Join with a link". */
export function CirclesView() {
  return (
    <CirclesFrame>
      <CirclesList />
    </CirclesFrame>
  )
}

function CirclesList() {
  const t = useT(circlesMessages)
  const { api } = useCircles()
  const now = useNow()
  const today = toISODate(now)
  const overview = useResource<CirclesOverview>(`circles:${api.self}`, () => api.listCircles())
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const circles = overview.data?.circles ?? []

  const actions = (
    <>
      <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>
        <LogIn aria-hidden />
        {t("join")}
      </Button>
      <Button size="sm" onClick={() => setCreateOpen(true)}>
        <Plus aria-hidden />
        {t("create")}
      </Button>
    </>
  )

  return (
    <PageContainer>
      <PageHeader title={t("title")} icon={UsersRound} description={t("description")} actions={actions} />
      <SampleDataNote />

      {overview.error && !overview.data ? (
        <CirclesLoadError error={overview.error} onRetry={overview.reload} />
      ) : !overview.data ? (
        <div role="status" aria-busy="true" aria-label={t("loading")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : circles.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={overview.loading || undefined}>
          {circles.map((circle) => (
            <li key={circle.id} className="min-w-0">
              <CircleCard circle={circle} overview={overview.data!} selfId={api.self} today={today} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={UsersRound}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t("create")}
            </Button>
          }
          secondaryAction={
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <LogIn aria-hidden />
              {t("join")}
            </Button>
          }
        />
      )}

      <PrivacySummary />

      <CreateCircleDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={overview.reload} />
      <JoinCircleDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </PageContainer>
  )
}

function CircleCard({ circle, overview, selfId, today }: { circle: Circle; overview: CirclesOverview; selfId: string; today: string }) {
  const t = useT(circlesMessages)
  const week = useMemo(() => circleWeek(overview, circle.id, selfId, today), [overview, circle.id, selfId, today])
  const alone = week.total <= 1
  const checkedIn = Boolean(week.self?.checkin)
  const progressLabel = t("checked_in", { done: week.checkedIn, total: week.total })

  return (
    <Link
      href={`/circles/${circle.id}`}
      className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">{circle.name}</h2>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="num">{t.plural("members", week.total)}</span>
            {week.selfRole === "owner" ? <StatusPill icon={null}>{t("owner")}</StatusPill> : null}
          </p>
        </div>
        <MemberStack names={week.rows.map((r) => r.member.display_name)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground num">{progressLabel}</span>
        <Progress value={week.total ? (week.checkedIn / week.total) * 100 : 0} aria-label={progressLabel} className="h-1.5" />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <StreakLabel weeks={week.self?.streak ?? 0} />
        {checkedIn ? (
          <span className="inline-flex items-center gap-1 text-xs text-good-fg">
            <CircleCheck className="size-3.5" aria-hidden />
            {t("you_checked_in")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CircleDashed className="size-3.5" aria-hidden />
            {t("not_checked_in")}
          </span>
        )}
      </div>

      {alone ? (
        <p className="flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
          <Link2 className="size-3.5 shrink-0" aria-hidden />
          {t("alone")}
        </p>
      ) : null}
    </Link>
  )
}

/** What leaves your workspace, in one glance (docs/CIRCLES.md principles). */
export function PrivacySummary() {
  const t = useT(circlesMessages)
  const items = ["privacy_name", "privacy_checkin", "privacy_asks", "privacy_contact", "privacy_never"] as const
  return (
    <section aria-labelledby="circles-privacy" className="rounded-lg border bg-muted/30 p-4">
      <h2 id="circles-privacy" className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
        {t("privacy_title")}
      </h2>
      <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {items.map((key) => (
          <li key={key} className="flex gap-2">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
            {t(key)}
          </li>
        ))}
      </ul>
    </section>
  )
}
