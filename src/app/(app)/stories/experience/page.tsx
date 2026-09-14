import type { Metadata } from "next"
import { ExperienceView } from "@/components/features/stories/experience-view"

export const metadata: Metadata = { title: "Turn Experience Into Content" }

export default function Page() {
  return <ExperienceView />
}
