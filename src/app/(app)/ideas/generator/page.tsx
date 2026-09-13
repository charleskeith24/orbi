import type { Metadata } from "next"
import { Suspense } from "react"
import { IdeaGeneratorView } from "@/components/features/ideas-lab/idea-generator-view"

export const metadata: Metadata = { title: "Idea Generator" }

export default function Page() {
  return (
    <Suspense>
      <IdeaGeneratorView />
    </Suspense>
  )
}
