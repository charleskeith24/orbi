"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createLocalProfilesApi } from "@/lib/profiles/local-api"
import { useDataStore } from "@/lib/store/data-store"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { isProfilesFixtureEnabled, loadProfilesFixture } from "./api/dev-fixture"
import { createSupabaseProfilesApi } from "./api/supabase-api"
import { profileActions, type BrandForProfile } from "./profile-store"

const subscribeStorage = (listener: () => void) => {
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}
const readFixture = () => isProfilesFixtureEnabled()
const serverFixture = () => false

/** Your Brand HQ's niche and main platforms, read when needed (never stored in the profile). */
const brandForProfile: BrandForProfile = () => {
  const brand = useDataStore.getState().db.brand_profiles[0]
  return brand ? { niche: brand.niche, main_platforms: brand.main_platforms } : null
}

/**
 * Picks the session's profiles client once the workspace is loaded (mounted once, in the app shell):
 * - online version: the signed-in user's Supabase client;
 * - local mode: this browser's local profile — or, in development with the Circles fixture on, the local
 *   profile plus the sample people.
 */
export function ProfilesSync() {
  const userId = useDataStore((s) => s.userId)
  const status = useDataStore((s) => s.status)
  const fixture = useSyncExternalStore(subscribeStorage, readFixture, serverFixture)

  useEffect(() => {
    if (status !== "ready" || !userId) return
    if (isSupabaseConfigured) {
      profileActions.connect(`live:${userId}`, createSupabaseProfilesApi(getSupabaseBrowserClient(), userId), brandForProfile)
      return
    }
    const local = createLocalProfilesApi({ self: userId, brand: brandForProfile })
    if (!fixture) {
      profileActions.connect(`local:${userId}`, local, brandForProfile)
      return
    }
    let active = true
    void loadProfilesFixture(local)?.then((api) => {
      if (active) profileActions.connect(`fixture:${userId}`, api, brandForProfile)
    })
    return () => {
      active = false
    }
  }, [status, userId, fixture])

  return null
}
