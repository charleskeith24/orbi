"use client"

import { Globe, MapPin, MessageSquareText, Monitor, UserRound } from "lucide-react"
import { useState } from "react"
import { EmptyState, PageHeader } from "@/components/common"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import type { AdminFeedback } from "@/lib/admin/types"
import { cn } from "@/lib/utils"
import { useAdmin } from "./admin-context"
import { adminDateTime, AdminErrorPanel, AdminLoading, AdminPager, FeedbackKindBadge } from "./admin-ui"
import { adminFeedbackMessages } from "./messages"
import { useAdminResource } from "./use-admin-resource"

const VIEWPORT_LABEL: Record<string, "viewport_mobile" | "viewport_tablet" | "viewport_desktop"> = {
  mobile: "viewport_mobile",
  tablet: "viewport_tablet",
  desktop: "viewport_desktop",
}
const LANG_LABEL: Record<string, "lang_en" | "lang_tl"> = { en: "lang_en", tl: "lang_tl" }

export function FeedbackView() {
  const t = useScreenT(adminFeedbackMessages)
  const { api } = useAdmin()
  const [page, setPage] = useState(1)
  const feedback = useAdminResource(`feedback:${page}`, () => api.listFeedback(page))
  const data = feedback.data

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {feedback.error ? <AdminErrorPanel error={feedback.error} onRetry={feedback.reload} /> : null}
      {!data && feedback.loading ? (
        <AdminLoading label={t("loading_label")} rows={5} />
      ) : data && !data.items.length && page === 1 ? (
        <EmptyState icon={MessageSquareText} title={t("empty_title")} description={t("empty_body")} />
      ) : data ? (
        <div className={cn("flex flex-col gap-3 transition-opacity", feedback.loading && "opacity-60")} aria-busy={feedback.loading || undefined}>
          <ul aria-label={t("list_label")} className="flex flex-col divide-y rounded-lg border bg-card">
            {data.items.map((entry) => (
              <FeedbackRow key={entry.id} entry={entry} />
            ))}
          </ul>
          <AdminPager page={data.page} hasMore={data.has_more} loading={feedback.loading} onPage={setPage} />
        </div>
      ) : null}
    </>
  )
}

function FeedbackRow({ entry }: { entry: AdminFeedback }) {
  const t = useScreenT(adminFeedbackMessages)
  const viewport = VIEWPORT_LABEL[entry.viewport]
  const language = LANG_LABEL[entry.ui_language]
  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FeedbackKindBadge kind={entry.kind} />
        <time dateTime={entry.created_at} className="num text-xs text-muted-foreground">
          {adminDateTime(entry.created_at)}
        </time>
      </div>
      <p className="text-sm text-pretty break-words whitespace-pre-wrap">{entry.message}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Meta icon={UserRound}>{entry.user_email}</Meta>
        {entry.page ? (
          <Meta icon={MapPin}>
            {t("page")} <code className="font-mono">{entry.page}</code>
          </Meta>
        ) : null}
        {entry.viewport ? <Meta icon={Monitor}>{viewport ? t(viewport) : entry.viewport}</Meta> : null}
        {language ? <Meta icon={Globe}>{t(language)}</Meta> : null}
      </div>
    </li>
  )
}

function Meta({ icon: Icon, children }: { icon: typeof Globe; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-all">{children}</span>
    </span>
  )
}
