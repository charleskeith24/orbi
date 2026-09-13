import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Quiet "go to module" link for card headers. */
export function CardLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Button asChild variant="ghost" size="xs" className={cn("text-muted-foreground", className)}>
      <Link href={href}>
        {children}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  )
}
