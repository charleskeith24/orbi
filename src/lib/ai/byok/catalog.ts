/**
 * Which models a key can use, and which one to start with — pure, from each provider's own model list, so
 * nothing here goes stale when a provider ships a new model.
 *
 * Only models that can write a chat answer are offered; audio, image, embedding and realtime models are left
 * out. Claude models that don't support structured outputs are left out too (Orbi needs them).
 */
import { DEFAULT_ANTHROPIC_MODEL } from "../providers/anthropic"
import type { AiKeyProvider, AiModelOption } from "./types"

/** What Orbi keeps about the chosen model — today, the effort levels a Claude model accepts. */
export interface AiModelMeta {
  /** Claude only: effort levels the model supports; empty = omit `effort`. */
  effort?: string[]
}

export interface CatalogModel extends AiModelOption {
  /** Newest first. */
  sort: number
  meta: AiModelMeta
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

/** `capabilities.x.y.supported` from the Anthropic Models API — true/false/undefined when the tree is missing. */
function capability(model: Json, ...path: string[]): boolean | undefined {
  let node: unknown = model.capabilities
  for (const key of path) node = isObject(node) ? node[key] : undefined
  return isObject(node) && typeof node.supported === "boolean" ? node.supported : undefined
}

const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const

function anthropicModels(raw: unknown[]): CatalogModel[] {
  return raw
    .filter(isObject)
    .filter((m) => typeof m.id === "string" && m.id.startsWith("claude-") && capability(m, "structured_outputs") !== false)
    .map((m) => {
      const id = m.id as string
      // Effort only where the model says it's supported; unknown → omit it (always a valid request).
      const effort = capability(m, "effort") === true ? EFFORT_LEVELS.filter((level) => capability(m, "effort", level) === true) : []
      return {
        id,
        label: typeof m.display_name === "string" && m.display_name ? m.display_name : id,
        sort: typeof m.created_at === "string" ? Date.parse(m.created_at) || 0 : 0,
        meta: { effort },
      }
    })
}

const OPENAI_EXCLUDED = /(audio|realtime|transcribe|tts|image|search|embedding|instruct|moderation|codex|computer-use|dall-e|whisper|babbage|davinci)/

function openaiModels(raw: unknown[]): CatalogModel[] {
  return raw
    .filter(isObject)
    .map((m) => ({ id: typeof m.id === "string" ? m.id : "", created: typeof m.created === "number" ? m.created : 0 }))
    .filter(({ id }) => /^(gpt-|o\d|chatgpt-)/.test(id) && !OPENAI_EXCLUDED.test(id) && !/-\d{4}-\d{2}-\d{2}$/.test(id))
    .map(({ id, created }) => ({ id, label: id, sort: created, meta: {} }))
}

const GEMINI_EXCLUDED = /(embedding|image|tts|live|audio|vision|robotics|computer-use|aqa|learnlm)/

/** "gemini-2.5-flash" → 2.5 (newer versions sort first). */
function geminiVersion(id: string): number {
  const match = /^gemini-(\d+(?:\.\d+)?)/.exec(id)
  return match ? Number(match[1]) : 0
}

function geminiModels(raw: unknown[]): CatalogModel[] {
  return raw
    .filter(isObject)
    .map((m) => ({
      id: typeof m.name === "string" ? m.name.replace(/^models\//, "") : "",
      label: typeof m.displayName === "string" && m.displayName ? m.displayName : "",
      methods: Array.isArray(m.supportedGenerationMethods) ? (m.supportedGenerationMethods as unknown[]) : [],
    }))
    .filter(({ id, methods }) => id.startsWith("gemini-") && methods.includes("generateContent") && !GEMINI_EXCLUDED.test(id))
    .map(({ id, label }) => ({
      id,
      label: label || id,
      // Newer versions first; within a version, stable before previews and experiments.
      sort: geminiVersion(id) * 10 + (/(preview|exp)/.test(id) ? 0 : 1),
      meta: {},
    }))
}

/** A provider's raw model list (the `data` / `models` array) → the models Orbi can use, newest first. */
export function catalogModels(provider: AiKeyProvider, raw: unknown[]): CatalogModel[] {
  const models = provider === "anthropic" ? anthropicModels(raw) : provider === "openai" ? openaiModels(raw) : geminiModels(raw)
  const seen = new Set<string>()
  return models
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => b.sort - a.sort || a.id.localeCompare(b.id))
}

/**
 * The model a new key starts on. Claude: Claude Opus 5, Orbi's default everywhere. OpenAI: the newest
 * flagship ("gpt-5", "gpt-5.1"), else the newest model. Gemini: the newest stable Flash — its free tier
 * allows many more requests than Pro. Anyone can switch in Settings → AI.
 */
export function defaultModel(provider: AiKeyProvider, models: CatalogModel[]): string | null {
  if (!models.length) return null
  const pick = (test: (id: string) => boolean) => models.find((m) => test(m.id))?.id
  if (provider === "anthropic") return pick((id) => id === DEFAULT_ANTHROPIC_MODEL) ?? models[0].id
  if (provider === "openai") return pick((id) => /^gpt-\d+(\.\d+)?$/.test(id)) ?? models[0].id
  return pick((id) => /^gemini-[\d.]+-flash$/.test(id)) ?? pick((id) => /flash/.test(id) && !/lite/.test(id)) ?? models[0].id
}

/**
 * Claude's refusal fallbacks (`fallbacks: "default"`) exist for the models whose safety classifiers can
 * decline a request — the Opus 5 and Fable 5 lines. Other models run without them.
 */
export function supportsRefusalFallbacks(model: string): boolean {
  return /^claude-(opus-5|fable-5|mythos-5)/.test(model)
}
