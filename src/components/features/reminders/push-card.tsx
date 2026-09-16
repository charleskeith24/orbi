"use client"

import { BellOff, BellRing, Send, Smartphone, TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { SectionCard, StatusPill, type StatusTone } from "@/components/common"
import { useInstallOrbi } from "@/components/features/pwa/install-orbi"
import { usePwaStore } from "@/components/features/pwa/pwa-runtime"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useT } from "@/lib/i18n"
import { pushState, type PushState } from "@/lib/reminders/push-availability"
import { anyReminderEnabled } from "@/lib/reminders/schedule"
import { useSettings } from "@/lib/store"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { remindersMessages } from "./messages"
import {
  browserPushSupport,
  currentSubscription,
  disablePush,
  enablePush,
  fetchPushStatus,
  orbiRegistration,
  saveSubscription,
  sendTestPush,
  type PushServerStatus,
} from "./push-client"

type Busy = "enable" | "disable" | "test" | null

const UNAVAILABLE: Partial<Record<PushState, { tone: StatusTone; label: "push_local" | "push_not_configured" | "push_ios_install" | "push_ios_version" | "push_unsupported" | "push_no_worker" | "push_denied"; body: "push_local_body" | "push_not_configured_body" | "push_ios_install_body" | "push_ios_version_body" | "push_unsupported_body" | "push_no_worker_body" | "push_denied_body" }>> = {
  local: { tone: "neutral", label: "push_local", body: "push_local_body" },
  "not-configured": { tone: "warning", label: "push_not_configured", body: "push_not_configured_body" },
  "ios-install": { tone: "neutral", label: "push_ios_install", body: "push_ios_install_body" },
  "ios-version": { tone: "warning", label: "push_ios_version", body: "push_ios_version_body" },
  unsupported: { tone: "neutral", label: "push_unsupported", body: "push_unsupported_body" },
  "no-worker": { tone: "neutral", label: "push_no_worker", body: "push_no_worker_body" },
  denied: { tone: "serious", label: "push_denied", body: "push_denied_body" },
}

/** Push notifications for this device, with an honest state for every reason it may not work. */
export function PushCard() {
  const t = useT(remindersMessages)
  const settings = useSettings()
  const platform = usePwaStore((s) => s.platform)
  const standalone = usePwaStore((s) => s.standalone)
  const install = useInstallOrbi()
  const [status, setStatus] = useState<PushServerStatus | null | undefined>(isSupabaseConfigured ? undefined : null)
  const [hasWorker, setHasWorker] = useState<boolean | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [support, setSupport] = useState<ReturnType<typeof browserPushSupport> | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  const refresh = useCallback(async () => {
    const registration = await orbiRegistration()
    const existing = await currentSubscription(registration)
    setSupport(browserPushSupport())
    setHasWorker(Boolean(registration))
    setSubscription(existing)
    return existing
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void (async () => {
      const [server, existing] = await Promise.all([fetchPushStatus(), refresh()])
      if (!active) return
      setStatus(server)
      // Keep the server in step with this browser (e.g. after switching accounts). Idempotent.
      if (server?.push && existing) void saveSubscription(existing)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  const state = pushState({
    online: isSupabaseConfigured,
    configured: status === undefined ? null : Boolean(status?.push && status.publicKey),
    platform,
    standalone,
    hasServiceWorker: support?.hasServiceWorker ?? true,
    hasPushManager: support?.hasPushManager ?? true,
    hasNotification: support?.hasNotification ?? true,
    hasWorker: support ? hasWorker : null,
    permission: support?.permission ?? "default",
  })

  async function enable() {
    if (!status?.publicKey) return
    setBusy("enable")
    const result = await enablePush(status.publicKey)
    await refresh()
    setBusy(null)
    if (result === "subscribed") toast.success(t("push_enabled_toast"))
    else if (result === "denied") toast.error(t("push_denied_toast"))
    else toast.error(t("push_failed_toast"))
  }

  async function disable() {
    if (!subscription) return
    setBusy("disable")
    const ok = await disablePush(subscription)
    await refresh()
    setBusy(null)
    if (ok) toast.success(t("push_disabled_toast"))
    else toast.error(t("push_generic_error"))
  }

  async function test() {
    if (!subscription) return
    setBusy("test")
    const result = await sendTestPush(subscription)
    setBusy(null)
    if (result === "sent") toast.success(t("push_test_sent"))
    else if (result === "missing") toast.error(t("push_test_missing"))
    else toast.error(t("push_generic_error"))
  }

  const unavailable = UNAVAILABLE[state]
  return (
    <SectionCard
      title={t("push_title")}
      description={t("push_description")}
      action={<StatusPill tone="neutral" icon={Smartphone}>{t("push_badge")}</StatusPill>}
      className="h-full"
    >
      {state === "checking" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("push_checking")}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
      ) : unavailable ? (
        <div className="flex flex-col items-start gap-2">
          <StatusPill tone={unavailable.tone}>{t(unavailable.label)}</StatusPill>
          <p className="text-xs text-pretty text-muted-foreground">{t(unavailable.body)}</p>
          {state === "ios-install" && install.visible ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void install.install()}>
              <Smartphone aria-hidden />
              {t("push_ios_install_action")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          {subscription ? (
            <StatusPill tone="good" icon={BellRing}>
              {t("push_on")}
            </StatusPill>
          ) : (
            <StatusPill tone="neutral" icon={BellOff}>
              {t("push_off")}
            </StatusPill>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {subscription ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => void test()} disabled={busy !== null}>
                  {busy === "test" ? <Spinner /> : <Send aria-hidden />}
                  {busy === "test" ? t("push_testing") : t("push_test")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void disable()} disabled={busy !== null}>
                  {busy === "disable" ? <Spinner /> : <BellOff aria-hidden />}
                  {t("push_disable")}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={() => void enable()} disabled={busy !== null}>
                {busy === "enable" ? <Spinner /> : <BellRing aria-hidden />}
                {busy === "enable" ? t("push_enabling") : t("push_enable")}
              </Button>
            )}
          </div>
          {!anyReminderEnabled(settings) ? <Note>{t("push_no_reminders")}</Note> : null}
          {status && !status.scheduler ? <Note>{t("push_no_scheduler")}</Note> : null}
        </div>
      )}
      {install.dialog}
    </SectionCard>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-xs text-pretty text-muted-foreground">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning-fg" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
