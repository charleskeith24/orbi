import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getUsageConsent, setUsageConsent, subscribeUsageConsent, USAGE_CONSENT_KEY } from "./consent"

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  }
}

let storage: ReturnType<typeof fakeStorage>

beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal("localStorage", storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("usage consent (per device)", () => {
  it("is off by default", () => {
    expect(getUsageConsent()).toBe(false)
  })

  it("turns on and off, and notifies subscribers", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeUsageConsent(listener)
    setUsageConsent(true)
    expect(getUsageConsent()).toBe(true)
    expect(storage.map.get(USAGE_CONSENT_KEY)).toBe("on")
    setUsageConsent(false)
    expect(getUsageConsent()).toBe(false)
    expect(storage.map.has(USAGE_CONSENT_KEY)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    setUsageConsent(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("only an explicit 'on' counts", () => {
    storage.setItem(USAGE_CONSENT_KEY, "true")
    expect(getUsageConsent()).toBe(false)
  })

  it("reads as off when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError")
      },
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
      removeItem: () => {},
    })
    expect(() => setUsageConsent(true)).not.toThrow()
    expect(getUsageConsent()).toBe(false)
  })

  it("reads as off on the server (no localStorage)", () => {
    vi.unstubAllGlobals()
    expect(typeof localStorage).toBe("undefined")
    expect(getUsageConsent()).toBe(false)
  })
})
