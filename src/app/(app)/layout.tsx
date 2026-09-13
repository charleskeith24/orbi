import { cookies } from "next/headers"
import { AppShell } from "@/components/app-shell/app-shell"
import { DataProvider } from "@/components/providers/data-provider"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"
  return (
    <DataProvider>
      <AppShell defaultOpen={defaultOpen}>{children}</AppShell>
    </DataProvider>
  )
}
