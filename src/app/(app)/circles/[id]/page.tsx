import type { Metadata } from "next"
import { CircleDetailView } from "@/components/features/circles/circle-detail-view"

export const metadata: Metadata = { title: "Circle" }

export default async function Page(props: PageProps<"/circles/[id]">) {
  const { id } = await props.params
  return <CircleDetailView circleId={id} />
}
