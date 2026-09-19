/** Audit details → one readable line. Pure module (tested in audit-details.test.ts). */
import type { AdminAuditEntry } from "@/lib/admin/types"
import type { Translator } from "@/lib/i18n/core"
import type { auditMessages, usersMessages } from "./messages"

type UsersKey = keyof (typeof usersMessages)["en"]

const STATUS_LABEL: Record<string, UsersKey> = { invited: "status_invited", active: "status_active", disabled: "status_disabled" }

/** Small, content-free details → one readable line ("Active → Disabled", "Requests: closed"). */
export function describeAuditDetails(
  details: AdminAuditEntry["details"],
  t: Translator<(typeof auditMessages)["en"]>,
  u: Translator<(typeof usersMessages)["en"]>
): string {
  const parts: string[] = []
  const rest = { ...details }
  if (typeof rest.access_open === "boolean") {
    parts.push(rest.access_open ? t("requests_open") : t("requests_closed"))
    delete rest.access_open
  }
  if (rest.from !== undefined || rest.to !== undefined) {
    const label = (value: unknown) => (typeof value === "string" && STATUS_LABEL[value] ? u(STATUS_LABEL[value]) : String(value ?? "—"))
    parts.push(`${label(rest.from)} → ${label(rest.to)}`)
    delete rest.from
    delete rest.to
  }
  for (const [key, value] of Object.entries(rest)) parts.push(`${key}: ${String(value)}`)
  return parts.join(" · ")
}

