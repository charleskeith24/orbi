import type { Metadata } from "next"
import { connection } from "next/server"
import { firstParam } from "@/components/features/auth/auth-paths"
import { LocalModeCard } from "@/components/features/auth/local-mode-card"
import { RequestAccessForm } from "@/components/features/auth/request-access-form"
import { getAccessRequestState } from "@/lib/admin/server/settings"
import type { AccessRequestState } from "@/lib/admin/types"

export const metadata: Metadata = { title: "Request access" }

/** Dev-only QA previews of the online version's form on the local dev server (no Supabase there). */
const DEV_PREVIEWS: Record<string, Exclude<AccessRequestState, "local">> = {
  "request-access": "open",
  "request-closed": "closed",
  "request-unconfigured": "not_configured",
}

/** Online version: "Request access" (the waitlist the admin approves) — nobody creates an account here. */
export default async function Page(props: PageProps<"/signup">) {
  // Per request: the admin's "Accepting requests" switch can change at any time.
  await connection()
  const state = await getAccessRequestState()
  if (state === "local") {
    // `/signup?preview=request-access|request-closed|request-unconfigured` in development only. Submitting the
    // preview form gets the API's 501 (no Supabase), so it shows its error state.
    const key = process.env.NODE_ENV !== "production" ? (firstParam((await props.searchParams).preview) ?? "") : ""
    return Object.hasOwn(DEV_PREVIEWS, key) ? <RequestAccessForm state={DEV_PREVIEWS[key]} /> : <LocalModeCard />
  }
  return <RequestAccessForm state={state} />
}
