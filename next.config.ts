import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
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
