"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

/**
 * Orbi — the official logo. The "O" is a ring with an orbit and a satellite. The ring and letters use
 * currentColor so the logo follows the theme (dark ink in light mode, light ink in dark mode); the
 * orbit keeps its sky → indigo gradient in both.
 */
const ORBIT_FROM = "#56b9f5"
const ORBIT_TO = "#6b6cf3"

/** Ring broken where the orbit passes in front (lower left) and where the satellite sits (upper right). */
const RING = "M45.54 14.66A22 22 0 0 0 11.75 40.6M17.28 48.35A22 22 0 0 0 51.42 21.67"
const ORBIT = "M2.5 34.5C1.5 41.5 7 46 14 44.6C26 42.3 42 29 51 16.5"

function useGradientId() {
  return `orbi-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
}

function MarkShapes({ gradientId }: { gradientId: string }) {
  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="2" y1="40" x2="54" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={ORBIT_FROM} />
          <stop offset="1" stopColor={ORBIT_TO} />
        </linearGradient>
      </defs>
      <path d={RING} fill="none" stroke="currentColor" strokeWidth="8.5" />
      <path d={ORBIT} fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="51" cy="16" r="5.2" fill={ORBIT_TO} />
    </>
  )
}

/** The "O" on its own — for square spots (collapsed sidebar, avatars, favicons). */
export function OrbiMark({ className, title = "Orbi" }: { className?: string; title?: string }) {
  const gradientId = useGradientId()
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title} className={cn("shrink-0", className)}>
      <MarkShapes gradientId={gradientId} />
    </svg>
  )
}

/** The full "Orbi" wordmark. Size it by height (e.g. `h-6`); width follows. */
export function OrbiLogo({ className, title = "Orbi" }: { className?: string; title?: string }) {
  const gradientId = useGradientId()
  return (
    <svg viewBox="0 0 156 64" role="img" aria-label={title} className={cn("h-6 w-auto shrink-0", className)}>
      <MarkShapes gradientId={gradientId} />
      <text
        x="63"
        y="58.25"
        fill="currentColor"
        fontSize="70"
        fontWeight="700"
        letterSpacing="-1"
        style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}
      >
        rbi
      </text>
    </svg>
  )
}
