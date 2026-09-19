import { afterEach, describe, expect, it, vi } from "vitest"
import { createCirclesFake, createCirclesFixture } from "@/lib/circles/fixture-api"
import { DEV_CIRCLES_KEY, isCirclesFixtureEnabled, loadCirclesFixture } from "./dev-fixture"

function fakeWindow(value: string | null) {
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => (key === DEV_CIRCLES_KEY ? value : null) } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("circles dev fixture switch", () => {
  it("is on only with the flag, in development", () => {
    fakeWindow("fixture")
    expect(isCirclesFixtureEnabled()).toBe(true)
    fakeWindow("something else")
    expect(isCirclesFixtureEnabled()).toBe(false)
    fakeWindow(null)
    expect(isCirclesFixtureEnabled()).toBe(false)
  })

  it("is off when storage is unavailable", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked")
      },
    })
    expect(isCirclesFixtureEnabled()).toBe(false)
  })

  it("never turns on, loads or creates the fixture in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    fakeWindow("fixture")
    expect(isCirclesFixtureEnabled()).toBe(false)
    expect(loadCirclesFixture()).toBeNull()
    expect(() => createCirclesFixture()).toThrow(/development-only/)
    expect(() => createCirclesFake()).toThrow(/development-only/)
  })

  it("loads one fixture per page load in development", async () => {
    const first = loadCirclesFixture()
    expect(first).not.toBeNull()
    expect(loadCirclesFixture()).toBe(first)
    const api = await first!
    expect(api.self).toBe("sample-you")
  })
})
