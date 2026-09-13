import type { Metadata } from "next"
import { BrandHqView } from "@/components/features/strategy/brand-hq-view"

export const metadata: Metadata = { title: "Brand HQ" }

export default function Page() {
  return <BrandHqView />
}
