/**
 * PWA runtime (client only, starts when this module loads): install state for "Install Orbi",
 * service-worker registration in production builds, and the offline page's copy.
 *
 * It starts at module load rather than in an effect because the sidebar (which imports it) is not
 * mounted on phones until it opens, and `beforeinstallprompt` can fire early.
 */
import { toast } from "sonner"
import { create } from "zustand"
import { translate, type UiLang } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { useDataStore } from "@/lib/store/data-store"
import { detectInstallPlatform, installMode, type InstallMode, type InstallPlatform } from "./install"
import { m } from "./messages"

/** Chrome's install prompt event (not in the DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

interface PwaState {
  standalone: boolean
  installed: boolean
  platform: InstallPlatform
  promptEvent: BeforeInstallPromptEvent | null
}

/**
 * The server render and hydration see these initial values (zustand's server snapshot); the real
 * browser values arrive right after hydration, so the markup never mismatches.
 */
export const usePwaStore = create<PwaState>()(() => ({
  standalone: false,
  installed: false,
  platform: "other",
  promptEvent: null,
}))

export function useInstallMode(): InstallMode {
  const standalone = usePwaStore((s) => s.standalone)
  const installed = usePwaStore((s) => s.installed)
  const canPrompt = usePwaStore((s) => s.promptEvent !== null)
  const platform = usePwaStore((s) => s.platform)
  return installMode({ standalone, installed, canPrompt, platform })
}

/** Shows the browser's install prompt. A prompt event works once, so it is used up either way. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = usePwaStore.getState().promptEvent
  if (!event) return "unavailable"
  usePwaStore.setState({ promptEvent: null })
  try {
    await event.prompt()
    return (await event.userChoice).outcome
  } catch {
    return "unavailable"
  }
}


const SW_URL = "/sw.js"

function isOrbiWorker(registration: ServiceWorkerRegistration): boolean {
  const worker = registration.active ?? registration.waiting ?? registration.installing
  return Boolean(worker && new URL(worker.scriptURL).pathname === SW_URL)
}

/** Everything this page loaded before the worker controlled it (the worker keeps only what its rules allow). */
function loadedResources(): { pages: string[]; assets: string[] } {
  const assets = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((href) => href.startsWith(location.origin))
  return { pages: [location.pathname], assets: [...assets, "/manifest.webmanifest", "/icons/icon-192.png"] }
}

/** Sends the offline page's copy in the workspace language, again whenever the language changes. */
function syncOfflineCopy(registration: ServiceWorkerRegistration) {
  let sent: UiLang | null = null
  const send = () => {
    const lang = getUiLang()
    const worker = registration.active
    if (lang === sent || !worker) return
    sent = lang
    const t = (key: "offline_title" | "offline_body" | "offline_today" | "offline_retry") => translate(m, lang, key)
    worker.postMessage({
      type: "ORBI_OFFLINE_COPY",
      copy: { lang, title: t("offline_title"), body: t("offline_body"), today: t("offline_today"), retry: t("offline_retry") },
    })
  }
  send()
  useDataStore.subscribe(send)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    sent = null
    send()
  })
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return
  if (process.env.NODE_ENV !== "production") {
    // `next dev` never runs the worker (HMR, fresh code). Remove one left behind by a local production run.
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.filter(isOrbiWorker).forEach((registration) => void registration.unregister()))
      .catch(() => undefined)
    return
  }
  const register = () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        registration.active?.postMessage({ type: "ORBI_WARM", ...loadedResources() })
        syncOfflineCopy(registration)
      })
      .catch(() => {
        // Unsupported here (private mode, plain http): Orbi simply works online only.
      })
  }
  if (document.readyState === "complete") register()
  else window.addEventListener("load", register, { once: true })
}

let started = false

function startPwa() {
  if (started || typeof window === "undefined") return
  started = true

  const displayModes = ["standalone", "fullscreen", "minimal-ui"].map((mode) => window.matchMedia(`(display-mode: ${mode})`))
  const readStandalone = () =>
    displayModes.some((query) => query.matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true
  usePwaStore.setState({
    standalone: readStandalone(),
    platform: detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0),
  })
  for (const query of displayModes) query.addEventListener?.("change", () => usePwaStore.setState({ standalone: readStandalone() }))

  // Not preventDefault(): Chrome keeps its own install hint too; the event is kept for "Install Orbi".
  window.addEventListener("beforeinstallprompt", (event) => usePwaStore.setState({ promptEvent: event as BeforeInstallPromptEvent }))
  window.addEventListener("appinstalled", () => {
    usePwaStore.setState({ installed: true, promptEvent: null })
    const lang = getUiLang()
    toast.success(translate(m, lang, "installed_toast"), { description: translate(m, lang, "installed_toast_body") })
  })

  setupServiceWorker()
}

startPwa()
