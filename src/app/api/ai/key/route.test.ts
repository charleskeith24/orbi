/** /api/ai/key (your own AI key) with a signed-in session, an in-memory ai_keys table and the provider check mocked. */
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  configured: true,
  secretKey: true,
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  rows: new Map<string, Record<string, unknown>>(),
  listKeyModels: null as unknown as import("vitest").Mock<(...args: unknown[]) => Promise<unknown>>,
}))

vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return state.configured
  },
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
}))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  isSecretKeyConfigured: () => state.secretKey,
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: async () => ({ data: state.rows.get(id) ?? null, error: null }) }) }),
      upsert: async (row: Row) => {
        state.rows.set(String(row.user_id), { ...row })
        return { error: null }
      },
      update: (patch: Row) => ({
        eq: async (_: string, id: string) => {
          const row = state.rows.get(id)
          if (row) state.rows.set(id, { ...row, ...patch })
          return { error: null }
        },
      }),
      delete: () => ({
        eq: async (_: string, id: string) => {
          state.rows.delete(id)
          return { error: null }
        },
      }),
    }),
  }),
}))
vi.mock("@/lib/ai/byok/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/byok/models")>()
  state.listKeyModels = vi.fn()
  return { ...actual, listKeyModels: (...args: unknown[]) => state.listKeyModels(...args) }
})

const { GET, PUT, PATCH, DELETE } = await import("./route")
const { AiKeyError } = await import("@/lib/ai/byok/models")
const { decryptApiKey, readAiKeySecret } = await import("@/lib/ai/byok/crypto")

const SITE = "https://orbi.test"
const KEY = "sk-ant-api03-EXAMPLEEXAMPLEEXAMPLE-wxyz"
const MODELS = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", sort: 3, meta: { effort: ["low", "high"] } },
  { id: "claude-opus-5", label: "Claude Opus 5", sort: 2, meta: { effort: ["low", "medium", "high", "xhigh", "max"] } },
]

const request = (method: string, body?: unknown, headers: Record<string, string> = { Origin: SITE }, query = "") =>
  new Request(`${SITE}/api/ai/key${query}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const json = async (response: Response) => ({ status: response.status, body: (await response.json()) as Record<string, unknown> })
const stored = () => state.rows.get(state.user!.id)

beforeEach(() => {
  state.configured = true
  state.secretKey = true
  state.user = { id: "11111111-1111-4111-8111-111111111111" }
  state.rows.clear()
  state.listKeyModels.mockReset()
  state.listKeyModels.mockResolvedValue(MODELS)
  process.env.AI_KEY_SECRET = "s".repeat(44)
})

describe("/api/ai/key — who may use it", () => {
  it("answers local mode honestly", async () => {
    state.configured = false
    expect(await json(await GET(request("GET")))).toEqual({ status: 200, body: { status: "local" } })
    expect((await json(await PUT(request("PUT", { provider: "anthropic", key: KEY })))).body.code).toBe("local")
  })

  it("needs a signed-in person and, for changes, this site's Origin", async () => {
    state.user = null
    expect((await json(await PUT(request("PUT", { provider: "anthropic", key: KEY })))).status).toBe(401)
    state.user = { id: "11111111-1111-4111-8111-111111111111" }
    const crossSite = await json(await PUT(request("PUT", { provider: "anthropic", key: KEY }, { Origin: "https://evil.example" })))
    expect(crossSite).toMatchObject({ status: 403, body: { code: "bad_origin" } })
    expect(state.listKeyModels).not.toHaveBeenCalled()
  })

  it("says so when the owner hasn't set AI_KEY_SECRET (or the secret key)", async () => {
    delete process.env.AI_KEY_SECRET
    expect((await json(await GET(request("GET")))).body).toEqual({ status: "not_configured" })
    expect((await json(await PUT(request("PUT", { provider: "gemini", key: KEY })))).body.code).toBe("not_configured")
    process.env.AI_KEY_SECRET = "s".repeat(44)
    state.secretKey = false
    expect((await json(await GET(request("GET")))).body).toEqual({ status: "not_configured" })
  })
})

describe("/api/ai/key — saving a key", () => {
  it("checks the key with the provider, stores it encrypted and never sends it back", async () => {
    const { status, body } = await json(await PUT(request("PUT", { provider: "anthropic", key: `  ${KEY}\n` })))
    expect(status).toBe(200)
    expect(state.listKeyModels).toHaveBeenCalledWith("anthropic", KEY)
    expect(body).toMatchObject({ status: "saved", provider: "anthropic", model: "claude-opus-5", hint: "wxyz" })
    expect(body.models).toEqual([
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-opus-5", label: "Claude Opus 5" },
    ])
    expect(JSON.stringify(body)).not.toContain(KEY)
    const row = stored()!
    expect(row.key_ciphertext).not.toContain(KEY)
    expect(decryptApiKey(String(row.key_ciphertext), readAiKeySecret()!, state.user!.id)).toBe(KEY)
    expect(row.model_meta).toEqual({ effort: ["low", "medium", "high", "xhigh", "max"] })
  })

  it("keeps a chosen model the key can use", async () => {
    const { body } = await json(await PUT(request("PUT", { provider: "anthropic", key: KEY, model: "claude-sonnet-5" })))
    expect(body.model).toBe("claude-sonnet-5")
    expect(stored()!.model_meta).toEqual({ effort: ["low", "high"] })
  })

  it("stores nothing when the provider refuses the key, and explains why", async () => {
    state.listKeyModels.mockRejectedValue(new AiKeyError("Claude didn't accept this key.", "invalid_key", 400))
    expect(await json(await PUT(request("PUT", { provider: "anthropic", key: KEY })))).toMatchObject({ status: 400, body: { code: "invalid_key" } })
    expect(stored()).toBeUndefined()
  })

  it("refuses what can't be a key or a provider before calling anyone", async () => {
    expect((await json(await PUT(request("PUT", { provider: "anthropic", key: "short" })))).body.code).toBe("invalid")
    expect((await json(await PUT(request("PUT", { provider: "mistral", key: KEY })))).body.code).toBe("invalid")
    expect((await json(await PUT(request("PUT", { provider: "anthropic", key: `${KEY} ${KEY}` })))).body.code).toBe("invalid")
    expect(state.listKeyModels).not.toHaveBeenCalled()
  })
})

describe("/api/ai/key — reading, switching and removing", () => {
  beforeEach(async () => {
    await PUT(request("PUT", { provider: "anthropic", key: KEY }))
    state.listKeyModels.mockClear()
  })

  it("describes the saved key, and lists its models only when asked", async () => {
    const plain = await json(await GET(request("GET")))
    expect(plain.body).toMatchObject({ status: "saved", provider: "anthropic", model: "claude-opus-5", hint: "wxyz" })
    expect(plain.body.models).toBeUndefined()
    expect(state.listKeyModels).not.toHaveBeenCalled()
    const withModels = await json(await GET(request("GET", undefined, {}, "?models=1")))
    expect(state.listKeyModels).toHaveBeenCalledWith("anthropic", KEY)
    expect(withModels.body.models).toHaveLength(2)
  })

  it("keeps the key when listing its models fails, and says so", async () => {
    state.listKeyModels.mockRejectedValue(new AiKeyError("Couldn't check the key with Claude right now.", "provider_error", 502))
    const { body } = await json(await GET(request("GET", undefined, {}, "?models=1")))
    expect(body).toMatchObject({ status: "saved", modelsError: "Couldn't check the key with Claude right now." })
  })

  it("switches only to a model the key can use", async () => {
    expect(await json(await PATCH(request("PATCH", { model: "gpt-5" })))).toMatchObject({ status: 400, body: { code: "unknown_model" } })
    const { body } = await json(await PATCH(request("PATCH", { model: "claude-sonnet-5" })))
    expect(body.model).toBe("claude-sonnet-5")
    expect(stored()).toMatchObject({ model: "claude-sonnet-5", model_meta: { effort: ["low", "high"] } })
  })

  it("forgets the key", async () => {
    expect((await json(await DELETE(request("DELETE")))).body).toEqual({ status: "none" })
    expect(stored()).toBeUndefined()
    expect((await json(await GET(request("GET")))).body).toEqual({ status: "none" })
  })

  it("won't read another account's row as yours", async () => {
    const row = stored()!
    state.user = { id: "22222222-2222-4222-8222-222222222222" }
    state.rows.set(state.user.id, { ...row, user_id: state.user.id })
    const { body } = await json(await GET(request("GET", undefined, {}, "?models=1")))
    expect(body.modelsError).toMatch(/add it again/)
    expect(state.listKeyModels).not.toHaveBeenCalled()
  })
})
