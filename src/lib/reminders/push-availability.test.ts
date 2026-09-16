import { describe, expect, it } from "vitest"
import { pushState, sameApplicationServerKey, urlBase64ToUint8Array, type PushFacts } from "./push-availability"

const READY: PushFacts = {
  online: true,
  configured: true,
  platform: "android",
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  hasWorker: true,
  permission: "default",
}

describe("pushState", () => {
  it("is ready on a capable, configured online browser", () => {
    expect(pushState(READY)).toBe("ready")
    expect(pushState({ ...READY, permission: "granted", platform: "other" })).toBe("ready")
  })

  it("needs the online version first, then server keys", () => {
    expect(pushState({ ...READY, online: false, configured: null })).toBe("local")
    expect(pushState({ ...READY, configured: null })).toBe("checking")
    expect(pushState({ ...READY, configured: false, platform: "ios" })).toBe("not-configured")
  })

  it("sends iPhone users to the Home Screen first, then checks the iOS version", () => {
    expect(pushState({ ...READY, platform: "ios", hasPushManager: false })).toBe("ios-install")
    expect(pushState({ ...READY, platform: "ios", standalone: true, hasPushManager: false })).toBe("ios-version")
    expect(pushState({ ...READY, platform: "ios", standalone: true })).toBe("ready")
  })

  it("explains unsupported browsers, a missing service worker and blocked notifications", () => {
    expect(pushState({ ...READY, hasPushManager: false })).toBe("unsupported")
    expect(pushState({ ...READY, hasWorker: null })).toBe("checking")
    expect(pushState({ ...READY, hasWorker: false })).toBe("no-worker")
    expect(pushState({ ...READY, permission: "denied" })).toBe("denied")
  })
})

describe("VAPID key helpers", () => {
  // 65-byte uncompressed P-256 point, base64url without padding (as `web-push generate-vapid-keys` prints).
  const KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"

  it("decodes base64url to bytes", () => {
    const bytes = urlBase64ToUint8Array(KEY)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255])
  })

  it("compares an existing subscription's key", () => {
    const bytes = urlBase64ToUint8Array(KEY)
    expect(sameApplicationServerKey(bytes.buffer, KEY)).toBe(true)
    expect(sameApplicationServerKey(new Uint8Array(65).buffer, KEY)).toBe(false)
    expect(sameApplicationServerKey(null, KEY)).toBe(false)
  })
})
