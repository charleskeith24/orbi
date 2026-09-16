/**
 * Can this device get push reminders, and if not, why? Pure — the Reminders tab feeds it browser and
 * server facts and shows an honest state for each answer.
 */
import type { InstallPlatform } from "@/components/features/pwa/install"

export type PushState =
  /** Local mode: push needs the online version (Supabase + a deployed site). */
  | "local"
  /** Still asking the server whether push is configured. */
  | "checking"
  /** The server has no VAPID keys. */
  | "not-configured"
  /** iPhone/iPad in the browser: web push only works from the Home Screen app (iOS 16.4+). */
  | "ios-install"
  /** iPhone/iPad Home Screen app without the Push API: iOS older than 16.4. */
  | "ios-version"
  /** This browser has no Push API. */
  | "unsupported"
  /** No service worker registered (the dev server, or registration failed). */
  | "no-worker"
  /** Notifications are blocked for the site. */
  | "denied"
  /** Can subscribe (or already did). */
  | "ready"

export interface PushFacts {
  online: boolean
  /** null while the status request is pending. */
  configured: boolean | null
  platform: InstallPlatform
  standalone: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  /** null while checking for a registration. */
  hasWorker: boolean | null
  permission: NotificationPermission | "unsupported"
}

export function pushState(f: PushFacts): PushState {
  if (!f.online) return "local"
  if (f.configured === null) return "checking"
  if (!f.configured) return "not-configured"
  if (f.platform === "ios" && !f.standalone) return "ios-install"
  if (f.platform === "ios" && (!f.hasPushManager || !f.hasNotification)) return "ios-version"
  if (!f.hasServiceWorker || !f.hasPushManager || !f.hasNotification) return "unsupported"
  if (f.hasWorker === null) return "checking"
  if (!f.hasWorker) return "no-worker"
  if (f.permission === "denied") return "denied"
  return "ready"
}

/** VAPID public key (base64url) → the bytes `pushManager.subscribe` expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** True when an existing subscription was made with this VAPID key (else it must be replaced). */
export function sameApplicationServerKey(existing: ArrayBuffer | null | undefined, publicKey: string): boolean {
  if (!existing) return false
  const a = new Uint8Array(existing)
  const b = urlBase64ToUint8Array(publicKey)
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}
