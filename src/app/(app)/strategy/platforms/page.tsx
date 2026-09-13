import type { Metadata } from "next"
import { Suspense } from "react"
import { PlatformsView } from "@/components/features/strategy/platforms-view"

export const metadata: Metadata = { title: "Platform Strategy" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlatformsView />
    </Suspense>
  )
}
