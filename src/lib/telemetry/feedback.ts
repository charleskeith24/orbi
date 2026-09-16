/**
 * Feedback from the top-bar dialog: the shape POST /api/feedback accepts and helpers the dialog
 * shares with it. Pure module (client, server and tests).
 */
import { z } from "zod"

export const FEEDBACK_KINDS = ["bug", "idea", "confusing", "praise"] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const FEEDBACK_MAX_LENGTH = 4000
/** Upper bound for the raw request body of POST /api/feedback. */
export const FEEDBACK_MAX_BODY_CHARS = 20_000
const MAX_PAGE = 300

export type Viewport = "mobile" | "tablet" | "desktop"

/** Screen-size bucket (same breakpoints as the app: md = 768px, lg = 1024px). */
export function viewportFor(width: number): Viewport {
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop"
}

/** The page a report is about: the path without query string or hash. */
export function feedbackPage(pathname: string): string {
  return (pathname.split(/[?#]/, 1)[0] || "/").slice(0, MAX_PAGE)
}

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH),
  page: z
    .string()
    .max(2000)
    .default("")
    .transform((page) => (page ? feedbackPage(page) : "")),
  ui_language: z.enum(["en", "tl"]).default("en"),
  viewport: z.enum(["", "mobile", "tablet", "desktop"]).default(""),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>

export type FeedbackParseResult = { ok: true; value: FeedbackInput } | { ok: false; field: string; error: string }

/** Validates a request body. Errors are developer-facing (the dialog validates before sending). */
export function parseFeedback(raw: unknown): FeedbackParseResult {
  const result = feedbackSchema.safeParse(raw)
  if (result.success) return { ok: true, value: result.data }
  const issue = result.error.issues[0]
  const field = issue?.path.join(".") || "body"
  return { ok: false, field, error: `Invalid ${field}: ${issue?.message ?? "invalid value"}` }
}
