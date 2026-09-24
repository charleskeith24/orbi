import { MoneyAccessGate } from "@/components/features/team/no-access-notice"

/**
 * Money is hidden from a member of somebody else's workspace unless the owner turned on Money access
 * (ARCHITECTURE §17). The database hides the rows; this explains why the pages aren't there.
 */
export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return <MoneyAccessGate>{children}</MoneyAccessGate>
}
