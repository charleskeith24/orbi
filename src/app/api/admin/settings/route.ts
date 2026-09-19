/**
 * GET   /api/admin/settings                         → AdminSettings
 * PATCH /api/admin/settings  Partial<AdminSettings> → AdminSettings (a change writes one audit row)
 * Behind requireAdmin (src/lib/admin/guard.ts); PATCH needs a same-origin Origin header.
 */
import { z } from "zod"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json, readJson } from "@/lib/admin/server/http"
import { readSettings, writeSettings } from "@/lib/admin/server/settings"
import { withAdmin } from "@/lib/admin/guard"

const patchSchema = z.strictObject({ access_open: z.boolean().optional() })

export const GET = withAdmin(async ({ service }) => json(await readSettings(service)))

export const PATCH = withAdmin(async ({ service, admin }, request) => {
  const parsed = patchSchema.safeParse(await readJson(request, 1_000))
  if (!parsed.success) throw new AdminError("invalid", "Expected { access_open: boolean }.")
  const current = await readSettings(service)
  const next = parsed.data.access_open
  if (next === undefined || next === current.access_open) return json(current)

  const saved = await writeSettings(service, { access_open: next })
  await writeAudit(service, admin, { action: "settings_updated", details: { setting: "access_open", from: current.access_open, to: saved.access_open } })
  return json(saved)
})
