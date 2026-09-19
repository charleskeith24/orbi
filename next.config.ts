import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
  // Dev only: let phones on the same Wi-Fi open the dev server (http://<this Mac's LAN IP>:3000).
  // Without this, Next blocks the dev scripts for any host other than localhost and the page never loads.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
  async headers() {
    return [
      {
        // The PWA service worker (public/sw.js): always re-checked so updates reach people quickly,
        // and limited to same-origin requests.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
