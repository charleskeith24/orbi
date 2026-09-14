import type { Metadata } from "next"
import { FunnelView } from "@/components/features/pillars/funnel-view"

export const metadata: Metadata = { title: "Content Funnel" }

export default function Page() {
  return <FunnelView />
}
