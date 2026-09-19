import type { Metadata } from "next"
import { AuditView } from "@/components/features/admin/audit-view"
import { AdminPage } from "../admin-page"

export const metadata: Metadata = { title: "Audit log · Admin" }

export default function Page() {
  return (
    <AdminPage tab="audit" path="/admin/audit">
      <AuditView />
    </AdminPage>
  )
}
