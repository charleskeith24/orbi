/**
 * Demo Workspace generator — a complete fictional personal brand used by the test suite and by
 * dev-only QA runs (localStorage "pbos:dev-seed" = "demo"). Real users never see it: new workspaces
 * start from the Starter Kit (./starter) and go through onboarding.
 */
import type { Database } from "@/lib/types"
import { createContext } from "./seed/context"
import { buildDemoWorkspace } from "./seed/demo"

export { createStarterDatabase } from "./starter"

export function createDemoDatabase(userId: string, now: Date = new Date()): Database {
  return buildDemoWorkspace(createContext(userId, now))
}
