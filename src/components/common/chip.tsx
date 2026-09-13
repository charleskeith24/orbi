import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/** Bordered chip used by toggle chips, facet options and removable tokens. */
export const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-md border text-xs font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      size: {
        xs: "h-6 px-2",
        sm: "h-7 px-2.5",
        default: "h-8 px-3",
      },
      selected: {
        true: "border-brand/45 bg-brand-soft text-foreground",
        false: "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50",
      },
    },
    defaultVariants: { size: "sm", selected: false },
  }
)

export type ChipVariantProps = VariantProps<typeof chipVariants>

/** Static (non-interactive) token with the chip look, e.g. a tag or a selected value. */
export function Token({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="token"
      className={cn(
        "inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium text-foreground dark:bg-input/30 [&_svg]:size-3 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
