import type { Metadata } from "next"
import { TodayView } from "@/components/features/today/today-view"

export const metadata: Metadata = { title: "Today" }

export default function Page() {
  return <TodayView />
}
