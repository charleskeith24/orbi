import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { StudioHomeView } from "@/components/features/studio/studio-home-view"

export const metadata: Metadata = { title: "Content Studio" }

/** `?open=<itemId>` (⌘K, cross-links) goes straight to that piece's workspace, keeping `?tab=`. */
export default async function Page(props: PageProps<"/studio">) {
  const { open, tab } = await props.searchParams
  if (typeof open === "string" && open.trim()) {
    redirect(`/studio/${encodeURIComponent(open.trim())}${typeof tab === "string" && tab ? `?tab=${encodeURIComponent(tab)}` : ""}`)
  }
  return (
    <Suspense>
      <StudioHomeView />
    </Suspense>
  )
}
