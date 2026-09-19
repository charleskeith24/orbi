import { describe, expect, it } from "vitest"
import { initialsOf } from "./names"

describe("initialsOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(initialsOf("Ana Santos")).toBe("AS")
    expect(initialsOf("mika")).toBe("MI")
  })

  it("ignores quotes, punctuation, emoji and the (sample) label", () => {
    expect(initialsOf('Rafael "Raf" Mendoza')).toBe("RR")
    expect(initialsOf("Mika (sample)")).toBe("MI")
    expect(initialsOf("✨ Bea ✨")).toBe("BE")
    expect(initialsOf("Ñino Óscar")).toBe("ÑÓ")
  })

  it("falls back to ? for names without letters", () => {
    expect(initialsOf("   ")).toBe("?")
    expect(initialsOf("🔥🔥")).toBe("?")
  })
})
