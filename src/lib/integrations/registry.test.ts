import { describe, expect, it } from "vitest"
import { getIntegration, INTEGRATIONS, integrationsIn } from "./registry"
import { INTEGRATION_CATEGORIES } from "./types"

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
})
