import type { Metadata } from "next"
import { Suspense } from "react"
import { CollabsView } from "@/components/features/collabs/collabs-view"

export const metadata: Metadata = { title: "Collabs" }

export default function Page() {
  return (
    <Suspense>
      <CollabsView />
    </Suspense>
  )
}
