/**
 * Starter Kit — the library every new workspace needs: content formats, angles, hook templates,
 * goals, platform strategies, a posting schedule, tags, settings and a blank brand profile
 * (onboarding not completed). Deterministic per user id and calendar day.
 *
 * Kept apart from the demo generator (`./seed`) so the demo never ships in the app bundle.
 */
import type { Database } from "@/lib/types"
import { createContext } from "./seed/context"
import { buildStarterKit } from "./seed/starter"

export function createStarterDatabase(userId: string, now: Date = new Date()): Database {
  return buildStarterKit(createContext(userId, now), now)
}
