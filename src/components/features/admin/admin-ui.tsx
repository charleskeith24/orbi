"use client"

import {
  Ban,
  Bug,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Heart,
  Lightbulb,
  Mail,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { StatusPill, type StatusTone } from "@/components/common"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { AccessRequestStatus, AdminFeedbackKind, AdminUserStatus } from "@/lib/admin/types"
import { formatDate, formatDateTime, formatRelativeDay } from "@/lib/dates"
import type { UiLang } from "@/lib/i18n/core"
import { cn } from "@/lib/utils"
import { describeAdminError, toAdminError } from "./api/errors"
import { adminFeedbackMessages, adminMessages, requestsMessages, usersMessages } from "./messages"

/* ---------------------------------- Dates ---------------------------------- */

/** "Sep 18, 2026" — fixed format in both languages. */
export const adminDate = (value: string | null | undefined) => formatDate(value)

/** "Sep 18, 9:05 AM". */
export const adminDateTime = (value: string | null | undefined) => formatDateTime(value)

/** "Today" / "3 days ago" / "Aug 2" (translated). */
export const adminRelative = (value: string, lang: UiLang, now = new Date()) => formatRelativeDay(value, now, lang)

/** The same inside a sentence: "Last used today" (a word without digits loses its capital; "Aug 2" keeps it). */
export const adminRelativeInline = (value: string, lang: UiLang, now = new Date()) => {
  const text = adminRelative(value, lang, now)
  return /\d/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

/* ---------------------------------- States --------------------------------- */

/** Load failure with the next step: sign in again, verify, or retry. */
export function AdminErrorPanel({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const t = useScreenT(adminMessages)
  const lang = useScreenLang()
  const pathname = usePathname()
  const code = toAdminError(error).code
  const action =
    code === "unauthorized" ? (
      <Button asChild size="sm" variant="outline">
        <Link href={`/login?${new URLSearchParams({ next: pathname })}`}>{t("sign_in_again")}</Link>
      </Button>
    ) : code === "mfa_required" ? (
      <Button asChild size="sm" variant="outline">
        <Link href="/admin/security">{t("go_to_security")}</Link>
      </Button>
    ) : onRetry ? (
      <Button size="sm" variant="outline" onClick={onRetry}>
        {t("retry")}
      </Button>
    ) : null
  return (
    <Alert variant="destructive" className={className}>
      <CircleAlert aria-hidden />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span>{describeAdminError(error, lang)}</span>
        {action}
      </AlertDescription>
    </Alert>
  )
}

/** Skeleton rows while a list loads for the first time. */
export function AdminLoading({ label, rows = 4, className }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy className={cn("flex flex-col gap-2 rounded-lg border bg-card p-4", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Previous / Page n / Next for server-paged lists. */
export function AdminPager({
  page,
  hasMore,
  loading,
  onPage,
}: {
  page: number
  hasMore: boolean
  loading?: boolean
  onPage: (page: number) => void
}) {
  const t = useScreenT(adminMessages)
  if (page <= 1 && !hasMore) return null
  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden />
        {t("previous")}
      </Button>
      <span className="num min-w-14 text-center text-xs text-muted-foreground" aria-live="polite">
        {t("page_n", { page })}
      </span>
      <Button type="button" variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => onPage(page + 1)}>
        {t("next")}
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  )
}

/* --------------------------------- Badges ---------------------------------- */

const USER_STATUS: Record<AdminUserStatus, { tone: StatusTone; icon: LucideIcon; label: "status_invited" | "status_active" | "status_disabled" }> = {
  invited: { tone: "neutral", icon: Mail, label: "status_invited" },
  active: { tone: "good", icon: CircleCheck, label: "status_active" },
  disabled: { tone: "critical", icon: Ban, label: "status_disabled" },
}

export function UserStatusBadge({ status }: { status: AdminUserStatus }) {
  const t = useScreenT(usersMessages)
  const meta = USER_STATUS[status]
  return (
    <StatusPill tone={meta.tone} icon={meta.icon}>
      {t(meta.label)}
    </StatusPill>
  )
}

const REQUEST_STATUS: Record<AccessRequestStatus, { tone: StatusTone; icon: LucideIcon; label: "filter_pending" | "filter_approved" | "filter_rejected" }> = {
  pending: { tone: "neutral", icon: Clock, label: "filter_pending" },
  approved: { tone: "good", icon: CircleCheck, label: "filter_approved" },
  rejected: { tone: "critical", icon: CircleX, label: "filter_rejected" },
}

export function RequestStatusBadge({ status }: { status: AccessRequestStatus }) {
  const t = useScreenT(requestsMessages)
  const meta = REQUEST_STATUS[status]
  return (
    <StatusPill tone={meta.tone} icon={meta.icon}>
      {t(meta.label)}
    </StatusPill>
  )
}

export const REQUEST_STATUS_ICONS: Record<AccessRequestStatus, LucideIcon> = {
  pending: Clock,
  approved: CircleCheck,
  rejected: CircleX,
}

const FEEDBACK_KIND: Record<AdminFeedbackKind, { icon: LucideIcon; label: "kind_bug" | "kind_idea" | "kind_confusing" | "kind_praise" }> = {
  bug: { icon: Bug, label: "kind_bug" },
  idea: { icon: Lightbulb, label: "kind_idea" },
  confusing: { icon: CircleHelp, label: "kind_confusing" },
  praise: { icon: Heart, label: "kind_praise" },
}

/** Feedback kind — a category, not a status, so it stays neutral. */
export function FeedbackKindBadge({ kind }: { kind: AdminFeedbackKind }) {
  const t = useScreenT(adminFeedbackMessages)
  const meta = FEEDBACK_KIND[kind] ?? FEEDBACK_KIND.idea
  return (
    <StatusPill tone="neutral" icon={meta.icon}>
      {t(meta.label)}
    </StatusPill>
  )
}
