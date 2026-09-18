"use client"

import { BookmarkPlus } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AiButton,
  AiNotice,
  ChipToggleGroup,
  chipVariants,
  FormField,
  HookCategorySelect,
  NumberField,
  PillarSelect,
  ProviderBadge,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useAiTask } from "@/lib/ai"
import { HOOK_CATEGORIES, HOOK_CATEGORY_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useBrand, useTable } from "@/lib/store"
import type { HookCategory, ID } from "@/lib/types"
import { hookMessages } from "./hook-messages"
import { newHookValues, normalizeHookText } from "./hook-model"
import { LabAiError } from "./lab-ai-error"
import { LabDialog, LabDialogBody, LabDialogFooter, LabDialogHeader } from "./lab-dialog"

const STYLE_OPTIONS = HOOK_CATEGORY_IDS.filter((id) => id !== "custom").map((id) => ({ value: id, label: HOOK_CATEGORIES[id].label }))
const TOPIC_MAX = 1000

interface Suggestion {
  key: string
  text: string
  category: HookCategory
  why: string
  checked: boolean
}

/** "Generate hooks with AI" (`generate_hooks`): editable suggestions → save the selected ones to the library. */
export function HookGenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <LabDialog open={open} onOpenChange={onOpenChange} size="lg">
      <HookGenerator onClose={() => onOpenChange(false)} />
    </LabDialog>
  )
}

function HookGenerator({ onClose }: { onClose: () => void }) {
  const id = useId()
  const t = useT(hookMessages)
  const c = useT(commonMessages)
  const ai = useAiTask("generate_hooks")
  const brand = useBrand()
  const pillars = useTable("content_pillars")
  const hooks = useTable("hooks")
  const [topic, setTopic] = useState("")
  const [styles, setStyles] = useState<HookCategory[]>([])
  const [count, setCount] = useState<number | null>(8)
  const [pillarId, setPillarId] = useState<ID | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [topicError, setTopicError] = useState<string | null>(null)
  const countOk = typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= 20
  const existing = useMemo(() => new Set(hooks.map((hook) => normalizeHookText(hook.text))), [hooks])
  const topicIdeas = useMemo(
    () =>
      [...new Set([...brand.expertise_areas, ...pillars.filter((p) => p.is_active).map((p) => p.name)].map((t) => t.trim()).filter(Boolean))].slice(0, 8),
    [brand.expertise_areas, pillars]
  )
  const chosen = suggestions.filter((s) => s.checked && s.text.trim() && !existing.has(normalizeHookText(s.text)))
  const selectable = suggestions.filter((s) => s.text.trim() && !existing.has(normalizeHookText(s.text)))
  const allChecked = selectable.length > 0 && selectable.every((s) => s.checked)

  async function generate(event?: React.FormEvent) {
    event?.preventDefault()
    const clean = topic.replace(/\s+/g, " ").trim()
    if (!clean) {
      setTopicError(t("topic_error"))
      return
    }
    if (!countOk || ai.isPending) return
    const result = await ai.run({ topic: clean, count, categories: styles })
    if (!result) return
    const batch = result.generationId ?? String(Date.now())
    setSuggestions(
      result.output.hooks.map((hook, index) => ({
        key: `${batch}:${index}`,
        text: hook.text,
        category: hook.category,
        why: hook.why,
        checked: !existing.has(normalizeHookText(hook.text)),
      }))
    )
  }

  function update(key: string, patch: Partial<Suggestion>) {
    setSuggestions((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  }

  function save() {
    const seen = new Set<string>()
    const fresh = chosen.filter((s) => {
      const key = normalizeHookText(s.text)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (!fresh.length) return
    dataActions.insertMany(
      "hooks",
      fresh.map((s) => newHookValues({ text: s.text, category: s.category, source: "ai", pillar_id: pillarId }))
    )
    toast.success(t.plural("saved", fresh.length), { description: t("saved_description") })
    onClose()
  }

  return (
    <form noValidate onSubmit={(event) => void generate(event)} className="flex min-h-0 flex-1 flex-col">
      <LabDialogHeader
        title={t("generate_ai")}
        description={t("generate_description")}
      />
      <LabDialogBody className="flex flex-col gap-4">
        <FormField label={t("topic")} htmlFor={`${id}-topic`} required error={topicError ?? undefined}>
          <Textarea
            id={`${id}-topic`}
            autoFocus
            rows={2}
            maxLength={TOPIC_MAX}
            value={topic}
            placeholder={t("topic_placeholder")}
            aria-invalid={Boolean(topicError) || undefined}
            onChange={(event) => {
              setTopic(event.target.value)
              setTopicError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
        </FormField>
        {topicIdeas.length ? (
          <div role="group" aria-label={t("topic_suggestions")} className="-mt-2 flex flex-wrap gap-1.5">
            {topicIdeas.map((idea) => (
              <button
                key={idea}
                type="button"
                className={chipVariants({ size: "xs" })}
                onClick={() => {
                  setTopic(idea)
                  setTopicError(null)
                }}
              >
                {idea}
              </button>
            ))}
          </div>
        ) : null}
        <FormField label={t("hook_styles")} description={styles.length ? undefined : t("styles_help")}>
          <ChipToggleGroup multiple size="xs" options={STYLE_OPTIONS} value={styles} onChange={setStyles} aria-label={t("hook_styles")} />
        </FormField>
        <FormField label={t("count_label")} htmlFor={`${id}-count`} error={countOk ? undefined : t("count_error")} className="max-w-40">
          <NumberField id={`${id}-count`} integer min={1} max={20} value={count} onChange={setCount} aria-invalid={!countOk || undefined} />
        </FormField>

        {ai.error ? <LabAiError message={ai.error.message} onRetry={() => void generate()} /> : null}

        {suggestions.length ? (
          <section aria-label={t("suggested_hooks")} className="flex min-w-0 flex-col gap-2 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">{t("suggestions")}</h3>
              <ProviderBadge provider={ai.provider ?? "offline"} model={ai.model ?? undefined} />
              {selectable.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  onClick={() => {
                    const keys = new Set(selectable.map((s) => s.key))
                    setSuggestions((current) => current.map((s) => (keys.has(s.key) ? { ...s, checked: !allChecked } : s)))
                  }}
                >
                  {allChecked ? t("select_none") : c("select_all")}
                </Button>
              ) : null}
            </div>
            <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
              {suggestions.map((s) => {
                const duplicate = existing.has(normalizeHookText(s.text))
                return (
                  <li key={s.key} className="flex min-w-0 items-start gap-3 px-3 py-2.5">
                    <Checkbox
                      checked={s.checked && !duplicate}
                      disabled={duplicate || !s.text.trim()}
                      onCheckedChange={(value) => update(s.key, { checked: value === true })}
                      aria-label={t("keep", { text: s.text })}
                      className="mt-2"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Textarea
                        rows={1}
                        value={s.text}
                        aria-label={t("hook_text")}
                        onChange={(event) => update(s.key, { text: event.target.value })}
                        className="min-h-0 bg-background text-sm dark:bg-input/30"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <HookCategorySelect
                          size="sm"
                          value={s.category}
                          onChange={(category) => {
                            if (category) update(s.key, { category })
                          }}
                          className="w-36"
                          aria-label={t("hook_style")}
                        />
                        {duplicate ? <span className="text-xs text-muted-foreground">{t("already_in_library")}</span> : null}
                      </div>
                      {s.why ? <p className="text-xs text-pretty text-muted-foreground">{s.why}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            <FormField label={t("pillar_for_saved")} htmlFor={`${id}-pillar`} className="max-w-72">
              <PillarSelect id={`${id}-pillar`} size="sm" allowNone value={pillarId} onChange={setPillarId} />
            </FormField>
            <AiNotice />
          </section>
        ) : null}
      </LabDialogBody>
      <LabDialogFooter status={suggestions.length ? <span className="num">{t("selected", { count: chosen.length })}</span> : undefined}>
        <AiButton type="submit" variant={suggestions.length ? "outline" : "default"} pending={ai.isPending} disabled={!countOk}>
          {suggestions.length ? t("regenerate") : t("generate_hooks")}
        </AiButton>
        {suggestions.length ? (
          <Button type="button" disabled={!chosen.length || ai.isPending} onClick={save}>
            <BookmarkPlus aria-hidden />
            {t("save_to_library", { count: chosen.length })}
          </Button>
        ) : null}
      </LabDialogFooter>
    </form>
  )
}
