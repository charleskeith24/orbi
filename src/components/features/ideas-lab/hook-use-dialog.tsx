"use client"

import { Lightbulb } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { CopyButton, FormField, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HOOK_CATEGORIES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { createIdea } from "@/lib/store"
import type { Hook, ID } from "@/lib/types"
import { hookMessages } from "./hook-messages"
import { countBlanks, fillBlanks } from "./hook-model"
import { HookText } from "./hook-text"
import { LabDialog, LabDialogBody, LabDialogFooter, LabDialogHeader } from "./lab-dialog"

/** "Use hook": fill in the blanks, then copy the line or start an Idea Bank idea with it. */
export function HookUseDialog({ hook, open, onOpenChange }: { hook: Hook | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <LabDialog open={open} onOpenChange={onOpenChange} size="md">
      {hook ? <HookUseForm key={hook.id} hook={hook} onClose={() => onOpenChange(false)} /> : null}
    </LabDialog>
  )
}

function HookUseForm({ hook, onClose }: { hook: Hook; onClose: () => void }) {
  const router = useRouter()
  const t = useT(hookMessages)
  const id = useId()
  const blanks = countBlanks(hook.text)
  const [values, setValues] = useState<string[]>(() => Array.from({ length: blanks }, () => ""))
  /** null = the title follows the filled-in hook until the user types their own. */
  const [title, setTitle] = useState<string | null>(null)
  const [pillarId, setPillarId] = useState<ID | null>(hook.pillar_id)
  const [error, setError] = useState<string | null>(null)
  const filled = fillBlanks(hook.text, values)
  const remaining = countBlanks(filled)
  const ideaTitle = title ?? (remaining ? "" : filled.replace(/[.!?…:]+$/, ""))

  function create(event: React.FormEvent) {
    event.preventDefault()
    const clean = ideaTitle.replace(/\s+/g, " ").trim()
    if (!clean) {
      setError(t("title_error"))
      return
    }
    const idea = createIdea({ title: clean, hook: filled, hook_category: hook.category, pillar_id: pillarId, source: "manual", status: "inbox" })
    toast.success(t("idea_created"), {
      description: clean,
      action: { label: t("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
    onClose()
  }

  return (
    <form noValidate onSubmit={create} className="flex min-h-0 flex-1 flex-col">
      <LabDialogHeader
        title={t("use_title")}
        description={blanks ? t("use_description_blanks") : t("use_description_plain")}
      />
      <LabDialogBody className="flex flex-col gap-4">
        <div className="rounded-lg border bg-muted/30 px-3 py-3 dark:bg-muted/15">
          <p className="text-xs text-muted-foreground">{t("category_hook", { category: HOOK_CATEGORIES[hook.category]?.label ?? "Custom" })}</p>
          <p className="mt-1 text-base leading-snug font-medium">
            <HookText text={filled} />
          </p>
        </div>
        {blanks ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {values.map((value, index) => (
              <FormField key={index} label={blanks === 1 ? t("fill_blank") : t("blank_n", { n: index + 1 })} htmlFor={`${id}-blank-${index}`}>
                <Input
                  id={`${id}-blank-${index}`}
                  autoFocus={index === 0}
                  value={value}
                  maxLength={120}
                  autoComplete="off"
                  placeholder={index === 0 ? t("blank_placeholder") : "…"}
                  onChange={(event) => setValues((current) => current.map((v, i) => (i === index ? event.target.value : v)))}
                />
              </FormField>
            ))}
          </div>
        ) : null}
        <FormField
          label={t("idea_title")}
          htmlFor={`${id}-title`}
          required
          error={error ?? undefined}
          description={t("idea_title_help")}
        >
          <Input
            id={`${id}-title`}
            autoFocus={!blanks}
            value={ideaTitle}
            maxLength={200}
            placeholder={t("idea_title_placeholder")}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setTitle(event.target.value)
              setError(null)
            }}
          />
        </FormField>
        <FormField label={t("content_pillar")} htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={pillarId} onChange={setPillarId} />
        </FormField>
      </LabDialogBody>
      <LabDialogFooter status={remaining ? t.plural("blanks_left", remaining) : undefined}>
        <CopyButton text={filled} label={t("copy_hook")} variant="outline" size="default" successMessage={t("hook_copied")} />
        <Button type="submit">
          <Lightbulb aria-hidden />
          {t("create_idea")}
        </Button>
      </LabDialogFooter>
    </form>
  )
}
