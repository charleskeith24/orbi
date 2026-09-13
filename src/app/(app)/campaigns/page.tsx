import type { Metadata } from "next"
import { Suspense } from "react"
import { CampaignsView } from "@/components/features/campaigns/campaigns-view"

export const metadata: Metadata = { title: "Campaigns" }

export default function Page() {
  return (
    <Suspense>
      <CampaignsView />
    </Suspense>
  )
}
