import type { Metadata } from "next"
import { FeedbackView } from "@/components/features/admin/feedback-view"
import { AdminPage } from "../admin-page"

export const metadata: Metadata = { title: "Feedback · Admin" }

export default function Page() {
  return (
    <AdminPage tab="feedback" path="/admin/feedback">
      <FeedbackView />
    </AdminPage>
  )
}
