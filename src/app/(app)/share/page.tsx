import type { Metadata } from "next"
import { Suspense } from "react"
import { ShareView } from "@/components/features/pwa/share-view"

export const metadata: Metadata = { title: "Share to Orbi" }

export default function Page() {
  return (
    <Suspense>
      <ShareView />
    </Suspense>
  )
}
