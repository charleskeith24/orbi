"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useSyncExternalStore } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * Whether the signed-in user is an admin — only to show the "Admin" entry in the account menu and ⌘K.
 * Online version only; asks `public.is_admin()` once per browser session (cached per user in sessionStorage)
 * and never blocks rendering: it's `false` until the answer arrives. The server gate decides real access.
 */
export const IS_ADMIN_CACHE_KEY = "pbos:is-admin"

type SessionStore = Pick<Storage, "getItem" | "setItem">

function readCache(storage: SessionStore | null, userId: string): boolean | null {
  try {
    const raw = storage?.getItem(IS_ADMIN_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { u?: unknown; a?: unknown }
    return parsed.u === userId && typeof parsed.a === "boolean" ? parsed.a : null
  } catch {
    return null
  }
}

function writeCache(storage: SessionStore | null, userId: string, value: boolean) {
  try {
    storage?.setItem(IS_ADMIN_CACHE_KEY, JSON.stringify({ u: userId, a: value }))
  } catch {
    // Storage unavailable — ask again next page load.
  }
}

/**
 * The answer for the current session. Any error — signed out, the admin migration not applied yet — counts
 * as "not admin" and isn't cached, so the next page load asks again.
 */
export async function resolveIsAdmin(supabase: SupabaseClient, storage: SessionStore | null): Promise<boolean> {
  // The local session is enough to key the cache; the RPC itself is checked by the database.
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return false
  const cached = readCache(storage, userId)
  if (cached !== null) return cached
  const { data: isAdmin, error } = await supabase.rpc("is_admin")
  if (error) return false
  writeCache(storage, userId, isAdmin === true)
  return isAdmin === true
}

let known = false
/** Whether `known` is the answer yet (local mode answers `false` at once). */
let resolved = false
let started = false
const listeners = new Set<() => void>()

function publish(value: boolean) {
  if (resolved && value === known) return
  known = value
  resolved = true
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function sessionStore(): SessionStore | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function startAdminCheck() {
  if (started) return
  started = true
  if (!isSupabaseConfigured) return publish(false)
  resolveIsAdmin(getSupabaseBrowserClient(), sessionStore()).then(publish, () => publish(false))
}

export function useIsAdmin(): boolean {
  const value = useSyncExternalStore(subscribe, () => known, () => false)
  useEffect(startAdminCheck, [])
  return value
}

/** The same answer, or `null` while it's still being asked — for decisions that must wait for it (DataGate). */
export function useAdminCheck(): boolean | null {
  const value = useSyncExternalStore(subscribe, () => (resolved ? known : null), () => null)
  useEffect(startAdminCheck, [])
  return value
}
