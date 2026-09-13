import { z } from "zod"

const email = z
  .string()
  .trim()
  .min(1, { error: "Enter your email address" })
  .pipe(z.email({ error: "Enter a valid email address" }))

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password" }),
})

export const magicLinkSchema = z.object({ email })

export const signUpSchema = z.object({
  full_name: z.string().trim().max(120, { error: "Keep your name under 120 characters" }),
  email,
  // Supabase hashes passwords with bcrypt, which ignores anything past 72 bytes.
  password: z
    .string()
    .min(8, { error: "Use at least 8 characters" })
    .max(72, { error: "Use 72 characters or fewer" }),
})

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
