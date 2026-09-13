import type { Metadata } from "next"
import { OnboardingView } from "@/components/features/onboarding/onboarding-view"

export const metadata: Metadata = { title: "Set up your brand" }

export default function Page() {
  return <OnboardingView />
}
