/**
 * /api/ai/key — your own AI key (bring your own key, ARCHITECTURE §7). Online version only.
 *
 *   GET     → AiKeyState ("local" | "not_configured" | "none" | "saved"); ?models=1 adds the key's models
 *   PUT     { provider, key, model? } → the key is checked with the provider (by listing its models — no tokens
 *           spent), encrypted with AI_KEY_SECRET and stored; answers the saved state with its models
 *   PATCH   { model } → switch model (must be one the key can use)
 *   DELETE  → forget the key; AI falls back to the offline templates
 *
 * The key is never sent back, logged or shown again — only its last four characters. Mutations need a
 * same-origin `Origin`. Failures: `{ error, code }` (AiKeyErrorCode). Every response is no-store.
 */
import * as z from "zod"
import { defaultModel, type CatalogModel } from "@/lib/ai/byok/catalog"
import { decryptApiKey, encryptApiKey, readAiKeySecret } from "@/lib/ai/byok/crypto"
import { AiKeyError, listKeyModels } from "@/lib/ai/byok/models"
import { deleteAiKey, loadAiKey, saveAiKey, updateAiKeyModel, type StoredAiKey } from "@/lib/ai/byok/store"
import { AI_KEY_PROVIDERS, cleanApiKey, keyHint, MODEL_ID, type AiKeyErrorCode, type AiKeyState } from "@/lib/ai/byok/types"
import { sameOrigin } from "@/lib/admin/server/http"
import { createSupabaseAdminClient, isSecretKeyConfigured } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const maxDuration = 30

const NO_STORE = { "Cache-Control": "no-store" }

function answer(body: AiKeyState, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

function fail(status: number, code: AiKeyErrorCode, error: string): Response {
  return Response.json({ error, code }, { status, headers: NO_STORE })
}

const saveSchema = z.object({
  provider: z.enum(AI_KEY_PROVIDERS),
  key: z.string().max(1000),
  model: z.string().regex(MODEL_ID).optional(),
})
const modelSchema = z.object({ model: z.string().regex(MODEL_ID) })

type Context = { ok: true; userId: string; secret: Buffer } | { ok: false; code: AiKeyErrorCode; response: Response }

const refuse = (status: number, code: AiKeyErrorCode, error: string): Context => ({ ok: false, code, response: fail(status, code, error) })

/** Online, signed in and able to store keys — or why not. */
async function context(request: Request, mutation: boolean): Promise<Context> {
  if (!isSupabaseConfigured) return refuse(501, "local", "Your own AI key is part of the online version.")
  if (mutation && !sameOrigin(request)) return refuse(403, "bad_origin", "Cross-site request refused.")
  const { createSupabaseServerClient } = await import("@/lib/supabase/server")
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return refuse(401, "unauthorized", "Sign in to manage your AI key.")
  const secret = readAiKeySecret()
  if (!secret || !isSecretKeyConfigured()) {
    return refuse(501, "not_configured", "This site can't store AI keys until its owner sets AI_KEY_SECRET (docs/DEPLOY.md).")
  }
  return { ok: true, userId: data.user.id, secret }
}

function saved(stored: Pick<StoredAiKey, "provider" | "model" | "hint" | "verifiedAt">, models?: CatalogModel[], modelsError?: string): AiKeyState {
  return {
    status: "saved",
    provider: stored.provider,
    model: stored.model,
    hint: stored.hint,
    verifiedAt: stored.verifiedAt,
    ...(models ? { models: models.map(({ id, label }) => ({ id, label })) } : {}),
    ...(modelsError ? { modelsError } : {}),
  }
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function failure(err: unknown, where: string): Response {
  if (err instanceof AiKeyError) return fail(err.status, err.code, err.message)
  console.error(`[api/ai/key] ${where} failed`, err instanceof Error ? err.message : err)
  return fail(500, "server_error", "Something went wrong. Try again in a moment.")
}

export async function GET(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) return answer({ status: "local" })
  const ctx = await context(request, false)
  if (!ctx.ok) return ctx.code === "not_configured" ? answer({ status: "not_configured" }) : ctx.response
  try {
    const service = createSupabaseAdminClient()
    const stored = await loadAiKey(service, ctx.userId)
    if (!stored) return answer({ status: "none" })
    if (new URL(request.url).searchParams.get("models") !== "1") return answer(saved(stored))
    try {
      const key = decryptApiKey(stored.ciphertext, ctx.secret, ctx.userId)
      return answer(saved(stored, await listKeyModels(stored.provider, key)))
    } catch (err) {
      const message = err instanceof AiKeyError ? err.message : "Your saved key can't be read anymore — add it again."
      return answer(saved(stored, undefined, message))
    }
  } catch (err) {
    return failure(err, "GET")
  }
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await context(request, true)
  if (!ctx.ok) return ctx.response
  const parsed = saveSchema.safeParse(await readBody(request))
  if (!parsed.success) return fail(400, "invalid", "Choose a provider and paste your key.")
  const key = cleanApiKey(parsed.data.key)
  if (!key) return fail(400, "invalid", "That doesn't look like an API key. Copy the whole key and paste it again.")
  try {
    const models = await listKeyModels(parsed.data.provider, key)
    const wanted = parsed.data.model && models.some((m) => m.id === parsed.data.model) ? parsed.data.model : defaultModel(parsed.data.provider, models)
    const chosen = models.find((m) => m.id === wanted) ?? models[0]
    const stored = {
      provider: parsed.data.provider,
      model: chosen.id,
      modelMeta: chosen.meta,
      hint: keyHint(key),
      ciphertext: encryptApiKey(key, ctx.secret, ctx.userId),
    }
    const verifiedAt = await saveAiKey(createSupabaseAdminClient(), ctx.userId, stored, new Date())
    return answer(saved({ ...stored, verifiedAt }, models))
  } catch (err) {
    return failure(err, "PUT")
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const ctx = await context(request, true)
  if (!ctx.ok) return ctx.response
  const parsed = modelSchema.safeParse(await readBody(request))
  if (!parsed.success) return fail(400, "invalid", "Choose a model.")
  try {
    const service = createSupabaseAdminClient()
    const stored = await loadAiKey(service, ctx.userId)
    if (!stored) return fail(404, "invalid", "Add a key first.")
    let key: string
    try {
      key = decryptApiKey(stored.ciphertext, ctx.secret, ctx.userId)
    } catch {
      return fail(409, "invalid_key", "Your saved key can't be read anymore — add it again.")
    }
    const models = await listKeyModels(stored.provider, key)
    const chosen = models.find((m) => m.id === parsed.data.model)
    if (!chosen) return fail(400, "unknown_model", "Your key can't use that model. Pick one from the list.")
    await updateAiKeyModel(service, ctx.userId, chosen.id, chosen.meta)
    return answer(saved({ ...stored, model: chosen.id }, models))
  } catch (err) {
    return failure(err, "PATCH")
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const ctx = await context(request, true)
  if (!ctx.ok) return ctx.response
  try {
    await deleteAiKey(createSupabaseAdminClient(), ctx.userId)
    return answer({ status: "none" })
  } catch (err) {
    return failure(err, "DELETE")
  }
}
