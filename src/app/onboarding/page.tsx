import type { Metadata } from "next"
import { OnboardingView } from "@/components/features/onboarding/onboarding-view"

export const metadata: Metadata = { title: "Set up your brand" }

/** `?step=niche` re-runs only Niche Discovery on a finished workspace. */
export default async function Page(props: PageProps<"/onboarding">) {
  const { step } = await props.searchParams
  const entry = step === "niche" ? "niche" : null
  return <OnboardingView key={entry ?? "setup"} entry={entry} />
}
