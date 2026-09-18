import { z } from "zod"
import { authValidationMessages } from "@/components/features/auth/messages"
import { translator, type UiLang } from "@/lib/i18n/core"

/** The auth form schemas with validation messages in the UI language. */
export function authSchemas(lang: UiLang = "en") {
  const t = translator(authValidationMessages, lang)
  const email = z
    .string()
    .trim()
    .min(1, { error: t("email_required") })
    .pipe(z.email({ error: t("email_invalid") }))

  return {
    signInSchema: z.object({
      email,
      password: z.string().min(1, { error: t("password_required") }),
    }),
    magicLinkSchema: z.object({ email }),
    signUpSchema: z.object({
      full_name: z.string().trim().max(120, { error: t("name_too_long") }),
      email,
      // Supabase hashes passwords with bcrypt, which ignores anything past 72 bytes.
      password: z
        .string()
        .min(8, { error: t("password_too_short") })
        .max(72, { error: t("password_too_long") }),
    }),
  }
}

export const { signInSchema, magicLinkSchema, signUpSchema } = authSchemas()

export type SignInValues = z.input<typeof signInSchema>
export type SignUpValues = z.input<typeof signUpSchema>

/** First message per top-level field, e.g. `{ email: "Enter a valid email address" }`. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
