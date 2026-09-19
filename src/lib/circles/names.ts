/**
 * Collab Circles — initials for a member's avatar. Letters and digits only (any script), so quotes,
 * emoji and "(sample)" never end up in the circle.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
  if (!words.length) return "?"
  if (words.length === 1) return [...words[0]].slice(0, 2).join("").toUpperCase()
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase()
}
