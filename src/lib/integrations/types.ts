/**
 * Integration adapters (spec §58, Phase 4). Every external service the workspace could talk to is
 * described by one adapter. Nothing here fakes a connection: until OAuth app credentials (or API
 * keys) and a server-side callback exist, `status()` is "not_configured" and `connect()` explains
 * what is missing. The manual path (CSV import, Log Published Post) always works.
 */
import type { PlatformId } from "@/lib/types"

export type IntegrationId =
  | "meta"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "google_drive"
  | "canva"
  | "buffer"
  | "metricool"
  | "later"
  | "social_analytics"

export type IntegrationCategory = "social" | "scheduling" | "analytics" | "assets"

export type IntegrationCapability = "import_analytics" | "import_posts" | "publish" | "schedule" | "assets" | "design"

/** Connection state. `not_configured` = the app credentials this integration needs don't exist yet. */
export type IntegrationStatus = "not_configured" | "disconnected" | "connected" | "error"

export type IntegrationAuth = "oauth2" | "api_key"

export interface IntegrationConnectResult {
  ok: boolean
  status: IntegrationStatus
  /** User-facing explanation of the outcome. */
  message: string
  /** What must exist before a connection can work. */
  requirements: string[]
}

export interface IntegrationAdapter {
  readonly id: IntegrationId
  readonly name: string
  readonly category: IntegrationCategory
  /** One sentence: what the integration would bring into the workspace. */
  readonly description: string
  readonly capabilities: readonly IntegrationCapability[]
  readonly auth: IntegrationAuth
  /** Platform glyph for social networks; null for tools. */
  readonly platform: PlatformId | null
  /** Plain-language prerequisites (developer app, review, callback URL…). */
  readonly requirements: readonly string[]
  /** How to get the same result by hand while the integration isn't connected. */
  readonly manualPath: string
  status(): IntegrationStatus
  connect(): Promise<IntegrationConnectResult>
}

export const INTEGRATION_CATEGORIES: { id: IntegrationCategory; label: string; description: string }[] = [
  { id: "social", label: "Social platforms", description: "Pull post analytics and publish from the networks you post on." },
  { id: "analytics", label: "Analytics", description: "Bring cross-platform numbers in from the tools you already use." },
  { id: "scheduling", label: "Scheduling & publishing", description: "Hand approved content to your scheduler." },
  { id: "assets", label: "Assets & design", description: "Keep footage, thumbnails and designs next to the content they belong to." },
]

export const INTEGRATION_CAPABILITY_LABELS: Record<IntegrationCapability, string> = {
  import_analytics: "Import analytics",
  import_posts: "Import posts",
  publish: "Publish",
  schedule: "Schedule",
  assets: "Assets",
  design: "Design",
}

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: "Not connected",
  disconnected: "Disconnected",
  connected: "Connected",
  error: "Connection error",
}

export const INTEGRATION_AUTH_LABELS: Record<IntegrationAuth, string> = {
  oauth2: "OAuth app credentials",
  api_key: "API credentials",
}
