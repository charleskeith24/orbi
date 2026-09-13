import type { Metadata } from "next"
import { firstParam, safeNextPath } from "@/components/features/auth/auth-paths"
import { LocalModeCard } from "@/components/features/auth/local-mode-card"
import { LoginForm } from "@/components/features/auth/login-form"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const metadata: Metadata = { title: "Sign in" }

export default async function Page(props: PageProps<"/login">) {
  if (!isSupabaseConfigured) return <LocalModeCard />
  const query = await props.searchParams
  return <LoginForm next={safeNextPath(firstParam(query.next))} errorCode={firstParam(query.error)} />
}
