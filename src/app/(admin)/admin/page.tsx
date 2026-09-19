import type { Metadata } from "next"
import { OverviewView } from "@/components/features/admin/overview-view"
import { AdminPage } from "./admin-page"

export const metadata: Metadata = { title: "Admin" }

export default function Page() {
  return (
    <AdminPage tab="overview" path="/admin">
      <OverviewView />
    </AdminPage>
  )
}
