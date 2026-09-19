import type { Metadata } from "next"
import { UsersView } from "@/components/features/admin/users-view"
import { AdminPage } from "../admin-page"

export const metadata: Metadata = { title: "Users · Admin" }

export default function Page() {
  return (
    <AdminPage tab="users" path="/admin/users">
      <UsersView />
    </AdminPage>
  )
}
