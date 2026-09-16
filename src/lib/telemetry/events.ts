/**
 * Opt-in usage analytics — the event vocabulary and the rules that keep events content-free.
 *
 * Pure module, shared by the browser client and POST /api/events. Every event is a name from
 * USAGE_EVENT_NAMES plus a few whitelisted properties whose values are enum-like tokens, small
 * counts or booleans. Titles, notes, captions, handles or any other text a creator types can
 * never pass `sanitizeProps`; paths lose their query string and ids (`normalizePath`).
 *
 * Keep USAGE_EVENT_NAMES in sync with the CHECK list in supabase/migrations/20260914000100_beta.sql.
 */

export const USAGE_EVENT_NAMES = [
  "onboarding_step_viewed",
  "onboarding_step_completed",
  "onboarding_completed",
  "page_viewed",
  "idea_captured",
  "content_created",
  "post_published",
  "metrics_logged",
] as const

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number]

/** The only property keys each event may carry. */
export const EVENT_PROPS = {
  onboarding_step_viewed: ["step", "index", "mode", "lang"],
  onboarding_step_completed: ["step", "index", "mode", "lang"],
  onboarding_completed: ["mode", "lang", "pillars", "ideas"],
  page_viewed: ["module"],
  idea_captured: ["source"],
  content_created: ["platform", "stage", "from_idea"],
  post_published: ["platform"],
  metrics_logged: ["platform"],
} as const satisfies Record<UsageEventName, readonly string[]>

type PropKey = (typeof EVENT_PROPS)[UsageEventName][number]

/** Every property has one fixed kind: an enum-like token, a small count, or a yes/no flag. */
const PROP_KINDS: Record<PropKey, "token" | "count" | "flag"> = {
  step: "token",
  mode: "token",
  lang: "token",
  module: "token",
  source: "token",
  platform: "token",
  stage: "token",
  index: "count",
  pillars: "count",
  ideas: "count",
  from_idea: "flag",
}

/** View events repeat on re-renders (and React's dev double effects); identical ones close together count once. */
export const VIEW_EVENTS: ReadonlySet<UsageEventName> = new Set(["page_viewed", "onboarding_step_viewed"])

export type UsagePropValue = string | number | boolean
export type UsageProps = Record<string, UsagePropValue>

/** Enum-like token: lowercase, starts with a letter, at most 40 chars (step keys, modules, platforms, stages). */
const TOKEN = /^[a-z][a-z0-9_]{0,39}$/
const MAX_COUNT = 100_000

export function isUsageEventName(value: unknown): value is UsageEventName {
  return typeof value === "string" && (USAGE_EVENT_NAMES as readonly string[]).includes(value)
}

function validProp(kind: "token" | "count" | "flag", value: unknown): value is UsagePropValue {
  if (kind === "flag") return typeof value === "boolean"
  if (kind === "count") return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
  return typeof value === "string" && TOKEN.test(value)
}

/** Keeps whitelisted keys whose values match the key's kind (token, count ≤ 100,000, flag). Drops everything else. */
export function sanitizeProps(name: UsageEventName, props: unknown): UsageProps {
  const out: UsageProps = {}
  if (!props || typeof props !== "object" || Array.isArray(props)) return out
  const source = props as Record<string, unknown>
  for (const key of EVENT_PROPS[name] as readonly PropKey[]) {
    const value = source[key]
    if (validProp(PROP_KINDS[key], value)) out[key] = value
  }
  return out
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PATH = 200

/** A path segment that is an id (uuid, long token with digits) rather than a page name. */
function isIdSegment(segment: string): boolean {
  return UUID.test(segment) || (segment.length >= 8 && /\d/.test(segment)) || segment.length > 40
}

/** "/studio/5f0c…?open=x#y" → "/studio/[id]". Query strings, hashes and ids never leave the browser. */
export function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? ""
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (isIdSegment(segment)) return "[id]"
      const clean = segment.toLowerCase().replace(/[^a-z0-9_-]/g, "")
      return clean || "[id]"
    })
  return `/${segments.join("/")}`.slice(0, MAX_PATH)
}

/** Top-level module for a path: "/" → "home", "/ideas/hooks" → "ideas", "/money/media-kit" → "money". */
export function moduleForPath(pathname: string): string {
  const first = normalizePath(pathname).split("/")[1]
  if (!first) return "home"
  const token = first.replace(/-/g, "_")
  return TOKEN.test(token) ? token : "other"
}

/* ------------------------------ Server intake ----------------------------- */

export interface UsageEventRow {
  name: UsageEventName
  props: UsageProps
  path: string
  session_id: string
  occurred_at: string
}

export const MAX_EVENTS_PER_REQUEST = 50
/** Upper bound for the raw request body of POST /api/events. */
export const MAX_EVENTS_BODY_CHARS = 64_000
const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SKEW_MS = 5 * 60 * 1000

/** Validates one event from the browser. Null when it must be dropped (unknown name, not an object). */
export function parseUsageEvent(raw: unknown, now: Date): UsageEventRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  if (!isUsageEventName(input.name)) return null
  const at = typeof input.occurred_at === "string" ? Date.parse(input.occurred_at) : Number.NaN
  const nowMs = now.getTime()
  const occurred = Number.isFinite(at) && at >= nowMs - MAX_AGE_MS && at <= nowMs + MAX_SKEW_MS ? new Date(at) : now
  return {
    name: input.name,
    props: sanitizeProps(input.name, input.props),
    path: typeof input.path === "string" ? normalizePath(input.path) : "",
    session_id: typeof input.session_id === "string" && SESSION_ID.test(input.session_id) ? input.session_id : "",
    occurred_at: occurred.toISOString(),
  }
}
