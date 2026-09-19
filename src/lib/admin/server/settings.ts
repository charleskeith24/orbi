/**
 * SERVER ONLY — `public.platform_settings` (one row) and the waitlist state the public pages need.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient, isSecretKeyConfigured } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { AccessRequestState, AdminSettings } from "../types"

export async function readSettings(service: SupabaseClient): Promise<AdminSettings> {
  const { data, error } = await service.from("platform_settings").select("access_open").eq("id", true).maybeSingle()
  if (error) throw new Error(`[admin] read settings: ${error.message}`)
  // The migration inserts the row; if someone removed it in the dashboard, the default applies.
  return { access_open: (data?.access_open as boolean | undefined) ?? true }
}

export async function writeSettings(service: SupabaseClient, patch: AdminSettings): Promise<AdminSettings> {
  const { data, error } = await service.from("platform_settings").update(patch).eq("id", true).select("access_open").maybeSingle()
  if (error) throw new Error(`[admin] update settings: ${error.message}`)
  if (!data) throw new Error("[admin] update settings: the platform_settings row is missing (run the admin migration)")
  return { access_open: data.access_open as boolean }
}

/**
 * For the public `/signup` page (a server component): whether the "Request access" form takes requests.
 * - local           no Supabase (the page explains local mode instead)
 * - not_configured  Supabase, but the server has no SUPABASE_SECRET_KEY, so requests can't be stored
 * - open / closed   the admin's "Accepting requests" switch
 * Never throws: a failed read counts as open, and the endpoint still enforces the real setting.
 */
export async function getAccessRequestState(): Promise<AccessRequestState> {
  if (!isSupabaseConfigured) return "local"
  if (!isSecretKeyConfigured()) return "not_configured"
  try {
    return (await readSettings(createSupabaseAdminClient())).access_open ? "open" : "closed"
  } catch (error) {
    console.error("[access-requests] reading the setting failed", error instanceof Error ? error.message : error)
    return "open"
  }
}
