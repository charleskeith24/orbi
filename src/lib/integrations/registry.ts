/**
 * The integration registry. Each entry is a real adapter object with an honest state: no OAuth app,
 * API key or server callback is configured for this workspace, so every adapter reports
 * "not_configured" and `connect()` explains what is required instead of pretending to connect.
 */
import { translator, type UiLang } from "@/lib/i18n/core"
import type { PlatformId } from "@/lib/types"
import { registryMessages } from "./registry-messages"
import {
  INTEGRATION_AUTH_LABELS,
  INTEGRATION_CATEGORIES,
  type IntegrationAdapter,
  type IntegrationAuth,
  type IntegrationCapability,
  type IntegrationCategory,
  type IntegrationConnectResult,
  type IntegrationId,
  type IntegrationStatus,
} from "./types"

type RegistryKey = keyof (typeof registryMessages)["en"] & string
const EN = registryMessages.en

interface IntegrationSpec {
  id: IntegrationId
  name: string
  category: IntegrationCategory
  capabilities: IntegrationCapability[]
  auth: IntegrationAuth
  platform: PlatformId | null
  /** Message keys, in order; the English text becomes the adapter's `requirements`. */
  requirements: RegistryKey[]
}

const descriptionKey = (id: IntegrationId) => `${id}_description` as RegistryKey
const manualKey = (id: IntegrationId) => `${id}_manual` as RegistryKey

/** An adapter whose credentials don't exist yet: status "not_configured", connect() reports why. */
export function createUnconfiguredAdapter(spec: IntegrationSpec): IntegrationAdapter {
  const requirements = Object.freeze(spec.requirements.map((key) => EN[key]))
  return Object.freeze({
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: EN[descriptionKey(spec.id)],
    capabilities: Object.freeze([...spec.capabilities]),
    auth: spec.auth,
    platform: spec.platform,
    requirements,
    manualPath: EN[manualKey(spec.id)],
    status: () => "not_configured" as const,
    async connect() {
      return {
        ok: false,
        status: "not_configured" as const,
        message: connectMessage(spec.name, spec.auth, "en"),
        requirements: [...requirements],
      }
    },
  })
}

function connectMessage(name: string, auth: IntegrationAuth, lang: UiLang): string {
  const t = translator(registryMessages, lang)
  return t("connect_message", { name, auth: lang === "en" ? INTEGRATION_AUTH_LABELS[auth] : t(`auth_${auth}`) })
}

const CALLBACK: RegistryKey = "req_callback"
const SERVER_ROUTE: RegistryKey = "req_server_route"

const SPECS: IntegrationSpec[] = [
  {
    id: "meta",
    name: "Meta · Facebook Pages",
    category: "social",
    capabilities: ["import_analytics", "import_posts", "publish"],
    auth: "oauth2",
    platform: "facebook",
    requirements: ["meta_req_app", "meta_req_review", "meta_req_page", CALLBACK],
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "social",
    capabilities: ["import_analytics", "import_posts", "publish"],
    auth: "oauth2",
    platform: "instagram",
    requirements: ["instagram_req_account", "instagram_req_app", CALLBACK],
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "social",
    capabilities: ["import_analytics", "publish"],
    auth: "oauth2",
    platform: "tiktok",
    requirements: ["tiktok_req_app", "tiktok_req_scopes", CALLBACK],
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "social",
    capabilities: ["import_analytics", "import_posts", "publish"],
    auth: "oauth2",
    platform: "youtube",
    requirements: ["youtube_req_project", "youtube_req_client", CALLBACK],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "social",
    capabilities: ["import_analytics", "publish"],
    auth: "oauth2",
    platform: "linkedin",
    requirements: ["linkedin_req_app", "linkedin_req_access", CALLBACK],
  },
  {
    id: "metricool",
    name: "Metricool",
    category: "analytics",
    capabilities: ["import_analytics", "schedule"],
    auth: "api_key",
    platform: null,
    requirements: ["metricool_req_plan", "metricool_req_token", SERVER_ROUTE],
  },
  {
    id: "social_analytics",
    name: "Social analytics API",
    category: "analytics",
    capabilities: ["import_analytics"],
    auth: "api_key",
    platform: null,
    requirements: ["social_analytics_req_credentials", "social_analytics_req_mapping", SERVER_ROUTE],
  },
  {
    id: "buffer",
    name: "Buffer",
    category: "scheduling",
    capabilities: ["schedule", "publish"],
    auth: "oauth2",
    platform: null,
    requirements: ["buffer_req_access", CALLBACK],
  },
  {
    id: "later",
    name: "Later",
    category: "scheduling",
    capabilities: ["schedule", "publish"],
    auth: "oauth2",
    platform: null,
    requirements: ["later_req_partner", "later_req_credentials", CALLBACK],
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "assets",
    capabilities: ["assets"],
    auth: "oauth2",
    platform: null,
    requirements: ["google_drive_req_project", "google_drive_req_client", CALLBACK],
  },
  {
    id: "canva",
    name: "Canva",
    category: "assets",
    capabilities: ["design", "assets"],
    auth: "oauth2",
    platform: null,
    requirements: ["canva_req_integration", CALLBACK],
  },
]

const REQUIREMENT_KEYS = new Map(SPECS.map((spec) => [spec.id, spec.requirements]))

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

/* ------------------------------ Display text ------------------------------ */

/** An adapter's description, requirements and manual path in the UI language (English = the adapter's own text). */
export function integrationText(
  adapter: IntegrationAdapter,
  lang: UiLang
): { description: string; requirements: readonly string[]; manualPath: string } {
  const keys = REQUIREMENT_KEYS.get(adapter.id)
  if (lang === "en" || !keys) return { description: adapter.description, requirements: adapter.requirements, manualPath: adapter.manualPath }
  const t = translator(registryMessages, lang)
  return { description: t(descriptionKey(adapter.id)), requirements: keys.map((key) => t(key)), manualPath: t(manualKey(adapter.id)) }
}

/** `connect()`'s outcome in the UI language: the "not configured" explanation is rebuilt; anything else is shown as returned. */
export function localizeConnectResult(adapter: IntegrationAdapter, result: IntegrationConnectResult, lang: UiLang): IntegrationConnectResult {
  if (lang === "en" || result.status !== "not_configured") return result
  return { ...result, message: connectMessage(adapter.name, adapter.auth, lang), requirements: [...integrationText(adapter, lang).requirements] }
}

/** Category, capability, status and auth labels (the English constants live in `types.ts`). */
export function integrationLabels(lang: UiLang) {
  const t = translator(registryMessages, lang)
  return {
    category: (id: IntegrationCategory) => {
      const category = INTEGRATION_CATEGORIES.find((c) => c.id === id)
      return lang === "en" && category
        ? { label: category.label, description: category.description }
        : { label: t(`category_${id}_label`), description: t(`category_${id}_description`) }
    },
    capability: (capability: IntegrationCapability) => t(`capability_${capability}`),
    status: (status: IntegrationStatus) => t(`status_${status}`),
    auth: (auth: IntegrationAuth) => t(`auth_${auth}`),
  }
}
