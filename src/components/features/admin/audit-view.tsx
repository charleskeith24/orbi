"use client"

import { ScrollText } from "lucide-react"
import { useMemo, useState } from "react"
import { DataTable, EmptyState, PageHeader, type DataTableColumn } from "@/components/common"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import type { AdminAuditAction, AdminAuditEntry } from "@/lib/admin/types"
import { cn } from "@/lib/utils"
import { useAdmin } from "./admin-context"
import { adminDateTime, AdminErrorPanel, AdminLoading, AdminPager } from "./admin-ui"
import { describeAuditDetails } from "./audit-details"
import { adminMessages, auditMessages, usersMessages } from "./messages"
import { useAdminResource } from "./use-admin-resource"

type AuditKey = keyof (typeof auditMessages)["en"]

const ACTION_LABEL: Record<AdminAuditAction, AuditKey> = {
  request_approved: "action_request_approved",
  request_rejected: "action_request_rejected",
  user_invited: "action_user_invited",
  invite_resent: "action_invite_resent",
  user_disabled: "action_user_disabled",
  user_enabled: "action_user_enabled",
  password_reset_sent: "action_password_reset_sent",
  user_deleted: "action_user_deleted",
  admin_granted: "action_admin_granted",
  admin_revoked: "action_admin_revoked",
  settings_updated: "action_settings_updated",
}

export function AuditView() {
  const t = useScreenT(auditMessages)
  const u = useScreenT(usersMessages)
  const a = useScreenT(adminMessages)
  const { api } = useAdmin()
  const [page, setPage] = useState(1)
  const audit = useAdminResource(`audit:${page}`, () => api.listAudit(page))
  const data = audit.data

  const columns = useMemo<DataTableColumn<AdminAuditEntry>[]>(
    () => [
      {
        id: "when",
        header: t("col_when"),
        cell: (entry) => (
          <time dateTime={entry.created_at} className="num text-xs">
            {adminDateTime(entry.created_at)}
          </time>
        ),
      },
      { id: "action", header: t("col_action"), cell: (entry) => <span className="font-medium">{t(ACTION_LABEL[entry.action] ?? "action_settings_updated")}</span> },
      {
        id: "target",
        header: t("col_target"),
        cell: (entry) => (entry.target_email ? entry.target_email : <span className="text-muted-foreground">{a("none")}</span>),
      },
      {
        id: "details",
        header: t("col_details"),
        cell: (entry) => {
          const text = describeAuditDetails(entry.details, t, u)
          return text ? <span className="text-xs">{text}</span> : <span className="text-muted-foreground">{a("none")}</span>
        },
      },
      { id: "admin", header: t("col_admin"), cell: (entry) => <span className="text-xs text-muted-foreground">{entry.admin_email}</span> },
    ],
    [t, u, a]
  )

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {audit.error ? <AdminErrorPanel error={audit.error} onRetry={audit.reload} /> : null}
      {!data && audit.loading ? (
        <AdminLoading label={t("loading_label")} rows={6} />
      ) : data ? (
        <div className={cn("flex flex-col gap-3 transition-opacity", audit.loading && "opacity-60")} aria-busy={audit.loading || undefined}>
          <DataTable
            aria-label={t("table_label")}
            rows={data.items}
            columns={columns}
            getRowId={(entry) => entry.id}
            dense
            empty={<EmptyState compact icon={ScrollText} title={t("empty_title")} description={t("empty_body")} />}
          />
          <AdminPager page={data.page} hasMore={data.has_more} loading={audit.loading} onPage={setPage} />
        </div>
      ) : null}
    </>
  )
}
