/**
 * SERVER ONLY — Admin → Feedback. Feedback was written *to* the team, so admins read it in full, with the
 * sender's email. Rows come through the admin's own session (the read policy requires is_admin() and AAL2);
 * emails come from `public.users` with the secret key.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminFeedback, AdminFeedbackKind, Page } from "../types"

export const FEEDBACK_PAGE_SIZE = 50

export async function listFeedback(supabase: SupabaseClient, service: SupabaseClient, page: number): Promise<Page<AdminFeedback>> {
  const from = (page - 1) * FEEDBACK_PAGE_SIZE
  // One extra row tells whether another page exists.
  const { data, error } = await supabase
    .from("feedback")
    .select("id, user_id, kind, message, page, ui_language, viewport, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + FEEDBACK_PAGE_SIZE)
  if (error) throw new Error(`[admin] list feedback: ${error.message}`)
  const rows = ((data ?? []) as Record<string, unknown>[]).slice(0, FEEDBACK_PAGE_SIZE)

  const ids = [...new Set(rows.map((row) => row.user_id as string))]
  const emails = new Map<string, string>()
  if (ids.length) {
    const { data: users, error: usersError } = await service.from("users").select("id, email").in("id", ids)
    if (usersError) throw new Error(`[admin] feedback senders: ${usersError.message}`)
    for (const user of users ?? []) emails.set(user.id as string, (user.email as string) ?? "")
  }

  return {
    items: rows.map((row) => ({
      id: row.id as string,
      kind: row.kind as AdminFeedbackKind,
      message: row.message as string,
      page: (row.page as string) ?? "",
      ui_language: (row.ui_language as string) ?? "",
      viewport: (row.viewport as string) ?? "",
      created_at: row.created_at as string,
      user_email: emails.get(row.user_id as string) ?? "",
    })),
    page,
    has_more: (data ?? []).length > FEEDBACK_PAGE_SIZE,
  }
}
