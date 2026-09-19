/**
 * Per-device conveniences for Circles, in this browser's localStorage (never shared, never required):
 * - the invite link an owner last created or rotated, per circle — the database keeps only its hash, so
 *   without this the owner would have to make a new link every time they want to share it;
 * - which accepted ask → collab you already added, so the button can say "Open in Collabs".
 * Every read and write is wrapped: private windows and blocked storage just forget.
 */
const INVITES_KEY = "pbos:circle-invites"
const COLLABS_KEY = "pbos:circle-collabs"

function read(key: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function write(key: string, value: Record<string, string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable — nothing to remember.
  }
}

export function recallInvite(circleId: string): string | null {
  const code = read(INVITES_KEY)[circleId]
  return typeof code === "string" ? code : null
}

export function rememberInvite(circleId: string, code: string) {
  write(INVITES_KEY, { ...read(INVITES_KEY), [circleId]: code })
}

export function forgetInvite(circleId: string) {
  const { [circleId]: _gone, ...rest } = read(INVITES_KEY)
  void _gone
  write(INVITES_KEY, rest)
}

const collabKey = (askId: string, userId: string) => `${askId}:${userId}`

export function recallAddedCollab(askId: string, userId: string): string | null {
  const id = read(COLLABS_KEY)[collabKey(askId, userId)]
  return typeof id === "string" ? id : null
}

export function rememberAddedCollab(askId: string, userId: string, collabId: string) {
  write(COLLABS_KEY, { ...read(COLLABS_KEY), [collabKey(askId, userId)]: collabId })
}
