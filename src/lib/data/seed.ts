/**
 * Starter Kit and Demo Workspace generators.
 *
 *   createStarterDatabase(userId, now) → library data every workspace needs (formats, angles,
 *     hook templates, goals, platform strategies, posting schedule, tags, settings, blank brand)
 *   createDemoDatabase(userId, now)    → the Starter Kit plus a complete, realistic personal brand
 *
 * Both are deterministic: the same user id and calendar day produce the same rows and ids.
 * Content lives in `./seed/*`.
 */
import type { Database } from "@/lib/types"
import { createContext } from "./seed/context"
import { buildDemoWorkspace } from "./seed/demo"
import { buildStarterKit } from "./seed/starter"

export function createStarterDatabase(userId: string, now: Date = new Date()): Database {
  const ctx = createContext(userId, now)
  return buildStarterKit(ctx, now)
}

export function createDemoDatabase(userId: string, now: Date = new Date()): Database {
  return buildDemoWorkspace(createContext(userId, now))
}
