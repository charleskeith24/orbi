import type { Metadata } from "next"
import { SystemView } from "@/components/features/strategy/system-view"

export const metadata: Metadata = { title: "Flywheel & System" }

export default function Page() {
  return <SystemView />
}
