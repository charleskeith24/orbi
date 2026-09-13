import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/ai/route"
import { GET } from "@/app/api/ai/status/route"
import { createDemoDatabase } from "@/lib/data/seed"
import { buildBrandContext } from "./context"
import { AiError } from "./errors"
import type { AiProvider } from "./providers/types"
import { executeAiTask } from "./server"

const NOW = new Date(2026, 8, 11, 10, 0, 0)
const ctx = buildBrandContext(createDemoDatabase("demo-user", NOW), NOW)

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "")
  vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "")
  vi.stubEnv("AI_PROVIDER", "")
})
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/ai", () => {
  it("uses the offline engine when no API key is set", async () => {
    const res = await post({ task: "capture_idea", input: { text: "Most founders scale ads before fixing their offer." }, context: ctx })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.provider).toBe("offline")
    expect(json.model).toBe("offline-templates")
    expect(typeof json.durationMs).toBe("number")
    expect(json.output.title).toBeTruthy()
  })

  it("works with a missing or garbage context", async () => {
    const res = await post({ task: "generate_hooks", input: { topic: "pricing", count: 3 }, context: "nope" })
    expect(res.status).toBe(200)
    expect((await res.json()).output.hooks).toHaveLength(3)
  })

  it("rejects an unknown task with 400", async () => {
    const res = await post({ task: "write_my_novel", input: {}, context: ctx })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("unknown_task")
    expect(json.provider).toBe("offline")
  })

  it("rejects invalid input with 400 and a readable message", async () => {
    const res = await post({ task: "generate_ideas", input: { count: 500 }, context: ctx })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("invalid_input")
    expect(json.error).toMatch(/count/)
  })

  it("rejects a body that isn't JSON", async () => {
    const res = await post("{not json")
    expect(res.status).toBe(400)
  })
})

describe("GET /api/ai/status", () => {
  it("reports offline without a key", async () => {
    const json = await (await GET()).json()
    expect(json).toMatchObject({ provider: "offline", configured: false })
  })

  it("reports Claude Opus 5 when a key is configured, without leaking it", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-secret-123")
    const res = await GET()
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({ provider: "anthropic", model: "claude-opus-5", configured: true })
    expect(text).not.toContain("sk-ant-test-secret-123")
  })

  it("honours AI_PROVIDER=offline", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-secret-123")
    vi.stubEnv("AI_PROVIDER", "offline")
    expect((await (await GET()).json()).provider).toBe("offline")
  })
})

describe("executeAiTask with a live-style provider", () => {
  it("maps refs back to real ids, drops invented ones and dedupes", async () => {
    const fake: AiProvider = {
      id: "anthropic",
      model: "claude-opus-5",
      async generate() {
        return {
          model: "claude-opus-5",
          output: {
            title: "Systems over inspiration",
            core_topic: "content systems",
            pillar_id: "P2",
            persona_id: "A1",
            problem_id: "R99",
            hook: "Inspiration isn't the problem.",
            hook_category: "Contrarian",
            angle: "Contrarian",
            format: "Short-form Video",
            format_id: "F1",
            platforms: ["tiktok", "tiktok", "linkedin"],
            goal_category: "authority",
            funnel_stage: "TOFU",
            description: "…",
            why_it_matters: "…",
            talking_points: ["a", "a", "b"],
          },
        } as never
      },
    }
    const res = await executeAiTask({ task: "capture_idea", input: { text: "note" }, context: ctx }, { provider: fake })
    const out = res.output as Record<string, unknown>
    expect(out.pillar_id).toBe(ctx.pillars[1].id)
    expect(out.persona_id).toBe(ctx.personas[0].id)
    expect(out.problem_id).toBeNull()
    expect(out.format_id).toBe(ctx.formats[0].id)
    expect(out.hook_category).toBe("contrarian")
    expect(out.funnel_stage).toBe("tofu")
    expect(out.platforms).toEqual(["tiktok", "linkedin"])
    expect(out.talking_points).toEqual(["a", "b"])
    expect(res.provider).toBe("anthropic")
  })

  it("passes provider errors through with their status", async () => {
    const failing: AiProvider = {
      id: "anthropic",
      model: "claude-opus-5",
      async generate() {
        throw new AiError("Claude is rate-limited right now.", { status: 429, code: "rate_limited", provider: "anthropic" })
      },
    }
    await expect(executeAiTask({ task: "generate_hooks", input: { topic: "x" }, context: ctx }, { provider: failing })).rejects.toMatchObject({ status: 429, code: "rate_limited" })
  })
})
