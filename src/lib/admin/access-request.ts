/**
 * The public "Request access" form (waitlist): the shape POST /api/access-requests accepts, shared by
 * the form (client validation) and the route (server validation). Pure module.
 * Error text is developer-facing; the form shows its own translated messages per field.
 */
import { z } from "zod"

export const ACCESS_REQUEST_LIMITS = {
  name: 120,
  email: 254,
  about: 300,
  link: 500,
  /** Upper bound for the raw request body. */
  body: 5_000,
} as const

export const accessRequestSchema = z.object({
  name: z.string().trim().min(1, { error: "name_required" }).max(ACCESS_REQUEST_LIMITS.name, { error: "name_too_long" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "email_required" })
    .max(ACCESS_REQUEST_LIMITS.email, { error: "email_invalid" })
    .pipe(z.email({ error: "email_invalid" })),
  about: z.string().trim().max(ACCESS_REQUEST_LIMITS.about, { error: "about_too_long" }).default(""),
  /** Optional http(s) URL; empty string when not given. */
  link: z
    .string()
    .trim()
    .max(ACCESS_REQUEST_LIMITS.link, { error: "link_invalid" })
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), { error: "link_invalid" })
    .default(""),
  /** Must be true: the person agreed to the privacy notice (/privacy). */
  consent: z.literal(true, { error: "consent_required" }),
  /** Honeypot — hidden from people; bots fill it. A non-empty value is accepted but silently dropped. */
  website: z.string().max(ACCESS_REQUEST_LIMITS.link).default(""),
})

export type AccessRequestInput = z.input<typeof accessRequestSchema>
export type AccessRequestData = z.output<typeof accessRequestSchema>

/** Field → error key from a failed parse (keys are the `error` strings above). */
export function accessRequestErrors(error: z.ZodError): Partial<Record<keyof AccessRequestData, string>> {
  const out: Partial<Record<keyof AccessRequestData, string>> = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof AccessRequestData | undefined
    if (field && !out[field]) out[field] = issue.message
  }
  return out
}
