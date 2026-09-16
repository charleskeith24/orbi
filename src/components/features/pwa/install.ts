/**
 * Which "Install Orbi" flow this browser gets. Pure — the runtime feeds it navigator values.
 *
 * - `prompt`     Chrome/Edge (Android, desktop) fired `beforeinstallprompt`: show the native prompt.
 * - `ios`        iPhone/iPad: Share → Add to Home Screen instructions (no install API on iOS).
 * - `android`    Android without the event (Firefox, Samsung Internet, prompt not ready): browser-menu steps.
 * - `mac-safari` Safari 17+ on macOS: File → Add to Dock.
 * - `hidden`     already running as an app, just installed, or no known way to install.
 */
export type InstallPlatform = "ios" | "android" | "mac-safari" | "other"
export type InstallMode = "hidden" | "prompt" | "ios" | "android" | "mac-safari"

const NON_SAFARI = /Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i

export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios"
  const mac = /Macintosh/i.test(userAgent)
  // iPadOS 13+ sends a desktop Safari user agent; touch support gives it away.
  if (mac && maxTouchPoints > 1) return "ios"
  if (/Android/i.test(userAgent)) return "android"
  if (mac && !NON_SAFARI.test(userAgent)) {
    const version = userAgent.match(/Version\/(\d+)/)
    if (version && Number(version[1]) >= 17 && /Safari\//.test(userAgent)) return "mac-safari"
  }
  return "other"
}

export interface InstallInput {
  /** Running as an installed app (display-mode standalone/fullscreen/minimal-ui, or iOS `navigator.standalone`). */
  standalone: boolean
  /** `appinstalled` fired in this session. */
  installed: boolean
  /** A `beforeinstallprompt` event is waiting to be used. */
  canPrompt: boolean
  platform: InstallPlatform
}

export function installMode({ standalone, installed, canPrompt, platform }: InstallInput): InstallMode {
  if (standalone || installed) return "hidden"
  if (canPrompt) return "prompt"
  return platform === "other" ? "hidden" : platform
}
