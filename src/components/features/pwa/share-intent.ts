/**
 * What `/share` should do with its query string. Pure — shared by the share page and its tests.
 *
 * - Android share target (manifest `share_target`, GET): `?title=…&text=…&url=…` → Quick Capture prefilled.
 * - Home-screen shortcuts: `?action=capture` → empty Quick Capture; `?action=new-content` → New content.
 */

/** Quick Capture accepts up to 4,000 characters (the capture_idea AI task limit). */
export const SHARE_TEXT_MAX = 4000

export interface SharedFields {
  title?: string | null
  text?: string | null
  url?: string | null
}

export type ShareIntent =
  | { kind: "capture"; text: string; shared: boolean }
  | { kind: "new-content" }
  | { kind: "none" }

const clean = (value: string | null | undefined) => (value ?? "").replace(/\r\n?/g, "\n").trim()

/**
 * One capture note from what another app shared. Android usually puts the link inside `text` (and
 * leaves `url` empty); some apps repeat the title in the text — duplicates are dropped. The title goes
 * first so it becomes the idea's title.
 */
export function buildShareText(fields: SharedFields, max = SHARE_TEXT_MAX): string {
  const title = clean(fields.title)
  let text = clean(fields.text)
  const url = clean(fields.url)

  if (text && title.includes(text)) text = ""
  const parts: string[] = []
  if (title && !text.includes(title) && title !== url) parts.push(title)
  if (text) parts.push(text)
  if (url && !parts.some((part) => part.includes(url))) parts.push(url)

  const joined = parts.join("\n").replace(/\n{3,}/g, "\n\n")
  return joined.length > max ? joined.slice(0, max).trimEnd() : joined
}

/** Anything with a URLSearchParams-like `get` (URLSearchParams, ReadonlyURLSearchParams). */
export interface ParamReader {
  get(name: string): string | null
}

export function resolveShareIntent(params: ParamReader): ShareIntent {
  const action = params.get("action")
  if (action === "new-content") return { kind: "new-content" }
  const text = buildShareText({ title: params.get("title"), text: params.get("text"), url: params.get("url") })
  if (text) return { kind: "capture", text, shared: true }
  if (action === "capture") return { kind: "capture", text: "", shared: false }
  return { kind: "none" }
}
