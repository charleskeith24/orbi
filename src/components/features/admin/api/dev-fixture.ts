/**
 * The dev-only admin fixture switch (docs/ADMIN_BRIEF.md §5): `localStorage["pbos:dev-admin"] = "fixture"`,
 * set by the scripts' `--admin` flag. Same idea as the `pbos:dev-seed` QA seed.
 *
 * Production guard: both functions check `process.env.NODE_ENV`, which Next inlines at build time, so in a
 * production build the flag is never read and the fixture module is never loaded (the dynamic import sits
 * in a branch the bundler drops). `createAdminFixture` also throws if it's ever created in production.
 */
import type { AdminFixture } from "./fixture-api"

export const DEV_ADMIN_KEY = "pbos:dev-admin"
export const DEV_ADMIN_FIXTURE = "fixture"

/** True only in development, with the flag set in this browser. */
export function isAdminFixtureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  try {
    return window.localStorage.getItem(DEV_ADMIN_KEY) === DEV_ADMIN_FIXTURE
  } catch {
    return false
  }
}

let fixture: Promise<AdminFixture> | null = null

/** The fixture, created once per page load so changes survive tab switches. `null` in production. */
export function loadAdminFixture(): Promise<AdminFixture> | null {
  if (process.env.NODE_ENV === "production") return null
  fixture ??= import("./fixture-api").then((mod) => mod.createAdminFixture())
  return fixture
}
