/**
 * The integration registry. Each entry is a real adapter object with an honest state: no OAuth app,
 * API key or server callback is configured for this workspace, so every adapter reports
 * "not_configured" and `connect()` explains what is required instead of pretending to connect.
 */
import type { PlatformId } from "@/lib/types"
import {
  INTEGRATION_AUTH_LABELS,
  type IntegrationAdapter,
  type IntegrationAuth,
  type IntegrationCapability,
  type IntegrationCategory,
  type IntegrationId,
} from "./types"

interface IntegrationSpec {
  id: IntegrationId
  name: string
  category: IntegrationCategory
  description: string
  capabilities: IntegrationCapability[]
  auth: IntegrationAuth
  platform: PlatformId | null
  requirements: string[]
  manualPath: string
}

/** An adapter whose credentials don't exist yet: status "not_configured", connect() reports why. */
export function createUnconfiguredAdapter(spec: IntegrationSpec): IntegrationAdapter {
  const requirements = Object.freeze([...spec.requirements])
  return Object.freeze({
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    capabilities: Object.freeze([...spec.capabilities]),
    auth: spec.auth,
    platform: spec.platform,
    requirements,
    manualPath: spec.manualPath,
    status: () => "not_configured" as const,
    async connect() {
      return {
        ok: false,
        status: "not_configured" as const,
        message: `${spec.name} can't be connected yet — it requires ${INTEGRATION_AUTH_LABELS[spec.auth]} that haven't been configured for this workspace.`,
        requirements: [...requirements],
      }
    },
  })
}

const CALLBACK = "An OAuth redirect URL registered for your deployment"
const SERVER_ROUTE = "A server-side route that stores tokens and calls the API (keys never reach the browser)"

const SPECS: IntegrationSpec[] = [
  {
    id: "meta",
    name: "Meta · Facebook Pages",
    category: "social",
    description: "Page posts with reach, reactions, comments and shares.",
    capabilities: ["import_analytics", "import_posts", "publish"],
    auth: "oauth2",
    platform: "facebook",
    requirements: [
      "A Meta developer app (App ID and App Secret)",
      "App Review approval for Page insights permissions",
      "A Facebook Page you manage",
      CALLBACK,
    ],
    manualPath: "Export post insights from Meta Business Suite and import the CSV.",
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "social",
    description: "Reels and posts with reach, saves and shares for professional accounts.",
    capabilities: ["import_analytics", "import_posts", "publish"],
    auth: "oauth2",
    platform: "instagram",
    requirements: [
      "An Instagram professional (Business or Creator) account",
      "A Meta developer app with Instagram permissions approved in App Review",
      CALLBACK,
    ],
    manualPath: "Export insights from Meta Business Suite and import the CSV.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "social",
    description: "Video views, likes, comments and shares.",
    capabilities: ["import_analytics", "publish"],
    auth: "oauth2",
    platform: "tiktok",
    requirements: [
      "A TikTok for Developers app (client key and secret)",
      "Approved scopes for reading videos (and content posting to publish)",
      CALLBACK,
    ],
    manualPath: "Download your post analytics from TikTok and import the CSV.",
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "social",
    description: "Views, watch time and average percentage viewed per video.",
    capabilities: ["import_analytics", "import_posts", "publish"],
    auth: "oauth2",
    platform: "youtube",
    requirements: [
      "A Google Cloud project with the YouTube Data and YouTube Analytics APIs enabled",
      "An OAuth client (client ID and secret) with a consent screen",
      CALLBACK,
    ],
    manualPath: "Export a table from YouTube Studio analytics and import the CSV.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "social",
    description: "Post impressions, reactions, comments and follower growth.",
    capabilities: ["import_analytics", "publish"],
    auth: "oauth2",
    platform: "linkedin",
    requirements: [
      "A LinkedIn developer app verified by a Company Page",
      "Approved access to LinkedIn's post analytics products",
      CALLBACK,
    ],
    manualPath: "Export post analytics from LinkedIn and import the CSV.",
  },
  {
    id: "metricool",
    name: "Metricool",
    category: "analytics",
    description: "Cross-platform analytics and scheduling from one account.",
    capabilities: ["import_analytics", "schedule"],
    auth: "api_key",
    platform: null,
    requirements: ["A Metricool plan that includes API access", "Your Metricool API token and brand ID", SERVER_ROUTE],
    manualPath: "Export a Metricool report as CSV and import it.",
  },
  {
    id: "social_analytics",
    name: "Social analytics API",
    category: "analytics",
    description: "Any analytics provider with a REST API — an aggregator or data warehouse you already use.",
    capabilities: ["import_analytics"],
    auth: "api_key",
    platform: null,
    requirements: ["The provider's API credentials", "A mapping from its fields to this workspace's metrics", SERVER_ROUTE],
    manualPath: "Export from your analytics tool as CSV — the column mapper reads most formats.",
  },
  {
    id: "buffer",
    name: "Buffer",
    category: "scheduling",
    description: "Send approved posts to your Buffer queue.",
    capabilities: ["schedule", "publish"],
    auth: "oauth2",
    platform: null,
    requirements: ["Buffer API access (developer app credentials)", CALLBACK],
    manualPath: "Copy the caption from Content Studio into Buffer, then log the post here.",
  },
  {
    id: "later",
    name: "Later",
    category: "scheduling",
    description: "Visual planning and scheduling for Instagram, TikTok and more.",
    capabilities: ["schedule", "publish"],
    auth: "oauth2",
    platform: null,
    requirements: ["Later API partner access", "OAuth app credentials (client ID and secret)", CALLBACK],
    manualPath: "Schedule in Later, then log the post here once it's live.",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "assets",
    description: "Attach raw footage, thumbnails and final exports to content items.",
    capabilities: ["assets"],
    auth: "oauth2",
    platform: null,
    requirements: [
      "A Google Cloud project with the Drive API enabled",
      "An OAuth client (client ID and secret) with a consent screen",
      CALLBACK,
    ],
    manualPath: "Paste Drive links into the brief's reference or production notes.",
  },
  {
    id: "canva",
    name: "Canva",
    category: "assets",
    description: "Start designs from a brief and bring finished exports back.",
    capabilities: ["design", "assets"],
    auth: "oauth2",
    platform: null,
    requirements: ["A Canva Connect integration (client ID and secret)", CALLBACK],
    manualPath: "Design in Canva and paste the share link into the brief.",
  },
]

export const INTEGRATIONS: readonly IntegrationAdapter[] = Object.freeze(SPECS.map(createUnconfiguredAdapter))

export function getIntegration(id: IntegrationId): IntegrationAdapter | undefined {
  return INTEGRATIONS.find((adapter) => adapter.id === id)
}

export function integrationsIn(category: IntegrationCategory): IntegrationAdapter[] {
  return INTEGRATIONS.filter((adapter) => adapter.category === category)
}

export function connectedCount(): number {
  return INTEGRATIONS.filter((adapter) => adapter.status() === "connected").length
}
