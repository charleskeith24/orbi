import { describe, expect, it } from "vitest"
import { getIntegration, integrationLabels, integrationText, INTEGRATIONS, integrationsIn, localizeConnectResult } from "./registry"
import {
  INTEGRATION_AUTH_LABELS,
  INTEGRATION_CAPABILITY_LABELS,
  INTEGRATION_CATEGORIES,
  INTEGRATION_STATUS_LABELS,
  type IntegrationAuth,
  type IntegrationCapability,
  type IntegrationStatus,
} from "./types"

describe("integration registry", () => {
  it("covers the Phase 4 services with unique ids", () => {
    const ids = INTEGRATIONS.map((a) => a.id)
    expect(ids).toEqual(
      expect.arrayContaining(["meta", "instagram", "tiktok", "youtube", "linkedin", "google_drive", "canva", "buffer", "metricool", "later", "social_analytics"])
    )
    expect(new Set(ids).size).toBe(ids.length)
    expect(getIntegration("canva")?.name).toBe("Canva")
  })

  it("never pretends to be connected", async () => {
    for (const adapter of INTEGRATIONS) {
      expect(adapter.status()).toBe("not_configured")
      const result = await adapter.connect()
      expect(result.ok).toBe(false)
      expect(result.status).toBe("not_configured")
      expect(result.message).toMatch(/credentials/)
      expect(result.requirements.length).toBeGreaterThan(0)
    }
  })

  it("puts every adapter in a listed category", () => {
    const listed = INTEGRATION_CATEGORIES.flatMap((c) => integrationsIn(c.id))
    expect(listed).toHaveLength(INTEGRATIONS.length)
    for (const adapter of integrationsIn("social")) expect(adapter.capabilities).toContain("import_analytics")
  })

  it("labels English exactly like the type constants and translates them for Taglish", () => {
    const en = integrationLabels("en")
    const tl = integrationLabels("tl")
    for (const [capability, label] of Object.entries(INTEGRATION_CAPABILITY_LABELS)) expect(en.capability(capability as IntegrationCapability)).toBe(label)
    for (const [status, label] of Object.entries(INTEGRATION_STATUS_LABELS)) expect(en.status(status as IntegrationStatus)).toBe(label)
    for (const [auth, label] of Object.entries(INTEGRATION_AUTH_LABELS)) expect(en.auth(auth as IntegrationAuth)).toBe(label)
    for (const category of INTEGRATION_CATEGORIES) {
      expect(en.category(category.id)).toEqual({ label: category.label, description: category.description })
      expect(tl.category(category.id).description).not.toBe(category.description)
    }
    expect(tl.status("not_configured")).toBe("Hindi naka-connect")
  })

  it("gives every adapter Taglish text with the same number of requirements", async () => {
    for (const adapter of INTEGRATIONS) {
      expect(integrationText(adapter, "en")).toEqual({ description: adapter.description, requirements: adapter.requirements, manualPath: adapter.manualPath })
      const tl = integrationText(adapter, "tl")
      expect(tl.requirements).toHaveLength(adapter.requirements.length)
      expect(tl.description).not.toBe(adapter.description)
      expect(tl.manualPath).not.toBe(adapter.manualPath)
      const result = await adapter.connect()
      expect(localizeConnectResult(adapter, result, "en")).toBe(result)
      const localized = localizeConnectResult(adapter, result, "tl")
      expect(localized.message).toContain(adapter.name)
      expect(localized.message).not.toBe(result.message)
      expect(localized.requirements).toEqual(tl.requirements)
    }
  })
})
