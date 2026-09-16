import type { MetadataRoute } from "next"

/**
 * Web app manifest (served at /manifest.webmanifest). Makes Orbi installable, adds home-screen
 * shortcuts and registers the Android share target (/share turns shared text into a Quick Capture).
 * Icons are rendered from the Orbi mark by `node scripts/generate-icons.mjs`.
 * Browsers read this without a workspace, so it is English (like page metadata).
 */

/** The light theme's background token (`--background: oklch(0.99 0 0)`). */
const LIGHT_BACKGROUND = "#fcfcfc"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Orbi",
    short_name: "Orbi",
    description: "Your personal brand content OS: plan, create, publish and learn from every post.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: LIGHT_BACKGROUND,
    theme_color: LIGHT_BACKGROUND,
    lang: "en",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Quick Capture", short_name: "Capture", description: "Save an idea before it's gone", url: "/share?action=capture" },
      { name: "Today", short_name: "Today", description: "What to post, record and review today", url: "/today" },
      { name: "New content", short_name: "New", description: "Start a post in Content Studio", url: "/share?action=new-content" },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  }
}
