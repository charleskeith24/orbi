import { chipVariants } from "@/components/common/chip"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import type { PlatformId } from "@/lib/types"
import { cn } from "@/lib/utils"

/* Simplified monochrome glyphs on a 24×24 grid, drawn with currentColor. */
const GLYPHS: Record<PlatformId, React.ReactNode> = {
  facebook: (
    <path
      fillRule="evenodd"
      d="M1 12a11 11 0 1 1 22 0 11 11 0 1 1-22 0zm12.4 10.85V14.4h2.9l.45-3.4H13.4V8.9c0-.95.3-1.6 1.65-1.6h1.8V4.25c-.3-.05-1.35-.15-2.5-.15-2.45 0-4.15 1.5-4.15 4.25V11H7.3v3.4h2.9v8.45z"
    />
  ),
  tiktok: (
    <path d="M12.6 2h3.3c.3 2.6 2.1 4.6 5 4.9v3.3c-1.9 0-3.6-.6-5-1.6v7.3a6.1 6.1 0 1 1-6.1-6.1c.3 0 .7 0 1 .1v3.4a2.8 2.8 0 1 0 1.8 2.6z" />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.25" cy="6.75" r="0.6" fill="currentColor" strokeWidth={1.2} />
    </g>
  ),
  youtube: (
    <path
      fillRule="evenodd"
      d="M5.6 4.8h12.8a4.6 4.6 0 0 1 4.6 4.6v5.2a4.6 4.6 0 0 1-4.6 4.6H5.6A4.6 4.6 0 0 1 1 14.6V9.4a4.6 4.6 0 0 1 4.6-4.6zm4.3 3.9v6.6l5.7-3.3z"
    />
  ),
  linkedin: (
    <path
      fillRule="evenodd"
      d="M4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2zm2.65 3.3a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zm-1.4 4.45v8.6h2.8v-8.6zm4.55 0v8.6h2.8v-4.3c0-1.15.55-2.15 1.9-2.15 1.3 0 1.4 1.15 1.4 2.2v4.25h2.8v-4.8c0-2.3-.45-4.05-3.15-4.05-1.45 0-2.5.65-2.95 1.45v-1.2z"
    />
  ),
  x: (
    <path
      fillRule="evenodd"
      d="M1.5 2h6.7l14.3 20h-6.7zm3.1 1.7h2.8l12 16.6h-2.8zM20.4 2h2l-8.07 8.58-.86-1.21zM9.67 13.42l.86 1.21L3.6 22h-2z"
    />
  ),
  threads: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.6 8.3C16.5 5.9 14.4 4.6 12 4.6 7.9 4.6 5.1 7.7 5.1 12s2.8 7.4 6.9 7.4c3.2 0 5.6-1.9 6-4.9.4-2.9-1.7-4.9-4.9-4.9-2.5 0-4.2 1.3-4.2 3.1 0 1.7 1.4 2.8 3.3 2.8 2.5 0 3.9-1.8 3.9-4.7 0-.6 0-1.1-.1-1.6"
    />
  ),
}

/** Brand colours that are near-black read as foreground ink (so they survive dark mode). */
function brandColor(hex: string): string | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return undefined
  const n = Number.parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 48 ? undefined : hex
}

/**
 * Platform glyph. Monochrome (`currentColor`) by default; `colored` uses the platform's
 * brand colour. Decorative unless `label` is set (`true` = the platform name).
 */
export function PlatformIcon({
  platform,
  className,
  colored = false,
  label,
}: {
  platform: PlatformId
  className?: string
  colored?: boolean
  label?: string | boolean
}) {
  const meta = PLATFORMS[platform]
  const name = label === true ? meta.label : typeof label === "string" ? label : undefined
  const color = colored ? brandColor(meta.brandHex) : undefined
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      focusable="false"
      data-slot="platform-icon"
      role={name ? "img" : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      className={cn("size-4 shrink-0", className)}
      style={color ? { color } : undefined}
    >
      {name ? <title>{name}</title> : null}
      {GLYPHS[platform]}
    </svg>
  )
}

/** Icon + platform name. */
export function PlatformLabel({
  platform,
  showIcon = true,
  colored = false,
  short = false,
  className,
}: {
  platform: PlatformId
  showIcon?: boolean
  colored?: boolean
  short?: boolean
  className?: string
}) {
  const meta = PLATFORMS[platform]
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className)}>
      {showIcon ? <PlatformIcon platform={platform} colored={colored} className="size-3.5" /> : null}
      <span className="truncate">{short ? meta.short : meta.label}</span>
    </span>
  )
}

/** Multi-select platform chips (toggle buttons with `aria-pressed`). Keeps canonical platform order. */
export function PlatformToggleGroup({
  value,
  onChange,
  platforms = PLATFORM_IDS,
  size = "sm",
  showLabels = true,
  disabled,
  className,
  "aria-label": ariaLabel = "Platforms",
}: {
  value: PlatformId[]
  onChange: (value: PlatformId[]) => void
  platforms?: PlatformId[]
  size?: "xs" | "sm" | "default"
  showLabels?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  function toggle(platform: PlatformId) {
    const next = new Set(value)
    if (next.has(platform)) next.delete(platform)
    else next.add(platform)
    onChange(PLATFORM_IDS.filter((id) => next.has(id)))
  }

  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", className)}>
      {platforms.map((platform) => {
        const selected = value.includes(platform)
        const meta = PLATFORMS[platform]
        return (
          <button
            key={platform}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            title={showLabels ? undefined : meta.label}
            onClick={() => toggle(platform)}
            className={cn(chipVariants({ size, selected }), !showLabels && "aspect-square justify-center px-0")}
          >
            <PlatformIcon platform={platform} colored={selected} />
            {showLabels ? meta.label : <span className="sr-only">{meta.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
