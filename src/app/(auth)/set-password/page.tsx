import type { Metadata } from "next"
import { firstParam, safeNextPath } from "@/components/features/auth/auth-paths"
import { LocalModeCard } from "@/components/features/auth/local-mode-card"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { SetPasswordForm } from "./set-password-form"

export const metadata: Metadata = { title: "Set a password" }

/**
 * Invited beta testers arrive signed in through an email link and have no password yet; anyone else
 * can use it to change theirs. Signed-out visitors are sent to /login by the proxy first.
 */
export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isSupabaseConfigured) return <LocalModeCard />
  const query = await props.searchParams
  return <SetPasswordForm next={safeNextPath(firstParam(query.next))} />
}
