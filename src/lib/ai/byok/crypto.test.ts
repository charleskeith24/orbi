import { describe, expect, it } from "vitest"
import { decryptApiKey, encryptApiKey, readAiKeySecret } from "./crypto"
import { cleanApiKey, keyHint } from "./types"

const secret = readAiKeySecret({ AI_KEY_SECRET: "a".repeat(44) })!
const KEY = "sk-ant-api03-EXAMPLEEXAMPLEEXAMPLE-abcd"

describe("AI key encryption", () => {
  it("round-trips for the same account, and never stores the key in the clear", () => {
    const token = encryptApiKey(KEY, secret, "user-1")
    expect(token.startsWith("v1.")).toBe(true)
    expect(token).not.toContain(KEY)
    expect(decryptApiKey(token, secret, "user-1")).toBe(KEY)
    expect(encryptApiKey(KEY, secret, "user-1")).not.toBe(token)
  })

  it("won't decrypt for another account, with another secret, or after tampering", () => {
    const token = encryptApiKey(KEY, secret, "user-1")
    expect(() => decryptApiKey(token, secret, "user-2")).toThrow()
    expect(() => decryptApiKey(token, readAiKeySecret({ AI_KEY_SECRET: "b".repeat(44) })!, "user-1")).toThrow()
    const [v, iv, body, tag] = token.split(".")
    const flipped = body.slice(0, -2) + (body.endsWith("A") ? "BB" : "AA")
    expect(() => decryptApiKey([v, iv, flipped, tag].join("."), secret, "user-1")).toThrow()
    expect(() => decryptApiKey("sk-plain", secret, "user-1")).toThrow()
  })

  it("needs a real secret: missing or short ones turn keys off", () => {
    expect(readAiKeySecret({})).toBeNull()
    expect(readAiKeySecret({ AI_KEY_SECRET: "short" })).toBeNull()
    expect(readAiKeySecret({ AI_KEY_SECRET: `  ${"x".repeat(32)}  ` })).not.toBeNull()
  })
})

describe("cleanApiKey", () => {
  it("trims pasted keys and quotes, and refuses what can't be a key", () => {
    expect(cleanApiKey(`  "${KEY}"\n`)).toBe(KEY)
    expect(cleanApiKey("sk-short")).toBeNull()
    expect(cleanApiKey(`${KEY} ${KEY}`)).toBeNull()
    expect(keyHint(KEY)).toBe("abcd")
  })
})
