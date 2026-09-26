/**
 * SERVER ONLY — `public.ai_keys` through the secret-key client. The table has no grants for signed-in users:
 * the browser never reads a key, not even its own (supabase/migrations/20260926000000_ai_keys.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiModelMeta } from "./catalog"
import { isAiKeyProvider, type AiKeyProvider } from "./types"

export interface StoredAiKey {
  provider: AiKeyProvider
  model: string
  modelMeta: AiModelMeta
  hint: string
  ciphertext: string
  verifiedAt: string
}

const COLUMNS = "provider, model, model_meta, key_hint, key_ciphertext, verified_at"

export async function loadAiKey(service: SupabaseClient, userId: string): Promise<StoredAiKey | null> {
  const { data, error } = await service.from("ai_keys").select(COLUMNS).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(`[ai-keys] load: ${error.message}`)
  if (!data || !isAiKeyProvider(data.provider)) return null
  return {
    provider: data.provider,
    model: String(data.model ?? ""),
    modelMeta: (data.model_meta ?? {}) as AiModelMeta,
    hint: String(data.key_hint ?? ""),
    ciphertext: String(data.key_ciphertext ?? ""),
    verifiedAt: String(data.verified_at ?? ""),
  }
}

export async function saveAiKey(service: SupabaseClient, userId: string, key: Omit<StoredAiKey, "verifiedAt">, now: Date): Promise<string> {
  const verifiedAt = now.toISOString()
  const { error } = await service.from("ai_keys").upsert(
    {
      user_id: userId,
      provider: key.provider,
      model: key.model,
      model_meta: key.modelMeta,
      key_hint: key.hint,
      key_ciphertext: key.ciphertext,
      verified_at: verifiedAt,
    },
    { onConflict: "user_id" }
  )
  if (error) throw new Error(`[ai-keys] save: ${error.message}`)
  return verifiedAt
}

export async function updateAiKeyModel(service: SupabaseClient, userId: string, model: string, modelMeta: AiModelMeta): Promise<void> {
  const { error } = await service.from("ai_keys").update({ model, model_meta: modelMeta }).eq("user_id", userId)
  if (error) throw new Error(`[ai-keys] update model: ${error.message}`)
}

export async function deleteAiKey(service: SupabaseClient, userId: string): Promise<void> {
  const { error } = await service.from("ai_keys").delete().eq("user_id", userId)
  if (error) throw new Error(`[ai-keys] delete: ${error.message}`)
}
