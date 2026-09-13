import type { Metadata } from "next"
import { Suspense } from "react"
import { SettingsView } from "@/components/features/settings/settings-view"

export const metadata: Metadata = { title: "Settings" }

export default function Page() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  )
}
