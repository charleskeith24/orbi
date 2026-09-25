/** `?from=admin` — set by the admin area's "Back to my workspace" links. */
export const FROM_ADMIN = "admin"

/**
 * Where a first run (a workspace whose Quick setup isn't done) is sent. Everyone goes to Quick setup, except an
 * admin who only came to manage the platform: they land on Admin instead. Admin's "Back to my workspace" links
 * carry `?from=admin`, which opens Quick setup rather than bouncing back — an admin can still set up a creator
 * workspace. `null` = stay: not a first run, or still asking whether this account is an admin.
 */
export function firstRunDestination({
  needsOnboarding,
  isAdmin,
  from,
}: {
  needsOnboarding: boolean
  isAdmin: boolean | null
  from: string | null
}): "/onboarding" | "/admin" | null {
  if (!needsOnboarding || isAdmin === null) return null
  return isAdmin && from !== FROM_ADMIN ? "/admin" : "/onboarding"
}
