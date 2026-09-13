import type { Metadata } from "next"
import { Suspense } from "react"
import { ContentWorkspace } from "@/components/features/studio/content-workspace"

export const metadata: Metadata = { title: "Content Workspace" }

export default async function Page(props: PageProps<"/studio/[id]">) {
  const { id } = await props.params
  return (
    <Suspense>
      <ContentWorkspace itemId={id} />
    </Suspense>
  )
}
