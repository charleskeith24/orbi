import { createHash, timingSafeEqual } from "node:crypto"

export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: "unauthorized" | "not_configured" }

/**
 * `Authorization: Bearer <CRON_SECRET>` — what Vercel Cron sends when CRON_SECRET is set, and what the
 * Supabase pg_cron job sends. Rejects a missing or wrong header, and everything while CRON_SECRET is
 * unset (the proxy lets /api/cron/* through without a session, so this is the only lock).
 */
export function authorizeCron(authorization: string | null, secret: string): CronAuth {
  if (!secret) return { ok: false, status: 503, error: "not_configured" }
  const match = /^Bearer\s+(.+)$/i.exec((authorization ?? "").trim())
  if (!match) return { ok: false, status: 401, error: "unauthorized" }
  // Compare digests: equal length, constant time.
  const given = createHash("sha256").update(match[1].trim()).digest()
  const expected = createHash("sha256").update(secret).digest()
  return timingSafeEqual(given, expected) ? { ok: true } : { ok: false, status: 401, error: "unauthorized" }
}
