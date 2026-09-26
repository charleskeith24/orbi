"use client"

import { Cpu, Info, PenLine, Sparkles } from "lucide-react"
import { aiMessages } from "@/components/common/messages"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT, type Translator } from "@/lib/i18n"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { GeneratedBy } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Button for AI actions: Sparkles icon; while `pending`, a spinner + "Generating…"
 * and disabled. Keep the previous output visible while regenerating.
 */
export function AiButton({
  pending = false,
  pendingLabel,
  variant = "outline",
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean; pendingLabel?: string }) {
  const t = useT(aiMessages)
  return (
    <Button variant={variant} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? <Spinner /> : <Sparkles className={cn(variant !== "default" && "text-brand")} aria-hidden />}
      {pending ? (pendingLabel ?? t("generating")) : children}
    </Button>
  )
}

/** "claude-opus-5" → "Opus 5", "claude-sonnet-4-5-20250929" → "Sonnet 4.5". */
export function prettyModelName(model: string | null | undefined): string {
  if (!model) return ""
  const parts = model
    .replace(/^claude-/i, "")
    .split(/[-_]/)
    .filter((p) => p && !/^\d{8}$/.test(p))
  const words: string[] = []
  for (const part of parts) {
    const prev = words[words.length - 1]
    if (/^\d+$/.test(part) && prev && /^\d+(\.\d+)*$/.test(prev)) words[words.length - 1] = `${prev}.${part}`
    else words.push(/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
  }
  return words.join(" ")
}

type AiTranslator = Translator<(typeof aiMessages)["en"]>

const PROVIDER_COPY: Record<GeneratedBy, { icon: typeof Sparkles; explain: (t: AiTranslator, model?: string) => string }> = {
  anthropic: {
    icon: Sparkles,
    explain: (t, model) => t("explain_anthropic", { model: model ? ` (${model})` : "" }),
  },
  openai: {
    icon: Sparkles,
    explain: (t, model) => t("explain_openai", { model: model ? ` (${model})` : "" }),
  },
  gemini: {
    icon: Sparkles,
    explain: (t, model) => t("explain_gemini", { model: model ? ` (${model})` : "" }),
  },
  // Online, everyone brings their own key; locally, the server's ANTHROPIC_API_KEY decides.
  offline: { icon: Cpu, explain: (t) => t(isSupabaseConfigured ? "explain_offline" : "explain_offline_local") },
  manual: { icon: PenLine, explain: (t) => t("explain_manual") },
}

function providerLabel(t: AiTranslator, provider: GeneratedBy, model?: string): string {
  const pretty = prettyModelName(model)
  if (provider === "anthropic") return pretty ? `Claude ${pretty}` : "Claude"
  if (provider === "openai") return model ? `OpenAI · ${model}` : "OpenAI"
  if (provider === "gemini") return model ? `Gemini · ${model.replace(/^(models\/)?gemini-/i, "")}` : "Gemini"
  if (provider === "offline") return t("offline_templates")
  return t("written_manually")
}

/** Which engine produced a piece of output — honest labelling, with an explanatory tooltip. */
export function ProviderBadge({
  provider,
  model,
  className,
}: {
  provider: GeneratedBy
  model?: string
  className?: string
}) {
  const t = useT(aiMessages)
  const copy = PROVIDER_COPY[provider] ?? PROVIDER_COPY.offline
  const Icon = copy.icon
  const label = providerLabel(t, provider, model)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex h-5 w-fit shrink-0 cursor-default items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:bg-input/30",
            className
          )}
        >
          <Icon className={cn("size-3 shrink-0", (provider === "anthropic" || provider === "openai" || provider === "gemini") && "text-brand")} aria-hidden />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-pretty">{copy.explain(t, model)}</TooltipContent>
    </Tooltip>
  )
}

/** Small muted honest-labelling line under AI output. */
export function AiNotice({ children, className }: { children?: React.ReactNode; className?: string }) {
  const t = useT(aiMessages)
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-pretty text-muted-foreground", className)}>
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children ?? t("notice")}</span>
    </p>
  )
}
