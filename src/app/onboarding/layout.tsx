import { DataGate } from "@/components/app-shell/data-gate"
import { DataProvider } from "@/components/providers/data-provider"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="min-h-svh bg-background">
        <DataGate mode="onboarding">{children}</DataGate>
      </div>
    </DataProvider>
  )
}
