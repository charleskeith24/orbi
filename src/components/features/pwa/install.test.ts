import { describe, expect, it } from "vitest"
import { detectInstallPlatform, installMode, type InstallInput } from "./install"

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.98 Mobile/15E148 Safari/604.1",
  macSafari17:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari16:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:129.0) Gecko/129.0 Firefox/129.0",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
}

describe("detectInstallPlatform", () => {
  it("recognises iPhone in any browser", () => {
    expect(detectInstallPlatform(UA.iphoneSafari)).toBe("ios")
    expect(detectInstallPlatform(UA.iphoneChrome)).toBe("ios")
  })

  it("treats a touch Mac user agent as iPadOS", () => {
    expect(detectInstallPlatform(UA.macSafari17, 5)).toBe("ios")
  })

  it("recognises Android browsers", () => {
    expect(detectInstallPlatform(UA.androidChrome)).toBe("android")
    expect(detectInstallPlatform(UA.androidFirefox)).toBe("android")
  })

  it("only offers Add to Dock on Safari 17+ for macOS", () => {
    expect(detectInstallPlatform(UA.macSafari17, 0)).toBe("mac-safari")
    expect(detectInstallPlatform(UA.macSafari16, 0)).toBe("other")
    expect(detectInstallPlatform(UA.macChrome, 0)).toBe("other")
  })

  it("falls back to other on desktop Chromium (which uses the install prompt instead)", () => {
    expect(detectInstallPlatform(UA.windowsEdge)).toBe("other")
  })
})

describe("installMode", () => {
  const base: InstallInput = { standalone: false, installed: false, canPrompt: false, platform: "other" }

  it("hides the item once Orbi runs as an app or was just installed", () => {
    expect(installMode({ ...base, standalone: true, canPrompt: true, platform: "ios" })).toBe("hidden")
    expect(installMode({ ...base, installed: true, canPrompt: true })).toBe("hidden")
  })

  it("prefers the native prompt when the browser offers one", () => {
    expect(installMode({ ...base, canPrompt: true, platform: "android" })).toBe("prompt")
    expect(installMode({ ...base, canPrompt: true })).toBe("prompt")
  })

  it("falls back to instructions per platform, and hides where there is no way to install", () => {
    expect(installMode({ ...base, platform: "ios" })).toBe("ios")
    expect(installMode({ ...base, platform: "android" })).toBe("android")
    expect(installMode({ ...base, platform: "mac-safari" })).toBe("mac-safari")
    expect(installMode(base)).toBe("hidden")
  })
})
