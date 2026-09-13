import type { ComponentType } from "react"

/** Any icon component (lucide icons, PlatformIcon wrappers, custom SVGs). */
export type IconComponent = ComponentType<{ className?: string }>

/** Status meaning — reserved for good / warning / serious / critical states. */
export type StatusTone = "good" | "warning" | "serious" | "critical" | "neutral"

/** Control height scale: `sm` = h-7 (dense toolbars), `default` = h-8. */
export type ControlSize = "sm" | "default"
