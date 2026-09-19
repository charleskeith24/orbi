import type { Metadata } from "next"
import { CirclesView } from "@/components/features/circles/circles-view"

export const metadata: Metadata = { title: "Circles" }

export default function Page() {
  return <CirclesView />
}
