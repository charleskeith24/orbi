/**
 * The public contact address on /privacy and /terms: `NEXT_PUBLIC_CONTACT_EMAIL` (optional, `.env.example`).
 * Nobody's address is hard-coded. `NEXT_PUBLIC_` values are built into the site, so changing it needs a
 * redeploy (docs/DEPLOY.md step 4). Unset or malformed → `null`, and the pages say no contact email is set up yet.
 */
import { firstParam } from "@/components/features/auth/auth-paths"

const EMAIL = /^[^\s@<>()[\]"',;:\\]+@[^\s@<>()[\]"',;:\\]+\.[a-z]{2,}$/i

/** A usable address from the raw env value (trimmed, an optional `mailto:` dropped), or null. */
export function parseContactEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim().replace(/^mailto:/i, "")
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

/** Read as the literal `process.env.NEXT_PUBLIC_CONTACT_EMAIL` so Next inlines it at build time. */
export const CONTACT_EMAIL = parseContactEmail(process.env.NEXT_PUBLIC_CONTACT_EMAIL)

/** Dev-only QA preview address (`/privacy?preview=contact`, `/terms?preview=contact`): reserved domain, no inbox. */
export const PREVIEW_CONTACT_EMAIL = "hello@example.com"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * The address a legal page shows. In development only, `?preview=contact` shows the preview address when
 * none is configured, so the "with email" state can be screenshotted without restarting the dev server.
 * Production never reads `searchParams` here, so the pages stay static.
 */
export async function contactEmailForPage(
  searchParams: SearchParams,
  configured: string | null = CONTACT_EMAIL,
  env: string | undefined = process.env.NODE_ENV
): Promise<string | null> {
  if (configured || env === "production") return configured
  return firstParam((await searchParams).preview) === "contact" ? PREVIEW_CONTACT_EMAIL : null
}
