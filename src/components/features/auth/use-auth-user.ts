"use client"

import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export interface AuthUserState {
  user: User | null
  /** True until the first answer from Supabase (always false in local mode). */
  loading: boolean
}

/** The signed-in Supabase user, kept current across token refreshes and sign-ins/outs in other tabs. */
export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ user: null, loading: isSupabaseConfigured })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabaseBrowserClient()
    let active = true
    // getUser() revalidates with the server; the listener covers later changes.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      // Offline says nothing about the session: keep what the listener reported instead of showing "Sign in".
      if (isAuthRetryableFetchError(error)) setState((s) => ({ ...s, loading: false }))
      else setState({ user: data.user, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, loading: false })
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}

export interface UserDisplay {
  name: string
  email: string
  initials: string
  avatarUrl: string | null
}

/** Name, email, initials and avatar for menus. Falls back to the email's local part. */
export function describeUser(user: Pick<User, "email" | "user_metadata">): UserDisplay {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const email = user.email ?? ""
  const metaName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "")
  const name = metaName?.trim() || email.split("@")[0] || "Account"
  const words = name.split(/[\s._-]+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
  const avatarUrl = typeof meta.avatar_url === "string" && meta.avatar_url ? meta.avatar_url : null
  return { name, email, initials, avatarUrl }
}
