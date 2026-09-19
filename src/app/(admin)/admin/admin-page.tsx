import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { AdminArea } from "@/components/features/admin/admin-area"
import type { AdminTab } from "@/components/features/admin/admin-shell"
import { getAdminGate } from "@/lib/admin/gate"

/**
 * Server gate for every /admin page except Security (docs/ADMIN_BRIEF.md §3, §5):
 * local → the online-version notice (or the dev fixture, decided in the browser) · signed_out → /login?next= ·
 * not_admin → 404, so the area isn't revealed · needs_mfa → /admin/security · ok → the page.
 */
export async function AdminPage({ tab, path, children }: { tab: AdminTab; path: string; children: React.ReactNode }) {
  // Per-request: the answer depends on the session, never on a build-time render.
  await connection()
  const gate = await getAdminGate()
  switch (gate.status) {
    case "local":
      return (
        <AdminArea source="local" tab={tab}>
          {children}
        </AdminArea>
      )
    case "signed_out":
      redirect(`/login?${new URLSearchParams({ next: path })}`)
    case "not_admin":
      notFound()
    case "needs_mfa":
      redirect("/admin/security")
    case "ok":
      return (
        <AdminArea source="live" tab={tab} self={gate.admin}>
          {children}
        </AdminArea>
      )
  }
}
