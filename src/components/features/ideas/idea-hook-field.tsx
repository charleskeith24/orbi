"use client"

import { BookmarkPlus, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { AiButton, FormField, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAiTask, type AiTaskOutput } from "@/lib/ai"
import { HOOK_CATEGORIES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions } from "@/lib/store"
import type { ContentIdea } from "@/lib/types"
import { IdeaAiError } from "./idea-ai-error"
import { AutosaveTextarea } from "./idea-autosave"
import { ideaDetailMessages } from "./idea-detail-messages"
import { hookTopicFor } from "./idea-model"

const HOOK_COUNT = 6

type GeneratedHook = AiTaskOutput<"generate_hooks">["hooks"][number]

/** Hook field with "Generate hooks": editable suggestions → use one as the idea's hook or save it to the Hook Library. */
export function IdeaHookField({ idea }: { idea: ContentIdea }) {
  const id = useId()
  const t = useT(ideaDetailMessages)
  const hooks = useAiTask("generate_hooks")
  const [dismissed, setDismissed] = useState(false)
  const topic = hookTopicFor(idea)
  const results = dismissed ? [] : (hooks.data?.hooks ?? [])

  function generate() {
    setDismissed(false)
    void hooks.run({ topic, count: HOOK_COUNT, categories: [] }, { entityType: "content_ideas", entityId: idea.id })
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField
        label={t("hook")}
        htmlFor={`${id}-hook`}
        description={t("hook_help")}
        labelAction={
          <AiButton
            type="button"
            size="xs"
            variant="ghost"
            pending={hooks.isPending}
            disabled={!topic}
            title={topic ? t("hook_ai_title") : t("hook_needs_title")}
            onClick={generate}
          >
            {hooks.data ? t("more_hooks") : t("generate_hooks")}
          </AiButton>
        }
      >
        <AutosaveTextarea
          id={`${id}-hook`}
          rows={2}
          value={idea.hook}
          placeholder={t("hook_placeholder")}
          onCommit={(hook) => dataActions.update("content_ideas", idea.id, { hook })}
        />
      </FormField>

      {hooks.error ? <IdeaAiError message={hooks.error.message} onRetry={generate} /> : null}

      {results.length ? (
        <section aria-label={t("suggested_hooks")} className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-medium">{t("suggested_hooks")}</h4>
            <ProviderBadge provider={hooks.provider ?? "offline"} model={hooks.model ?? undefined} />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="ml-auto text-muted-foreground"
              aria-label={t("dismiss_suggested")}
              onClick={() => setDismissed(true)}
            >
              <X aria-hidden />
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-border/70">
            {results.map((hook, index) => (
              <HookSuggestion key={`${index}-${hook.text}`} idea={idea} hook={hook} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("suggestions_note")}</p>
        </section>
      ) : null}
    </div>
  )
}

function HookSuggestion({ idea, hook }: { idea: ContentIdea; hook: GeneratedHook }) {
  const router = useRouter()
  const t = useT(ideaDetailMessages)
  const c = useT(commonMessages)
  const [text, setText] = useState(hook.text)
  const [saved, setSaved] = useState(false)
  const clean = text.replace(/\s+/g, " ").trim()
  const inUse = clean.length > 0 && idea.hook.trim() === clean
  const category = HOOK_CATEGORIES[hook.category]?.label ?? hook.category

  function use() {
    if (!clean) return
    dataActions.update("content_ideas", idea.id, { hook: clean, hook_category: hook.category })
    toast.success(t("hook_updated"), { description: clean })
  }

  function save() {
    if (!clean) return
    const row = dataActions.insert("hooks", {
      text: clean,
      category: hook.category,
      source: "ai",
      pillar_id: idea.pillar_id,
      is_template: false,
    })
    setSaved(true)
    toast.success(t("saved_to_hook_library"), {
      description: clean,
      action: { label: c("open"), onClick: () => router.push(`/ideas/hooks?open=${row.id}`) },
    })
  }

  return (
    <li className="flex flex-col gap-1.5 py-2.5 last:pb-1">
      <span className="text-xs text-muted-foreground">{category}</span>
      <Textarea
        rows={1}
        value={text}
        aria-label={t("suggested_label", { category: category.toLowerCase() })}
        onChange={(event) => setText(event.target.value)}
        className="min-h-0 bg-background text-sm dark:bg-input/30"
      />
      {hook.why ? <p className="text-xs text-pretty text-muted-foreground">{hook.why}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="xs" variant="outline" disabled={!clean || inUse} onClick={use}>
          {inUse ? <Check aria-hidden /> : null}
          {inUse ? t("in_use") : t("use_hook")}
        </Button>
        <Button type="button" size="xs" variant="ghost" disabled={!clean || saved} onClick={save}>
          <BookmarkPlus aria-hidden />
          {saved ? t("saved_to_library") : t("save_to_hook_library")}
        </Button>
      </div>
    </li>
  )
}
