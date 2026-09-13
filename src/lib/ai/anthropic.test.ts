import Anthropic from "@anthropic-ai/sdk"
import * as z from "zod"
import { describe, expect, it, vi } from "vitest"
import { createAnthropicProvider, mapAnthropicError } from "./providers/anthropic"

const schema = z.object({ title: z.string(), category: z.enum(["story", "list"]), points: z.array(z.string()) })

function fakeClient(message: Partial<Anthropic.Beta.BetaMessage> | Error) {
  const create = vi.fn(async () => {
    if (message instanceof Error) throw message
    return { model: "claude-opus-5", stop_reason: "end_turn", content: [], ...message } as Anthropic.Beta.BetaMessage
  })
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create }
}

const text = (value: unknown) => [{ type: "text", text: JSON.stringify(value), citations: null }] as unknown as Anthropic.Beta.BetaContentBlock[]
const opts = { system: "SYSTEM", user: "USER", schema, maxTokens: 40_000, taskName: "test", offline: () => ({ title: "", category: "story" as const, points: [] }) }

describe("Anthropic provider", () => {
  it("sends Opus 5 with effort, a strict schema, refusal fallbacks — and no sampling or thinking budget params", async () => {
    const { client, create } = fakeClient({ content: text({ title: "T", category: "list", points: ["a"] }) })
    const provider = createAnthropicProvider({ client })
    const result = await provider.generate(opts)
    expect(result).toEqual({ output: { title: "T", category: "list", points: ["a"] }, model: "claude-opus-5" })

    const params = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(params.model).toBe("claude-opus-5")
    expect(params.max_tokens).toBe(16_000)
    expect(params.fallbacks).toBe("default")
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"])
    const config = params.output_config as { effort: string; format: { type: string; schema: { properties: { category: { enum: string[] } } } } }
    expect(config.effort).toBe("high")
    expect(config.format.type).toBe("json_schema")
    expect(config.format.schema.properties.category.enum).toEqual(["story", "list"])
    for (const banned of ["temperature", "top_p", "top_k", "thinking"]) expect(params).not.toHaveProperty(banned)
    expect(params.messages).toEqual([{ role: "user", content: "USER" }])
  })

  it("sends conversation history before the final user turn", async () => {
    const { client, create } = fakeClient({ content: text({ title: "T", category: "story", points: [] }) })
    await createAnthropicProvider({ client }).generate({ ...opts, history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] })
    const params = (create.mock.calls[0] as unknown[])[0] as { messages: unknown[] }
    expect(params.messages).toHaveLength(3)
  })

  it("checks stop_reason before reading content", async () => {
    const refused = fakeClient({ stop_reason: "refusal", content: [] })
    await expect(createAnthropicProvider({ client: refused.client }).generate(opts)).rejects.toMatchObject({ code: "refusal", status: 502 })
    const cut = fakeClient({ stop_reason: "max_tokens", content: text({ title: "partial" }) })
    await expect(createAnthropicProvider({ client: cut.client }).generate(opts)).rejects.toMatchObject({ code: "truncated" })
    const overflow = fakeClient({ stop_reason: "model_context_window_exceeded", content: text({ title: "partial" }) })
    await expect(createAnthropicProvider({ client: overflow.client }).generate(opts)).rejects.toMatchObject({ code: "truncated", message: expect.stringContaining("context window") })
  })

  it("repairs near-miss output and rejects garbage", async () => {
    const near = fakeClient({ content: text({ title: "T", category: "List", points: "one" }) })
    await expect(createAnthropicProvider({ client: near.client }).generate(opts)).resolves.toMatchObject({ output: { category: "list", points: ["one"] } })
    const bad = fakeClient({ content: [{ type: "text", text: "not json", citations: null }] as unknown as Anthropic.Beta.BetaContentBlock[] })
    await expect(createAnthropicProvider({ client: bad.client }).generate(opts)).rejects.toMatchObject({ code: "invalid_output" })
  })

  it("reports the model that actually served the response (server-side fallback)", async () => {
    const { client } = fakeClient({ model: "claude-opus-4-8", content: text({ title: "T", category: "story", points: [] }) })
    await expect(createAnthropicProvider({ client }).generate(opts)).resolves.toMatchObject({ model: "claude-opus-4-8" })
  })

  it("omits effort when configured off", async () => {
    const { client, create } = fakeClient({ content: text({ title: "T", category: "story", points: [] }) })
    await createAnthropicProvider({ client, effort: null, fallbacks: false }).generate(opts)
    const params = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(params.output_config).not.toHaveProperty("effort")
    expect(params).not.toHaveProperty("fallbacks")
  })
})

describe("mapAnthropicError", () => {
  const headers = new Headers()
  it.each([
    [new Anthropic.RateLimitError(429, undefined, "rate limited", headers), 429, "rate_limited"],
    [new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", headers), 502, "provider_auth"],
    [new Anthropic.BadRequestError(400, undefined, "bad", headers), 502, "provider_error"],
    [new Anthropic.InternalServerError(529, undefined, "overloaded", headers), 503, "overloaded"],
    [new Anthropic.APIConnectionTimeoutError(), 504, "timeout"],
    [new Anthropic.APIConnectionError({ message: "ECONNRESET" }), 502, "network"],
  ] as const)("%s → %i %s", (err, status, code) => {
    const mapped = mapAnthropicError(err)
    expect(mapped.status).toBe(status)
    expect(mapped.code).toBe(code)
    expect(mapped.message).not.toMatch(/x-api-key|ECONNRESET|sk-ant/)
  })
})
