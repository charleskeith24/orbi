/** Sends one notification through the browser's push service (web-push, VAPID). Server only. */
import webpush from "web-push"
import type { PushSender } from "../cron"
import type { VapidConfig } from "./config"

export function createWebPushSender(vapid: VapidConfig): PushSender {
  return async (subscription, payload, { ttlSeconds }) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), {
        vapidDetails: vapid,
        TTL: ttlSeconds,
        urgency: "normal",
        timeout: 10_000,
      })
      return { ok: true }
    } catch (error) {
      const status = typeof (error as { statusCode?: unknown }).statusCode === "number" ? (error as { statusCode: number }).statusCode : null
      const message = error instanceof Error ? error.message : String(error)
      // 404/410: the subscription expired or the user revoked permission — it will never work again.
      return { ok: false, gone: status === 404 || status === 410, status, message: message.slice(0, 200) }
    }
  }
}
