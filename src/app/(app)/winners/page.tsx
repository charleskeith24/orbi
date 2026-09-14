import type { Metadata } from "next"
import { Suspense } from "react"
import { WinnersView } from "@/components/features/winners/winners-view"

export const metadata: Metadata = { title: "Winning Content Library" }

export default function Page() {
  return (
    <Suspense>
      <WinnersView />
    </Suspense>
  )
}
