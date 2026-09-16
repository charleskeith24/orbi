/**
 * Browser side of push reminders: the device's subscription and the /api/push routes.
 * Client only. The service worker is registered by the PWA runtime (production builds).
 */
import { sameApplicationServerKey, urlBase64ToUint8Array } from "@/lib/reminders/push-availability"

export interface PushServerStatus {
  online: boolean
  push: boolean
  scheduler: boolean
  publicKey: string | null
}

export function browserPushSupport() {
  const hasServiceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator
  return {
    hasServiceWorker,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasNotification: typeof window !== "undefined" && "Notification" in window,
    permission: typeof Notification === "undefined" ? ("unsupported" as const) : Notification.permission,
  }
}

export async function fetchPushStatus(): Promise<PushServerStatus | null> {
  try {
    const response = await fetch("/api/push/status", { cache: "no-store" })
    if (!response.ok) return null
    return (await response.json()) as PushServerStatus
  } catch {
    return null
  }
}

/** Orbi's service worker registration, or null (dev server, unsupported, blocked). */
export async function orbiRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration("/")
    return registration?.active ? registration : null
  } catch {
    return null
  }
}

export async function currentSubscription(registration: ServiceWorkerRegistration | null): Promise<PushSubscription | null> {
  try {
    return (await registration?.pushManager.getSubscription()) ?? null
  } catch {
    return null
  }
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

/** Tells the server about this device (idempotent; also moves the device to the signed-in account). */
export async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  try {
    return (await postJson("/api/push/subscribe", subscription.toJSON())).ok
  } catch {
    return false
  }
}

export type EnableResult = "subscribed" | "denied" | "no-worker" | "failed"

/**
 * Asks for permission (first, while the click still counts as a user gesture — iOS requires it),
 * subscribes with the server's VAPID key and saves the subscription.
 */
export async function enablePush(publicKey: string): Promise<EnableResult> {
  const permission = Notification.permission === "default" ? Notification.requestPermission() : Promise.resolve(Notification.permission)
  try {
    if ((await permission) !== "granted") return "denied"
    const registration = await orbiRegistration()
    if (!registration) return "no-worker"
    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !sameApplicationServerKey(subscription.options.applicationServerKey, publicKey)) {
      await subscription.unsubscribe()
      subscription = null
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
    return (await saveSubscription(subscription)) ? "subscribed" : "failed"
  } catch {
    return "failed"
  }
}

/** Removes the device on the server, then in the browser. */
export async function disablePush(subscription: PushSubscription): Promise<boolean> {
  try {
    const response = await postJson("/api/push/unsubscribe", { endpoint: subscription.endpoint })
    if (!response.ok) return false
    await subscription.unsubscribe().catch(() => undefined)
    return true
  } catch {
    return false
  }
}

export type TestResult = "sent" | "missing" | "failed"

export async function sendTestPush(subscription: PushSubscription): Promise<TestResult> {
  try {
    const response = await postJson("/api/push/test", { endpoint: subscription.endpoint })
    if (response.status === 404) return "missing"
    if (!response.ok) return "failed"
    const result = (await response.json()) as { sent?: number }
    return (result.sent ?? 0) > 0 ? "sent" : "failed"
  } catch {
    return "failed"
  }
}
