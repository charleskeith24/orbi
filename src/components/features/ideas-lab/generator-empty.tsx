"use client"

import { Sparkles } from "lucide-react"
import { useId } from "react"
import { useT } from "@/lib/i18n"
import { generatorMessages } from "./generator-messages"
import type { ExampleBrief } from "./generator-model"

/** Before the first generation: what the generator does, plus example briefs built from real workspace gaps. */
export function GeneratorEmptyState({
  examples,
  busy,
  onRun,
}: {
  examples: ExampleBrief[]
  busy: boolean
  onRun: (example: ExampleBrief) => void
}) {
  const headingId = useId()
  const t = useT(generatorMessages)
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-dashed bg-card/50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg border bg-card shadow-xs dark:bg-input/30">
          <Sparkles className="size-5 text-brand" aria-hidden />
        </div>
        <h2 id={headingId} className="text-sm font-medium">
          {t("empty_title")}
        </h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          {t("empty_description")}
        </p>
      </div>
      <ul className="mx-auto mt-5 grid max-w-3xl gap-2 sm:grid-cols-2">
        {examples.map((example) => (
          <li key={example.id} className="min-w-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => onRun(example)}
              className="flex h-full w-full min-w-0 flex-col gap-1 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/20 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/20"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0 truncate">{example.title}</span>
              </span>
              <span className="text-xs text-pretty text-muted-foreground">{example.reason}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
