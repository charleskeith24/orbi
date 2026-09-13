import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * One setting: label and explanation on the left, the control on the right (stacked on mobile).
 * Group rows in `SettingRows` for hairline dividers.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  labelId,
  error,
  children,
  className,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  /** Id of the control, so the label focuses it. */
  htmlFor?: string
  /** Id for the label text when the control is a group (use it as `aria-labelledby`). */
  labelId?: string
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-x-8 gap-y-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
        className
      )}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="leading-5 font-medium">
            {label}
          </Label>
        ) : (
          <p id={labelId} className="text-sm leading-5 font-medium">
            {label}
          </p>
        )}
        {description ? <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {children}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function SettingRows({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-col divide-y", className)}>{children}</div>
}
