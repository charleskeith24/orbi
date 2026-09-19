"use client"

import { Check, EyeOff, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { DataTable, EmptyState, PageHeader, StatusPill, type DataTableColumn } from "@/components/common"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { AdminUserRow, AdminUserStatus, Page } from "@/lib/admin/types"
import { cn, formatNumber } from "@/lib/utils"
import { useAdmin } from "./admin-context"
import { adminDate, AdminErrorPanel, AdminLoading, AdminPager, adminRelative, UserStatusBadge } from "./admin-ui"
import { adminMessages, usersMessages } from "./messages"
import { UserActionsMenu } from "./user-actions-menu"
import { DeleteUserDialog, InviteDialog } from "./user-dialogs"
import { useAdminResource } from "./use-admin-resource"

const STATUSES: AdminUserStatus[] = ["active", "invited", "disabled"]
const STATUS_LABEL = { invited: "status_invited", active: "status_active", disabled: "status_disabled" } as const

/** Typing settles for this long before the list reloads. */
const SEARCH_DEBOUNCE_MS = 250

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function UsersView() {
  const t = useScreenT(usersMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { api } = useAdmin()
  const searchId = useId()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<AdminUserStatus | "">("")
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null)
  const query = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS)

  const users = useAdminResource(`users:${query}:${status}:${page}`, () =>
    api.listUsers({ page, query: query || undefined, status: status || undefined })
  )
  const data: Page<AdminUserRow> | null = users.data
  const rows = data?.items ?? []
  const filtered = Boolean(query || status)

  const { update } = users
  const replaceRow = useCallback(
    (row: AdminUserRow) => update((current) => ({ ...current, items: current.items.map((u) => (u.id === row.id ? row : u)) })),
    [update]
  )

  function changeSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  const columns = useMemo<DataTableColumn<AdminUserRow>[]>(
    () => [
      {
        id: "user",
        header: t("col_user"),
        className: "min-w-56 max-w-80",
        cell: (u) => (
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className={cn("truncate font-medium", !u.name && "text-muted-foreground")}>{u.name || t("no_name")}</span>
              {u.is_self ? (
                <span className="shrink-0 rounded-md bg-brand-soft px-1.5 text-xs font-medium text-brand">{t("you")}</span>
              ) : null}
              {u.is_admin ? (
                <StatusPill tone="neutral" icon={ShieldCheck}>
                  {t("admin")}
                </StatusPill>
              ) : null}
            </div>
            <span className="truncate text-xs text-muted-foreground">{u.email}</span>
          </div>
        ),
      },
      { id: "status", header: t("col_status"), cell: (u) => <UserStatusBadge status={u.status} /> },
      {
        id: "mfa",
        header: t("col_mfa"),
        cell: (u) =>
          u.mfa_enabled ? (
            <span className="flex items-center gap-1 text-xs font-medium">
              <ShieldCheck className="size-3.5 text-good-fg" aria-hidden />
              {t("mfa_on")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("mfa_off")}</span>
          ),
      },
      { id: "joined", header: t("col_joined"), cell: (u) => <span className="num text-xs">{adminDate(u.created_at)}</span> },
      {
        id: "last",
        header: t("col_last"),
        cell: (u) =>
          u.last_sign_in_at ? (
            <span className="text-xs" title={adminDate(u.last_sign_in_at)}>
              {adminRelative(u.last_sign_in_at, lang)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{a("never")}</span>
          ),
      },
      {
        id: "setup",
        header: t("col_setup"),
        cell: (u) =>
          u.onboarding_completed ? (
            <span className="flex items-center gap-1 text-xs">
              <Check className="size-3.5 text-good-fg" aria-hidden />
              {t("setup_yes")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("setup_no")}</span>
          ),
      },
      { id: "ideas", header: t("col_ideas"), align: "right", cell: (u) => formatNumber(u.counts.ideas) },
      { id: "content", header: t("col_content"), align: "right", cell: (u) => formatNumber(u.counts.content_items) },
      { id: "published", header: t("col_published"), align: "right", cell: (u) => formatNumber(u.counts.published) },
      {
        id: "actions",
        header: <span className="sr-only">{t("col_actions")}</span>,
        align: "right",
        width: 48,
        cell: (u) => <UserActionsMenu user={u} onChanged={replaceRow} onDelete={setDeleting} />,
      },
    ],
    [t, a, lang, replaceRow]
  )

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden />
            {t("invite")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-7 w-full sm:w-64">
            <InputGroupAddon>
              <Search className="size-3.5" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id={searchId}
              type="search"
              value={search}
              placeholder={t("search_placeholder")}
              aria-label={t("search_label")}
              onChange={(event) => changeSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search) {
                  event.preventDefault()
                  changeSearch("")
                }
              }}
              className="h-full [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label={t("clear_search")} onClick={() => changeSearch("")}>
                  <X aria-hidden />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <NativeSelect
            size="sm"
            aria-label={t("status_filter")}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AdminUserStatus | "")
              setPage(1)
            }}
          >
            <NativeSelectOption value="">{t("status_all")}</NativeSelectOption>
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {t(STATUS_LABEL[s])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("privacy_note")}
        </p>

        {users.error ? <AdminErrorPanel error={users.error} onRetry={users.reload} /> : null}
        {!data && users.loading ? (
          <AdminLoading label={t("loading_label")} rows={6} />
        ) : data ? (
          <div className={cn("flex flex-col gap-3 transition-opacity", users.loading && "opacity-60")} aria-busy={users.loading || undefined}>
            <DataTable
              aria-label={t("table_label")}
              rows={rows}
              columns={columns}
              getRowId={(u) => u.id}
              dense
              empty={
                filtered ? (
                  <EmptyState
                    compact
                    icon={Search}
                    title={t("empty_title")}
                    description={t("empty_body")}
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          changeSearch("")
                          setStatus("")
                        }}
                      >
                        {t("clear_filters")}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={Users}
                    title={t("empty_all_title")}
                    description={t("empty_all_body")}
                    action={
                      <Button size="sm" onClick={() => setInviteOpen(true)}>
                        <UserPlus aria-hidden />
                        {t("invite")}
                      </Button>
                    }
                  />
                )
              }
            />
            <AdminPager page={data.page} hasMore={data.has_more} loading={users.loading} onPage={setPage} />
          </div>
        ) : null}
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => users.reload()} />
      <DeleteUserDialog
        user={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onDeleted={() => {
          // The last row on a later page → step back a page.
          if (rows.length === 1 && page > 1) setPage(page - 1)
          else users.reload()
        }}
      />
    </>
  )
}
