import type { Metadata } from "next"
import { firstParam, safeNextPath } from "@/components/features/auth/auth-paths"
import { LocalModeCard } from "@/components/features/auth/local-mode-card"
import { SignupForm } from "@/components/features/auth/signup-form"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const metadata: Metadata = { title: "Create account" }

export default async function Page(props: PageProps<"/signup">) {
  if (!isSupabaseConfigured) return <LocalModeCard />
  const query = await props.searchParams
  return <SignupForm next={safeNextPath(firstParam(query.next))} />
}
