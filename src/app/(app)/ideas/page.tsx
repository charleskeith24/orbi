import type { Metadata } from "next"
import { Suspense } from "react"
import { IdeaBankView } from "@/components/features/ideas/idea-bank-view"

export const metadata: Metadata = { title: "Idea Bank" }

export default function Page() {
  return (
    <Suspense>
      <IdeaBankView />
    </Suspense>
  )
}
