/**
 * The dev-only team fixture switch: `localStorage["pbos:dev-team"]`, set by the scripts' `--team` flag.
 * Same idea and the same production guard as `features/admin/api/dev-fixture.ts` and the Circles one.
 *
 *   fixture       your own workspace, with two sample members, a pending invite, one workspace you're a
 *                 member of and one invite waiting for you
 *   editor        the same, but the sample workspace is open and you're its Editor
 *   editor-money  Editor with Money access
 *   viewer        Viewer (read-only everywhere)
 *
 * `NODE_ENV` is inlined by Next at build time, so a production build never reads the flag and never loads
 * the fixture module (the dynamic import sits in a branch the bundler drops). `createTeamFixture` throws
 * if it is ever created in production.
 */
import { isTeamFixtureMode, type TeamFixture, type TeamFixtureMode } from "@/lib/team/fixture-api"

export const DEV_TEAM_KEY = "pbos:dev-team"

/** The fixture mode set in this browser, or null (always null in production). */
export function readTeamFixtureMode(): TeamFixtureMode | null {
  if (process.env.NODE_ENV === "production") return null
  try {
    const value = window.localStorage.getItem(DEV_TEAM_KEY)
    return isTeamFixtureMode(value) ? value : null
  } catch {
    return null
  }
}

export const isTeamFixtureEnabled = (): boolean => readTeamFixtureMode() !== null

let fixture: { key: string; value: Promise<TeamFixture> } | null = null

/** The fixture, created once per page load and mode, so changes survive tab switches. `null` in production. */
export function loadTeamFixture(self: string, mode: TeamFixtureMode): Promise<TeamFixture> | null {
  if (process.env.NODE_ENV === "production") return null
  const key = `${self}:${mode}`
  if (fixture?.key !== key) {
    fixture = { key, value: import("@/lib/team/fixture-api").then((mod) => mod.createTeamFixture({ self, mode })) }
  }
  return fixture.value
}
