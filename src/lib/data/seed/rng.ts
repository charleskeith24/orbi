/**
 * Deterministic randomness for the seed generators. Same seed → same workspace,
 * including ids, so demo data is reproducible in tests and across reloads.
 */

/** 32-bit string hash (cyrb53 folded to 32 bits). */
export function hashString(input: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 ^ h1) >>> 0
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform float in [min, max). */
  float(min: number, max: number): number
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
  /** `count` distinct items in random order (fewer when the list is shorter). */
  sample<T>(items: readonly T[], count: number): T[]
  /** Standard normal (Box–Muller). */
  normal(): number
  /** RFC 4122 v4-shaped id built from the stream. */
  uuid(): string
}

/** mulberry32 — tiny, fast, good enough for fixtures. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const hex = (n: number, len: number) => n.toString(16).padStart(len, "0")
  const word = () => Math.floor(next() * 4294967296) >>> 0

  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    sample(items, count) {
      const pool = [...items]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      return pool.slice(0, Math.max(0, count))
    },
    normal() {
      const u = Math.max(next(), 1e-12)
      const v = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    uuid() {
      const a = word()
      const b = word()
      const c = word()
      const d = word()
      const timeHi = ((b & 0x0fff) | 0x4000) >>> 0
      const clockSeq = (((c >>> 16) & 0x3fff) | 0x8000) >>> 0
      return [
        hex(a, 8),
        hex(b >>> 16, 4),
        hex(timeHi, 4),
        hex(clockSeq, 4),
        hex(c & 0xffff, 4) + hex(d, 8),
      ].join("-")
    },
  }
}
