import type { Metadata } from "next"
import { Suspense } from "react"
import { PersonasView } from "@/components/features/audience/personas-view"

export const metadata: Metadata = { title: "Audience HQ" }

export default function Page() {
  return (
    <Suspense>
      <PersonasView />
    </Suspense>
  )
}
