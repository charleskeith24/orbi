import type { Metadata } from "next"
import { RequestsView } from "@/components/features/admin/requests-view"
import { AdminPage } from "../admin-page"

export const metadata: Metadata = { title: "Access requests · Admin" }

export default function Page() {
  return (
    <AdminPage tab="requests" path="/admin/requests">
      <RequestsView />
    </AdminPage>
  )
}
