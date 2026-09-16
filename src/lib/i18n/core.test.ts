import { describe, expect, it } from "vitest"
import { defineMessages, interpolate, translate, translator } from "./core"

const m = defineMessages({
  en: { hello: "Hello, {name}", save: "Save", count_one: "{count} idea", count_other: "{count} ideas" },
  tl: { hello: "Hi, {name}", save: "I-save", count_one: "{count} idea", count_other: "{count} ideas" },
})

describe("i18n core", () => {
  it("translates by language and fills placeholders", () => {
    expect(translator(m, "en")("hello", { name: "Raf" })).toBe("Hello, Raf")
    expect(translator(m, "tl")("save")).toBe("I-save")
    expect(translate(m, "tl", "hello", { name: "Raf" })).toBe("Hi, Raf")
  })

  it("picks plural forms and accepts a pre-formatted count", () => {
    const t = translator(m, "en")
    expect(t.plural("count", 1)).toBe("1 idea")
    expect(t.plural("count", 3)).toBe("3 ideas")
    expect(t.plural("count", 1200, { count: "1,200" })).toBe("1,200 ideas")
  })

  it("leaves unknown placeholders visible", () => {
    expect(interpolate("Hi {name}, {missing}", { name: "A" })).toBe("Hi A, {missing}")
  })
})
