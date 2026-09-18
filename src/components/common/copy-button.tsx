"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { copyButtonMessages } from "@/components/common/messages"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context — fall back below.
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** Copies `text` with a toast. Icon-only unless `label` is given. */
export function CopyButton({
  text,
  label,
  successMessage,
  variant = "ghost",
  size,
  disabled,
  className,
}: {
  text: string
  label?: string
  successMessage?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  disabled?: boolean
  className?: string
}) {
  const t = useT(copyButtonMessages)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    if (!(await writeClipboard(text))) {
      toast.error(t("copy_failed"), { description: t("copy_failed_description") })
      return
    }
    toast.success(successMessage ?? t("copied_to_clipboard"))
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  const Icon = copied ? Check : Copy
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (label ? "sm" : "icon-sm")}
      disabled={disabled || !text}
      onClick={() => void copy()}
      aria-label={label ? undefined : copied ? t("copied") : t("copy_to_clipboard")}
      title={label ? undefined : t("copy")}
      className={cn(!label && "text-muted-foreground hover:text-foreground", className)}
    >
      <Icon aria-hidden className={cn(copied && "text-good-fg")} />
      {label ? (copied ? t("copied") : label) : null}
    </Button>
  )
}
