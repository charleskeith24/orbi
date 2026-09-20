"use client"

import { ArrowLeft, Link2, SearchX } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { useAdminResource as useResource } from "@/components/features/admin/use-admin-resource"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { circleWeek } from "@/lib/circles/streak"
import type { CircleSnapshot } from "@/lib/circles/types"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ID } from "@/lib/types"
import { CircleAsksSection } from "./circle-asks"
import { CircleMembersSection } from "./circle-members"
import { CircleWeekSection } from "./circle-week"
import { CirclesFrame, CirclesLoadError, SampleDataNote, useCircles } from "./circles-client"
import { circlesMessages, circleWeekMessages } from "./messages"

/** `/circles/<id>` (Calm UI) — This week (check-in), Collab asks and Members; explanations wait behind ⓘs. */
export function CircleDetailView({ circleId }: { circleId: ID }) {
  return (
    <CirclesFrame>
      <CircleDetail circleId={circleId} />
    </CirclesFrame>
  )
}

/** Members whose contact you may see: yourself, and everyone linked to you by an accepted interest. */
export function linkedMembers(snapshot: CircleSnapshot, selfId: ID): ID[] {
  const authors = new Map(snapshot.asks.map((a) => [a.id, a.user_id]))
  const linked = new Set<ID>([selfId])
  for (const interest of snapshot.interests) {
    if (interest.status !== "accepted") continue
    const author = authors.get(interest.ask_id)
    if (author === selfId) linked.add(interest.user_id)
    else if (interest.user_id === selfId && author) linked.add(author)
  }
  return [...linked].sort()
}

function CircleDetail({ circleId }: { circleId: ID }) {
  const t = useT(circleWeekMessages)
  const l = useT(circlesMessages)
  const { api } = useCircles()
  const now = useNow()
  const today = toISODate(now)
  const circle = useResource<CircleSnapshot | null>(`circle:${api.self}:${circleId}`, () => api.getCircle(circleId))
  const snapshot = circle.data

  const week = useMemo(() => (snapshot ? circleWeek(snapshot, circleId, api.self, today) : null), [snapshot, circleId, api.self, today])
  const linked = useMemo(() => (snapshot ? linkedMembers(snapshot, api.self) : []), [snapshot, api.self])
  const contacts = useResource<Record<ID, string | null>>(`contacts:${circleId}:${linked.join(",")}`, async () => {
    if (!linked.length) return {}
    const entries = await Promise.all(linked.map(async (id) => [id, await api.contactOf(circleId, id)] as const))
    return Object.fromEntries(entries)
  })

  if (circle.error && !snapshot) {
    return (
      <PageContainer>
        <CirclesLoadError error={circle.error} onRetry={circle.reload} />
      </PageContainer>
    )
  }
  if (circle.loading && !snapshot) {
    return (
      <PageContainer>
        <div role="status" aria-busy="true" aria-label={l("loading")} className="flex flex-col gap-4">
          <Skeleton className="h-7 w-56" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </PageContainer>
    )
  }
  if (!snapshot || !week || !week.self) {
    return (
      <PageContainer>
        <EmptyState
          icon={SearchX}
          title={t("not_found_title")}
          description={t("not_found_body")}
          action={
            <Button asChild>
              <Link href="/circles">
                <ArrowLeft aria-hidden />
                {t("back")}
              </Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const owner = week.rows.find((r) => r.member.role === "owner")?.member
  const subtitle = [l.plural("members", week.total), week.selfRole === "owner" ? t("you_own") : t("owned_by", { name: owner?.display_name ?? "—" })].join(" · ")
  const reloadAll = () => {
    circle.reload()
    contacts.reload()
  }
  const contactMap = contacts.data ?? {}

  return (
    <PageContainer>
      <PageHeader
        title={snapshot.circle.name}
        description={subtitle}
      />
      <SampleDataNote />

      {week.total <= 1 ? (
        <p role="note" className="flex min-w-0 items-center gap-2 text-sm">
          <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 text-pretty">
            <span className="font-medium">{t("alone_title")}</span>
            <span className="text-muted-foreground"> — {t("alone_body")}</span>
          </span>
        </p>
      ) : null}

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3" aria-busy={circle.loading || undefined}>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <CircleWeekSection snapshot={snapshot} week={week} now={now} onChanged={circle.reload} />
          <div id="asks" className="scroll-mt-16">
            <CircleAsksSection snapshot={snapshot} contacts={contactMap} now={now} onChanged={reloadAll} />
          </div>
        </div>
        <CircleMembersSection
          snapshot={snapshot}
          week={week}
          myContact={contacts.data ? (contacts.data[api.self] ?? null) : undefined}
          onChanged={reloadAll}
          onContactSaved={contacts.reload}
        />
      </div>
    </PageContainer>
  )
}
