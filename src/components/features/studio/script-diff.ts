/** Word-level diff for comparing script versions (LCS; line-level for very long texts). */

export interface DiffPart {
  type: "same" | "add" | "del"
  text: string
}

/** Above this many DP cells the diff runs on lines instead of words. */
const MAX_CELLS = 250_000

const words = (text: string) => text.split(/(\s+)/).filter((t) => t.length > 0)
const lines = (text: string) => text.split(/(?<=\n)/).filter((t) => t.length > 0)

export function diffWords(before: string, after: string): DiffPart[] {
  let a = words(before)
  let b = words(after)
  if (a.length * b.length > MAX_CELLS) {
    a = lines(before)
    b = lines(after)
  }
  const n = a.length
  const m = b.length
  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out: DiffPart[] = []
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1]
    if (last && last.type === type) last.text += text
    else out.push({ type, text })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i++])
    } else {
      push("add", b[j++])
    }
  }
  while (i < n) push("del", a[i++])
  while (j < m) push("add", b[j++])
  return out
}
