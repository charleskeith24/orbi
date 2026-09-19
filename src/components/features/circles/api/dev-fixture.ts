/**
 * The dev-only Circles fixture switch (docs/CIRCLES.md): `localStorage["pbos:dev-circles"] = "fixture"`, set
 * by the scripts' `--circles` flag. Same pattern as the admin fixture (`features/admin/api/dev-fixture.ts`).
 *
 * Production guard: both functions check `process.env.NODE_ENV`, which Next inlines at build time, so in a
 * production build the flag is never read and the fixture module is never loaded (the dynamic import sits
 * in a branch the bundler drops). `createCirclesFixture` also throws if it's ever created in production.
 */
import type { CirclesApi } from "@/lib/circles/types"

export const DEV_CIRCLES_KEY = "pbos:dev-circles"
export const DEV_CIRCLES_FIXTURE = "fixture"

/** True only in development, with the flag set in this browser. */
export function isCirclesFixtureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  try {
    return window.localStorage.getItem(DEV_CIRCLES_KEY) === DEV_CIRCLES_FIXTURE
  } catch {
    return false
  }
}

let fixture: Promise<CirclesApi> | null = null

/** The fixture, created once per page load so changes survive client-side navigation. `null` in production. */
export function loadCirclesFixture(weekStartsOn: 0 | 1 = 1): Promise<CirclesApi> | null {
  if (process.env.NODE_ENV === "production") return null
  fixture ??= import("@/lib/circles/fixture-api").then((mod) => mod.createCirclesFixture({ weekStartsOn }))
  return fixture
}
