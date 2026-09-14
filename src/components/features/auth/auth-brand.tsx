import { OrbiLogo } from "@/components/app-shell/orbi-logo"

/** Product logo for the auth screens. */
export function AuthBrand() {
  return (
    <div className="flex flex-col items-center text-center">
      <OrbiLogo className="h-9 text-foreground" />
      <p className="mt-3 text-xs text-muted-foreground">Strategy → Create → Publish → Analyze → Improve</p>
    </div>
  )
}
