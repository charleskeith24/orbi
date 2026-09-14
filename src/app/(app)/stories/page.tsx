import type { Metadata } from "next"
import { Suspense } from "react"
import { StoryVaultView } from "@/components/features/stories/story-vault-view"

export const metadata: Metadata = { title: "Story Vault" }

export default function Page() {
  return (
    <Suspense>
      <StoryVaultView />
    </Suspense>
  )
}
