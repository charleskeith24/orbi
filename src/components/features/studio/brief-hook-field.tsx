"use client"

import { BookmarkPlus, Check, Library, Star, TriangleAlert, X } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, FormField, HookCategorySelect, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAiTask } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { HOOK_CATEGORIES, HOOK_CATEGORY_IDS } from "@/lib/constants"
import { dataActions, useTable } from "@/lib/store"
import type { ContentItem, HookCategory } from "@/lib/types"
import { cn } from "@/lib/utils"
import { briefMessages } from "./brief-messages"
import { AiErrorNotice } from "./studio-ai"

/** Hook text + style, a Hook Library picker and AI hook generation. */
export function HookField({ item, mainMessage, onSaved }: { item: ContentItem; mainMessage: string; onSaved: () => void }) {
  const t = useT(briefMessages)
  const inputId = useId()
  const [draft, setDraft] = useState(item.hook)
  const [source, setSource] = useState(item.hook)
  if (source !== item.hook) {
    setSource(item.hook)
    setDraft(item.hook)
  }
  const ai = useAiTask("generate_hooks")
  const [panelOpen, setPanelOpen] = useState(false)
  const hooks = ai.data?.hooks ?? []

  function commit() {
    const next = draft.trim()
    if (next === item.hook) return
    dataActions.update("content_items", item.id, { hook: next, ...(next ? {} : { hook_id: null }) })
    onSaved()
  }

  function applyHook(text: string, category: HookCategory, hookId: string | null, from: string) {
    dataActions.update("content_items", item.id, { hook: text, hook_category: category, hook_id: hookId })
    onSaved()
    toast.success(t("hook_applied"), { description: text.includes("___") ? t("hook_from_blanks", { from }) : t("hook_from", { from }) })
  }

  function saveToLibrary(text: string, category: HookCategory) {
    dataActions.insert("hooks", { text, category, source: "ai", pillar_id: item.pillar_id })
    toast.success(t("saved_to_library"))
  }

  async function generate() {
    setPanelOpen(true)
    const topic = [item.title, mainMessage].map((s) => s.trim()).filter(Boolean).join(" — ").slice(0, 1000)
    await ai.run({ topic, count: 6, categories: [] }, { entityType: "content_items", entityId: item.id })
  }

  return (
    <FormField
      label={t("hook")}
      htmlFor={inputId}
      description={t("hook_description")}
      labelAction={
        <div className="flex items-center gap-1">
          <HookLibraryPicker onPick={(hook) => applyHook(hook.text, hook.category, hook.id, t("hook_library"))} />
          <AiButton type="button" variant="ghost" size="xs" pending={ai.isPending} pendingLabel={t("writing")} onClick={() => void generate()}>
            {t("generate_hooks")}
          </AiButton>
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          value={draft}
          placeholder={t("hook_placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commit()
            }
          }}
          className="min-w-0 flex-1"
        />
        <HookCategorySelect
          value={item.hook_category}
          onChange={(hook_category) => {
            dataActions.update("content_items", item.id, { hook_category })
            onSaved()
          }}
          allowNone
          aria-label={t("hook_style")}
          className="sm:w-40"
        />
      </div>
      {draft.includes("___") ? (
        <p className="flex items-center gap-1 text-xs text-warning-fg">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {t("fill_blanks")}
        </p>
      ) : null}
      {panelOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-brand/25 bg-brand-soft p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-medium">{t("hook_ideas")}</span>
            {ai.provider && hooks.length ? <ProviderBadge provider={ai.provider} model={ai.model ?? undefined} /> : null}
            <div className="ml-auto flex items-center gap-1">
              {hooks.length ? (
                <AiButton type="button" variant="ghost" size="xs" pending={ai.isPending} pendingLabel={t("writing")} onClick={() => void generate()}>
                  {t("more")}
                </AiButton>
              ) : null}
              <Button type="button" variant="ghost" size="icon-xs" aria-label={t("close_hook_ideas")} onClick={() => setPanelOpen(false)}>
                <X aria-hidden />
              </Button>
            </div>
          </div>
          <AiErrorNotice error={ai.error} onRetry={() => void generate()} />
          {ai.isPending && !hooks.length ? <p className="py-2 text-xs text-muted-foreground">{t("writing_hooks")}</p> : null}
          {hooks.length ? (
            <ul className={cn("flex flex-col divide-y rounded-md border bg-background/80 dark:bg-input/30", ai.isPending && "opacity-60")}>
              {hooks.map((hook) => {
                const current = hook.text.trim() === item.hook.trim()
                return (
                  <li key={hook.text} className="flex min-w-0 items-start gap-2 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-pretty">{hook.text}</p>
                      <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                        <span className="font-medium text-foreground/70">{HOOK_CATEGORIES[hook.category]?.label ?? hook.category}</span> · {hook.why}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("save_to_library")}
                        title={t("save_to_library")}
                        onClick={() => saveToLibrary(hook.text, hook.category)}
                      >
                        <BookmarkPlus aria-hidden />
                      </Button>
                      {current ? (
                        <span className="inline-flex h-6 items-center gap-1 px-1.5 text-xs font-medium text-good-fg">
                          <Check className="size-3.5" aria-hidden />
                          {t("in_use")}
                        </span>
                      ) : (
                        <Button type="button" variant="outline" size="xs" onClick={() => applyHook(hook.text, hook.category, null, t("ai_hook_ideas"))}>
                          {t("use")}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {hooks.length ? <AiNotice>{t("hooks_notice")}</AiNotice> : null}
        </div>
      ) : null}
    </FormField>
  )
}

function HookLibraryPicker({ onPick }: { onPick: (hook: { id: string; text: string; category: HookCategory }) => void }) {
  const t = useT(briefMessages)
  const hooks = useTable("hooks")
  const [open, setOpen] = useState(false)
  const groups = useMemo(
    () =>
      HOOK_CATEGORY_IDS.map((category) => ({
        category,
        hooks: hooks
          .filter((h) => h.category === category && h.text.trim())
          .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.text.localeCompare(b.text)),
      })).filter((g) => g.hooks.length),
    [hooks]
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs">
          <Library aria-hidden />
          {t("library")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] gap-0 p-0">
        <Command>
          <CommandInput placeholder={t("search_library")} />
          <CommandList className="max-h-80">
            <CommandEmpty>{hooks.length ? t("no_matching_hooks") : t("library_empty")}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.category} heading={HOOK_CATEGORIES[group.category].label}>
                {group.hooks.map((hook) => (
                  <CommandItem
                    key={hook.id}
                    value={hook.id}
                    keywords={[hook.text, HOOK_CATEGORIES[hook.category].label]}
                    onSelect={() => {
                      onPick({ id: hook.id, text: hook.text, category: hook.category })
                      setOpen(false)
                    }}
                    className="items-start"
                  >
                    {hook.is_favorite ? <Star className="mt-0.5 fill-current text-muted-foreground" aria-label={t("favourite")} /> : null}
                    <span className="min-w-0 text-pretty">{hook.text}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
