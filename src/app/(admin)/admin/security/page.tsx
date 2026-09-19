import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { AdminArea } from "@/components/features/admin/admin-area"
import { SecurityView } from "@/components/features/admin/security-view"
import { firstParam } from "@/components/features/auth/auth-paths"
import { getAdminGate } from "@/lib/admin/gate"

export const metadata: Metadata = { title: "Security · Admin" }

/**
 * 2-step verification. Unlike the other admin pages it also renders for `needs_mfa`: an admin without
 * AAL2 enrolls (no factor yet) or enters a code (has one) — with the tabs hidden until that's done.
 */
export default async function Page(props: PageProps<"/admin/security">) {
  await connection()
  const gate = await getAdminGate()
  switch (gate.status) {
    case "local": {
      // Only the dev fixture reads it (`?preview=enroll|challenge` shows those screens on sample data).
      const preview = firstParam((await props.searchParams).preview)
      return (
        <AdminArea source="local" tab="security">
          <SecurityView mode="manage" preview={preview} />
        </AdminArea>
      )
    }
    case "signed_out":
      redirect(`/login?${new URLSearchParams({ next: "/admin/security" })}`)
    case "not_admin":
      notFound()
    case "needs_mfa":
      return (
        <AdminArea source="live" tab="security" restricted self={{ id: "", email: gate.email }}>
          <SecurityView mode={gate.has_factor ? "challenge" : "enroll"} />
        </AdminArea>
      )
    case "ok":
      return (
        <AdminArea source="live" tab="security" self={gate.admin}>
          <SecurityView mode="manage" />
        </AdminArea>
      )
  }
}
