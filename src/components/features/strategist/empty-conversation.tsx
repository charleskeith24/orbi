"use client"

import { ArrowUpRight, Sparkles } from "lucide-react"
import { AiNotice } from "@/components/common"
import { useAiStatus } from "@/lib/ai"
import { useT, useUiLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { suggestedPrompts } from "./prompts"
import { strategistSession } from "./session"
import { strategistMessages } from "./strategist-messages"

/** First-run state: what the strategist is for and the §56 prompts to start with. */
export function EmptyConversation({ variant }: { variant: "panel" | "page" }) {
  const ai = useAiStatus()
  const page = variant === "page"
  const t = useT(strategistMessages)
  const prompts = suggestedPrompts(useUiLang())
  return (
    <div className={cn("flex flex-col gap-5", page && "mx-auto w-full max-w-lg lg:min-h-full lg:justify-center lg:py-6")}>
      <div className="flex flex-col gap-2">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Sparkles className="size-4" />
        </span>
        <h3 className="text-sm font-semibold">{t("empty_title")}</h3>
        <p className="text-sm text-pretty text-muted-foreground">{t("empty_description")}</p>
      </div>
      <div className={cn("flex flex-col gap-1.5", page && "lg:hidden")}>
        <p className="text-xs font-medium text-muted-foreground">{t("try_asking")}</p>
        <ul className="flex flex-col gap-1.5">
          {prompts.map((prompt) => {
            const Icon = prompt.icon
            return (
              <li key={prompt.text}>
                <button
                  type="button"
                  onClick={() => strategistSession.pick(prompt)}
                  className="group flex w-full items-center gap-2.5 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">{prompt.label ?? prompt.text}</span>
                  {prompt.prefill ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{t("add_details")}</span>
                  ) : (
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {!ai.loading && !ai.configured ? (
        <AiNotice>{t("offline_notice")}</AiNotice>
      ) : null}
    </div>
  )
}
