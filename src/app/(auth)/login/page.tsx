import type { Metadata } from "next"
import { firstParam, safeNextPath } from "@/components/features/auth/auth-paths"
import { LocalModeCard } from "@/components/features/auth/local-mode-card"
import { LoginForm } from "@/components/features/auth/login-form"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const metadata: Metadata = { title: "Sign in" }

export default async function Page(props: PageProps<"/login">) {
  const query = await props.searchParams
  // Dev-only QA path (`/login?preview=login`): the online version's form on the local dev server (it can't sign in).
  const preview = process.env.NODE_ENV !== "production" && firstParam(query.preview) === "login"
  if (!isSupabaseConfigured && !preview) return <LocalModeCard />
  return <LoginForm next={safeNextPath(firstParam(query.next))} errorCode={firstParam(query.error)} />
}
