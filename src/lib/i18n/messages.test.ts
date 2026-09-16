/// <reference types="vite/client" />
/**
 * Checks every message namespace in the app (any `defineMessages` export in a feature's `messages.ts`,
 * a `*-messages.ts` file or `src/lib/i18n/messages/*.ts`): English and Taglish have the same keys, the
 * same `{placeholders}` per key, complete `_one`/`_other` plural pairs, and no empty strings.
 */
import { describe, expect, it } from "vitest"
import type { MessageDict, Messages } from "./core"

const MODULES = import.meta.glob(["/src/**/messages.ts", "/src/**/*-messages.ts", "/src/lib/i18n/messages/*.ts", "!**/*.test.ts"], {
  eager: true,
}) as Record<string, Record<string, unknown>>

const isDict = (value: unknown): value is MessageDict =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.values(value as object).every((v) => typeof v === "string")

function isMessages(value: unknown): value is Messages<MessageDict> {
  if (!value || typeof value !== "object") return false
  const keys = Object.keys(value)
  const { en, tl } = value as Record<string, unknown>
  return keys.length === 2 && keys.includes("en") && keys.includes("tl") && isDict(en) && isDict(tl)
}

const NAMESPACES = Object.entries(MODULES).flatMap(([path, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => isMessages(value))
    .map(([name, value]) => ({ id: `${path.replace(/^\/src\//, "")} → ${name}`, messages: value as Messages<MessageDict> }))
)

const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
const sorted = (values: Iterable<string>) => [...values].sort()

describe("i18n message namespaces", () => {
  it("finds the shared namespaces", () => {
    const ids = NAMESPACES.map((n) => n.id)
    expect(ids).toContain("lib/i18n/messages/common.ts → commonMessages")
    expect(ids).toContain("lib/i18n/messages/money.ts → dealStatusMessages")
  })

  it("has the same keys in English and Taglish", () => {
    const problems: string[] = []
    for (const { id, messages } of NAMESPACES) {
      const en = sorted(Object.keys(messages.en))
      const tl = sorted(Object.keys(messages.tl))
      const missing = en.filter((k) => !tl.includes(k))
      const extra = tl.filter((k) => !en.includes(k))
      if (missing.length) problems.push(`${id}: Taglish is missing ${missing.join(", ")}`)
      if (extra.length) problems.push(`${id}: Taglish has extra keys ${extra.join(", ")}`)
    }
    expect(problems).toEqual([])
  })

  it("uses the same {placeholders} in both languages", () => {
    const problems: string[] = []
    for (const { id, messages } of NAMESPACES) {
      for (const [key, en] of Object.entries(messages.en)) {
        const tl = (messages.tl as MessageDict)[key]
        if (tl === undefined) continue
        const [a, b] = [placeholders(en), placeholders(tl)]
        if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${id}.${key}: en {${a.join(", ")}} vs tl {${b.join(", ")}}`)
      }
    }
    expect(problems).toEqual([])
  })

  it("has no empty strings and an `_other` form for every `_one`", () => {
    const problems: string[] = []
    for (const { id, messages } of NAMESPACES) {
      for (const lang of ["en", "tl"] as const) {
        for (const [key, text] of Object.entries(messages[lang] as MessageDict)) {
          if (!text.trim()) problems.push(`${id}.${key} (${lang}) is empty`)
        }
      }
      // `t.plural(base)` exists for every `<base>_one` and reads `<base>_other` for any other count. A lone
      // `_other` key is fine — it can be a plain key (e.g. the "other" option).
      const keys = new Set(Object.keys(messages.en))
      for (const key of keys) {
        if (key.endsWith("_one") && !keys.has(key.replace(/_one$/, "_other"))) problems.push(`${id}.${key} has no _other form`)
      }
    }
    expect(problems).toEqual([])
  })
})
