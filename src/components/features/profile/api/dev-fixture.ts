/**
 * The dev-only sample profiles ride on the Circles fixture switch (`localStorage["pbos:dev-circles"] = "fixture"`,
 * the scripts' `--circles` flag): the sample circle members get sample profiles and photos, and your own profile
 * stays the real local one. Same production guard as `features/circles/api/dev-fixture.ts`: `NODE_ENV` is inlined
 * at build time, so a production build never reads the flag or loads the fixture module, and creating the fixture
 * in production throws.
 */
import { isCirclesFixtureEnabled } from "@/components/features/circles/api/dev-fixture"
import type { ProfilesApi } from "@/lib/profiles/types"

/** True only in development, with the Circles fixture on in this browser. */
export function isProfilesFixtureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  return isCirclesFixtureEnabled()
}

let fixture: { base: ProfilesApi; api: Promise<ProfilesApi> } | null = null

/** The fixture around `base` (your local profile), created once per page load. `null` in production. */
export function loadProfilesFixture(base: ProfilesApi): Promise<ProfilesApi> | null {
  if (process.env.NODE_ENV === "production") return null
  if (!fixture || fixture.base.self !== base.self) {
    fixture = { base, api: import("@/lib/profiles/fixture-api").then((mod) => mod.createProfilesFixture({ base })) }
  }
  return fixture.api
}
