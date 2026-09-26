/**
 * SERVER ONLY — encrypts a person's AI key for storage (AES-256-GCM).
 *
 * The encryption key comes from `AI_KEY_SECRET` (server env, never in the database), so a copy of the
 * database alone can't reveal anyone's key. The account id is authenticated with the ciphertext: a row moved
 * to another account won't decrypt. Format: `v1.<iv>.<ciphertext>.<tag>` (base64url).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const VERSION = "v1"
/** Shorter secrets are refused: the key must be random, e.g. `openssl rand -base64 32`. */
export const MIN_SECRET_LENGTH = 32

/** The 32-byte key derived from `AI_KEY_SECRET`, or null when it's missing or too short. */
export function readAiKeySecret(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.AI_KEY_SECRET?.trim()
  if (!raw || raw.length < MIN_SECRET_LENGTH) return null
  return createHash("sha256").update(raw).digest()
}

export function encryptApiKey(plain: string, secret: Buffer, userId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", secret, iv)
  cipher.setAAD(Buffer.from(userId, "utf8"))
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [VERSION, iv.toString("base64url"), body.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".")
}

/** Throws when the token was tampered with, belongs to another account, or was made with another secret. */
export function decryptApiKey(token: string, secret: Buffer, userId: string): string {
  const [version, iv, body, tag] = token.split(".")
  if (version !== VERSION || !iv || !body || !tag) throw new Error("Unrecognised key format")
  const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "base64url"))
  decipher.setAAD(Buffer.from(userId, "utf8"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")
}
