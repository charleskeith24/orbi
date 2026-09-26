import type { Metadata } from "next"
import { Suspense } from "react"
import { HelpView } from "@/components/features/help/help-view"

export const metadata: Metadata = { title: "Help" }

export default function Page() {
  return (
    <Suspense>
      <HelpView />
    </Suspense>
  )
}
