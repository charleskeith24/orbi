"use client"

import { Check, ExternalLink, Inbox, Info, X } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageHeader, useConfirm } from "@/components/common"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { AccessRequest, AccessRequestStatus } from "@/lib/admin/types"
import { cn } from "@/lib/utils"
import { describeAdminError } from "./api/errors"
import { useAdmin } from "./admin-context"
import { adminDate, AdminErrorPanel, AdminLoading, REQUEST_STATUS_ICONS, RequestStatusBadge } from "./admin-ui"
import { adminMessages, requestsMessages } from "./messages"
import { useAdminResource } from "./use-admin-resource"

const FILTERS: AccessRequestStatus[] = ["pending", "approved", "rejected"]
const FILTER_LABEL = { pending: "filter_pending", approved: "filter_approved", rejected: "filter_rejected" } as const
const EMPTY = {
  pending: ["empty_pending_title", "empty_pending_body"],
  approved: ["empty_approved_title", "empty_approved_body"],
  rejected: ["empty_rejected_title", "empty_rejected_body"],
} as const

export function RequestsView() {
  const t = useScreenT(requestsMessages)
  const { api } = useAdmin()
  const [filter, setFilter] = useState<AccessRequestStatus>("pending")
  const requests = useAdminResource(`requests:${filter}`, () => api.listRequests(filter))
  const rows = requests.data ?? []
  const [emptyTitle, emptyBody] = EMPTY[filter]

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <AccessSwitch />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value as AccessRequestStatus)
            }}
            aria-label={t("filter_label")}
          >
            {FILTERS.map((status) => {
              const Icon = REQUEST_STATUS_ICONS[status]
              return (
                <ToggleGroupItem key={status} value={status} className="px-2.5">
                  <Icon aria-hidden />
                  {t(FILTER_LABEL[status])}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />
            {t("no_email_note")}
          </p>
        </div>

        {requests.error ? <AdminErrorPanel error={requests.error} onRetry={requests.reload} /> : null}
        {requests.loading && !requests.data ? (
          <AdminLoading label={t("loading_label")} rows={3} />
        ) : !requests.error && !requests.loading && !rows.length ? (
          <EmptyState icon={Inbox} title={t(emptyTitle)} description={t(emptyBody)} />
        ) : rows.length ? (
          <ul
            aria-label={t("list_label", { status: t(FILTER_LABEL[filter]) })}
            aria-busy={requests.loading || undefined}
            className={cn("flex flex-col divide-y rounded-lg border bg-card", requests.loading && "opacity-60")}
          >
            {rows.map((request) => (
              <RequestRow key={request.id} request={request} onDecided={requests.reload} />
            ))}
          </ul>
        ) : null}
      </div>
    </>
  )
}

function RequestRow({ request, onDecided }: { request: AccessRequest; onDecided: () => void }) {
  const t = useScreenT(requestsMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { api } = useAdmin()
  const [confirm, confirmDialog] = useConfirm()
  const [pending, setPending] = useState<"approve" | "reject" | null>(null)
  const name = request.name || t("no_name")

  async function decide(kind: "approve" | "reject") {
    const ok = await confirm(
      kind === "approve"
        ? {
            title: t("approve_title", { name }),
            description: t("approve_body", { email: request.email }),
            confirmLabel: t("approve_confirm"),
            cancelLabel: a("cancel"),
            destructive: false,
          }
        : {
            title: t("reject_title", { name }),
            description: t("reject_body", { email: request.email }),
            confirmLabel: t("reject_confirm"),
            cancelLabel: a("cancel"),
          }
    )
    if (!ok) return
    setPending(kind)
    try {
      if (kind === "approve") await api.approveRequest(request.id)
      else await api.rejectRequest(request.id)
      toast.success(kind === "approve" ? t("approved_toast") : t("rejected_toast"), { description: request.email })
      onDecided()
    } catch (error) {
      toast.error(describeAdminError(error, lang))
    } finally {
      setPending(null)
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{name}</span>
          <span className="min-w-0 text-sm break-all text-muted-foreground">{request.email}</span>
        </div>
        <p className={cn("text-sm text-pretty whitespace-pre-line", !request.about && "text-muted-foreground italic")}>
          {request.about || t("no_about")}
        </p>
        {request.link ? (
          <a
            href={request.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={t("open_link", { link: request.link })}
            className="inline-flex max-w-full items-center gap-1 text-sm text-brand underline-offset-4 hover:underline"
          >
            <span className="truncate">{request.link}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </a>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {request.status === "pending"
            ? t("requested", { date: adminDate(request.created_at) })
            : t(request.status === "approved" ? "approved_by" : "rejected_by", {
                date: adminDate(request.decided_at),
                email: request.decided_by_email ?? a("none"),
              })}
        </p>
      </div>
      {request.status === "pending" ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => void decide("reject")}>
            {pending === "reject" ? <Spinner /> : <X aria-hidden />}
            {t("reject")}
          </Button>
          <Button size="sm" disabled={pending !== null} onClick={() => void decide("approve")}>
            {pending === "approve" ? <Spinner /> : <Check aria-hidden />}
            {t("approve")}
          </Button>
        </div>
      ) : (
        <RequestStatusBadge status={request.status} />
      )}
      {confirmDialog}
    </li>
  )
}

/** The `access_open` platform setting. */
function AccessSwitch() {
  const t = useScreenT(requestsMessages)
  const lang = useScreenLang()
  const { api } = useAdmin()
  const settings = useAdminResource("settings", () => api.getSettings())
  const [saving, setSaving] = useState(false)
  const id = useId()
  const open = settings.data?.access_open

  async function toggle(next: boolean) {
    setSaving(true)
    settings.update((current) => ({ ...current, access_open: next }))
    try {
      const saved = await api.updateSettings({ access_open: next })
      settings.update(() => saved)
      toast.success(saved.access_open ? t("access_opened") : t("access_closed"))
    } catch (error) {
      settings.update((current) => ({ ...current, access_open: !next }))
      toast.error(describeAdminError(error, lang))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-medium">
            {t("access_title")}
          </label>
          {open === undefined ? (
            <Skeleton className="mt-1 h-4 w-56" />
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
              {open ? t("access_on") : t("access_off")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
          <Switch
            id={id}
            title={t("access_switch")}
            checked={open ?? false}
            disabled={open === undefined || saving}
            onCheckedChange={(checked) => void toggle(checked)}
          />
        </div>
      </div>
      {settings.error ? <AdminErrorPanel error={settings.error} onRetry={settings.reload} /> : null}
    </section>
  )
}
