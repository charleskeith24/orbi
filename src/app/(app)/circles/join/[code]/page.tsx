import type { Metadata } from "next"
import { CircleJoinView } from "@/components/features/circles/circle-join-view"

export const metadata: Metadata = { title: "Join a circle" }

export default async function Page(props: PageProps<"/circles/join/[code]">) {
  const { code } = await props.params
  return <CircleJoinView code={code} />
}
