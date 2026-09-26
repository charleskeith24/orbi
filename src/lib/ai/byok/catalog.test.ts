import { describe, expect, it } from "vitest"
import { catalogModels, defaultModel, supportsRefusalFallbacks } from "./catalog"

const claude = (id: string, created: string, caps: Record<string, unknown> | null) => ({ id, display_name: id.toUpperCase(), created_at: created, ...(caps ? { capabilities: caps } : {}) })
const effortCaps = (levels: string[]) => ({
  structured_outputs: { supported: true },
  effort: { supported: true, ...Object.fromEntries(["low", "medium", "high", "xhigh", "max"].map((l) => [l, { supported: levels.includes(l) }])) },
})

describe("catalogModels", () => {
  it("keeps Claude models with structured outputs, newest first, with the effort levels each accepts", () => {
    const models = catalogModels("anthropic", [
      claude("claude-haiku-4-5", "2025-10-01T00:00:00Z", { structured_outputs: { supported: true }, effort: { supported: false } }),
      claude("claude-opus-5", "2026-05-01T00:00:00Z", effortCaps(["low", "medium", "high", "xhigh", "max"])),
      claude("claude-old", "2024-01-01T00:00:00Z", { structured_outputs: { supported: false } }),
      claude("claude-sonnet-5", "2026-03-01T00:00:00Z", null),
      { id: "not-claude" },
    ])
    expect(models.map((m) => m.id)).toEqual(["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"])
    expect(models[0].meta.effort).toEqual(["low", "medium", "high", "xhigh", "max"])
    expect(models[0].label).toBe("CLAUDE-OPUS-5")
    // No capability tree: effort is left out (always a valid request).
    expect(models[1].meta.effort).toEqual([])
    expect(models[2].meta.effort).toEqual([])
  })

  it("keeps OpenAI's chat models and leaves out audio, images, embeddings and dated snapshots", () => {
    const models = catalogModels("openai", [
      { id: "gpt-5", created: 300 },
      { id: "gpt-5-mini", created: 310 },
      { id: "gpt-4o-2024-08-06", created: 100 },
      { id: "gpt-4o-audio-preview", created: 200 },
      { id: "text-embedding-3-large", created: 150 },
      { id: "o4-mini", created: 250 },
      { id: "dall-e-3", created: 50 },
      { id: "gpt-5", created: 300 },
    ])
    expect(models.map((m) => m.id)).toEqual(["gpt-5-mini", "gpt-5", "o4-mini"])
  })

  it("keeps Gemini models that can generateContent, newest version and stable first", () => {
    const models = catalogModels("gemini", [
      { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
      { name: "models/gemini-2.5-flash-preview-09", displayName: "", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
      { name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] },
      { name: "models/imagen-4", supportedGenerationMethods: ["predict"] },
    ])
    expect(models.map((m) => m.id)).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-preview-09", "gemini-2.0-flash"])
    expect(models[0].label).toBe("Gemini 2.5 Flash")
    expect(models[1].label).toBe("gemini-2.5-flash-preview-09")
  })
})

describe("defaultModel", () => {
  it("starts Claude keys on Claude Opus 5 when the key can use it", () => {
    const models = catalogModels("anthropic", [
      claude("claude-sonnet-5", "2026-06-01T00:00:00Z", effortCaps(["high"])),
      claude("claude-opus-5", "2026-05-01T00:00:00Z", effortCaps(["high"])),
    ])
    expect(defaultModel("anthropic", models)).toBe("claude-opus-5")
    expect(defaultModel("anthropic", models.filter((m) => m.id !== "claude-opus-5"))).toBe("claude-sonnet-5")
  })

  it("starts OpenAI keys on the newest flagship, Gemini keys on the newest stable Flash", () => {
    expect(defaultModel("openai", catalogModels("openai", [{ id: "gpt-5-mini", created: 9 }, { id: "gpt-5", created: 8 }]))).toBe("gpt-5")
    expect(defaultModel("openai", catalogModels("openai", [{ id: "o4-mini", created: 1 }]))).toBe("o4-mini")
    const gemini = catalogModels("gemini", [
      { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    ])
    expect(defaultModel("gemini", gemini)).toBe("gemini-2.5-flash")
    expect(defaultModel("gemini", [])).toBeNull()
  })
})

describe("supportsRefusalFallbacks", () => {
  it("is on for the Opus 5 and Fable 5 lines only", () => {
    expect(supportsRefusalFallbacks("claude-opus-5")).toBe(true)
    expect(supportsRefusalFallbacks("claude-opus-5-5")).toBe(true)
    expect(supportsRefusalFallbacks("claude-fable-5-1")).toBe(true)
    expect(supportsRefusalFallbacks("claude-sonnet-5")).toBe(false)
    expect(supportsRefusalFallbacks("claude-haiku-4-5")).toBe(false)
  })
})
