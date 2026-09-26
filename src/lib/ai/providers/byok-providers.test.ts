import { describe, expect, it, vi } from "vitest"
import * as z from "zod"
import { AiError } from "../errors"
import { createGeminiProvider, isInvalidGeminiKey } from "./gemini"
import { createOpenAiProvider } from "./openai"
import type { GenerateOptions } from "./types"

const schema = z.object({ ideas: z.array(z.object({ title: z.string() })) })
const opts = (extra: Partial<GenerateOptions<z.infer<typeof schema>>> = {}): GenerateOptions<z.infer<typeof schema>> => ({
  system: "You are Orbi.",
  user: "Three ideas about pricing.",
  history: [
    { role: "user", content: "Earlier question" },
    { role: "assistant", content: "Earlier answer" },
  ],
  schema,
  maxTokens: 2000,
  taskName: "ideas",
  offline: () => ({ ideas: [] }),
  ...extra,
})

function fakeFetch(status: number, body: unknown) {
  return vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
  )
}
const sent = (fetchMock: ReturnType<typeof fakeFetch>) => {
  const [url, init] = fetchMock.mock.calls[0]
  return { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) }
}
const answer = JSON.stringify({ ideas: [{ title: "Stop pricing by the hour" }] })

describe("OpenAI provider", () => {
  it("sends JSON mode with the schema in the system prompt and the history in order", async () => {
    const fetchMock = fakeFetch(200, { model: "gpt-5-2026", choices: [{ finish_reason: "stop", message: { content: answer } }] })
    const provider = createOpenAiProvider({ apiKey: "sk-test", model: "gpt-5", fetch: fetchMock })
    const result = await provider.generate(opts())
    expect(result).toEqual({ output: { ideas: [{ title: "Stop pricing by the hour" }] }, model: "gpt-5-2026" })
    const { url, headers, body } = sent(fetchMock)
    expect(url).toBe("https://api.openai.com/v1/chat/completions")
    expect(headers.authorization).toBe("Bearer sk-test")
    expect(body.response_format).toEqual({ type: "json_object" })
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user", "assistant", "user"])
    expect(body.messages[0].content).toContain("JSON Schema")
    expect(body.max_completion_tokens).toBe(10_000)
  })

  it("accepts an answer wrapped in a ```json fence", async () => {
    const provider = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(200, { choices: [{ message: { content: "```json\n" + answer + "\n```" } }] }) })
    expect((await provider.generate(opts())).output.ideas).toHaveLength(1)
  })

  it("turns refusals, cut-offs and bad keys into friendly errors that point at Settings → AI", async () => {
    const refusal = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(200, { choices: [{ message: { content: null, refusal: "No." } }] }) })
    await expect(refusal.generate(opts())).rejects.toMatchObject({ code: "refusal" })
    const cut = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(200, { choices: [{ finish_reason: "length", message: { content: "{" } }] }) })
    await expect(cut.generate(opts())).rejects.toMatchObject({ code: "truncated" })
    const bad = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(401, { error: { message: "Incorrect API key provided: sk-...abcd" } }) })
    const error = (await bad.generate(opts()).catch((e) => e)) as AiError
    expect(error.code).toBe("provider_auth")
    expect(error.message).toContain("Settings → AI")
    expect(error.message).not.toContain("sk-")
    const broke = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(429, { error: { code: "insufficient_quota" } }) })
    await expect(broke.generate(opts())).rejects.toMatchObject({ code: "rate_limited", message: expect.stringContaining("out of credit") })
  })

  it("rejects an answer that isn't JSON (a shape near the schema is coerced, as for every provider)", async () => {
    const prose = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(200, { choices: [{ message: { content: "Here are three ideas: …" } }] }) })
    await expect(prose.generate(opts())).rejects.toMatchObject({ code: "invalid_output" })
    const near = createOpenAiProvider({ apiKey: "k", model: "gpt-5", fetch: fakeFetch(200, { choices: [{ message: { content: '{"nope": true}' } }] }) })
    expect((await near.generate(opts())).output).toEqual({ ideas: [] })
  })
})

describe("Gemini provider", () => {
  it("sends the system instruction, model turns for the assistant, and JSON mode", async () => {
    const fetchMock = fakeFetch(200, { modelVersion: "gemini-2.5-flash", candidates: [{ finishReason: "STOP", content: { parts: [{ text: "thinking…", thought: true }, { text: answer }] } }] })
    const provider = createGeminiProvider({ apiKey: "AIza-test", model: "gemini-2.5-flash", fetch: fetchMock })
    const result = await provider.generate(opts())
    expect(result.output.ideas[0].title).toBe("Stop pricing by the hour")
    const { url, headers, body } = sent(fetchMock)
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
    expect(headers["x-goog-api-key"]).toBe("AIza-test")
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"])
    expect(body.systemInstruction.parts[0].text).toContain("JSON Schema")
    expect(body.generationConfig.responseMimeType).toBe("application/json")
  })

  it("reads Google's API_KEY_INVALID (a 400) as a bad key, and blocks and limits as friendly errors", async () => {
    const invalid = { error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }
    expect(isInvalidGeminiKey(400, invalid)).toBe(true)
    expect(isInvalidGeminiKey(400, { error: { status: "INVALID_ARGUMENT" } })).toBe(false)
    const bad = createGeminiProvider({ apiKey: "k", model: "gemini-2.5-flash", fetch: fakeFetch(400, invalid) })
    await expect(bad.generate(opts())).rejects.toMatchObject({ code: "provider_auth" })
    const blocked = createGeminiProvider({ apiKey: "k", model: "gemini-2.5-flash", fetch: fakeFetch(200, { promptFeedback: { blockReason: "SAFETY" } }) })
    await expect(blocked.generate(opts())).rejects.toMatchObject({ code: "refusal" })
    const limited = createGeminiProvider({ apiKey: "k", model: "gemini-2.5-flash", fetch: fakeFetch(429, { error: { status: "RESOURCE_EXHAUSTED" } }) })
    await expect(limited.generate(opts())).rejects.toMatchObject({ code: "rate_limited" })
    const cut = createGeminiProvider({ apiKey: "k", model: "gemini-2.5-flash", fetch: fakeFetch(200, { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] }) })
    await expect(cut.generate(opts())).rejects.toMatchObject({ code: "truncated" })
  })

  it("reports a network failure without leaking anything", async () => {
    const provider = createGeminiProvider({ apiKey: "k", model: "gemini-2.5-flash", fetch: vi.fn(async () => { throw new TypeError("fetch failed") }) })
    await expect(provider.generate(opts())).rejects.toMatchObject({ code: "network" })
  })
})
