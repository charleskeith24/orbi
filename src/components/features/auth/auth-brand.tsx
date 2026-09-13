/** Product mark for the auth screens (same glyph as the sidebar's BrandMark, kept dependency-free). */
export function AuthBrand() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none">
          <path
            d="M5 19V5h7a4.5 4.5 0 0 1 0 9H5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17.5" cy="18" r="2" fill="currentColor" />
        </svg>
      </span>
      <p className="mt-3 text-sm font-semibold">Personal Brand OS</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Strategy → Create → Publish → Analyze → Improve</p>
    </div>
  )
}
