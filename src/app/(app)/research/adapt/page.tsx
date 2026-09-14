import type { Metadata } from "next"
import { Suspense } from "react"
import { AdaptView } from "@/components/features/research/adapt-view"

export const metadata: Metadata = { title: "Inspiration to Original" }

export default function Page() {
  return (
    <Suspense>
      <AdaptView />
    </Suspense>
  )
}
