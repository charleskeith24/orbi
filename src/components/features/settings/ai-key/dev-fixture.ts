/**
 * The dev-only AI key fixture: `localStorage["pbos:dev-ai-key"] = "fixture"` (no key yet) or `"saved"` (a saved
 * Gemini key), set by the scripts' `--ai-key` flag — so the online card can be seen and clicked on the local
 * dev server. Same guard as the Circles fixture: in a production build the flag is never read, and creating
 * the fixture throws.
 *
 * Keys containing "bad" are refused like a wrong key; anything else is accepted. Nothing leaves the page.
 */
import type { AiKeyProvider, AiKeySaveInput, AiKeyState, AiModelOption } from "@/lib/ai/byok/types"
import { AiKeyRequestError, type AiKeyClient } from "./client"

export const DEV_AI_KEY_KEY = "pbos:dev-ai-key"

export function aiKeyFixtureMode(): "fixture" | "saved" | null {
  if (process.env.NODE_ENV === "production") return null
  try {
    const value = window.localStorage.getItem(DEV_AI_KEY_KEY)
    return value === "fixture" || value === "saved" ? value : null
  } catch {
    return null
  }
}

const MODELS: Record<AiKeyProvider, AiModelOption[]> = {
  anthropic: [
    { id: "claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5", label: "gpt-5" },
    { id: "gpt-5-mini", label: "gpt-5-mini" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 450))

export function createAiKeyFixture(start: "fixture" | "saved"): AiKeyClient {
  if (process.env.NODE_ENV === "production") throw new Error("The AI key fixture is development-only.")
  let state: AiKeyState =
    start === "saved"
      ? { status: "saved", provider: "gemini", model: "gemini-2.5-flash", hint: "x7Qe", verifiedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }
      : { status: "none" }
  const withModels = (s: AiKeyState): AiKeyState => (s.status === "saved" ? { ...s, models: MODELS[s.provider] } : s)
  return {
    async get(options) {
      await wait()
      return options?.models ? withModels(state) : state
    },
    async save(input: AiKeySaveInput) {
      await wait()
      if (/bad/i.test(input.key)) throw new AiKeyRequestError("That key was refused.", "invalid_key")
      state = { status: "saved", provider: input.provider, model: MODELS[input.provider][0].id, hint: input.key.trim().slice(-4), verifiedAt: new Date().toISOString() }
      return withModels(state)
    },
    async setModel(model) {
      await wait()
      if (state.status !== "saved") throw new AiKeyRequestError("Add a key first.", "invalid")
      state = { ...state, model }
      return withModels(state)
    },
    async remove() {
      await wait()
      state = { status: "none" }
      return state
    },
  }
}
