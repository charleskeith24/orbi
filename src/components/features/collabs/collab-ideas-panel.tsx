"use client"

import { BookmarkPlus, Check, Compass, Lightbulb } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, DetailSheet, InfoHint, PillarBadge, PlatformIcon, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiTask, type AiTaskOutput } from "@/lib/ai"
import { PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useBrand, useTable } from "@/lib/store"
import type { AiProviderId, ID } from "@/lib/types"
import { saveCollabIdea } from "./collab-actions"
import { ideaSignature } from "./collab-model"
import { AiErrorNotice, CollabTypeBadge } from "./collab-ui"
import { collabIdeasMessages } from "./messages"

type Idea = AiTaskOutput<"collab_ideas">["ideas"][number]

interface IdeasSession {
  ideas: Idea[]
  provider: AiProviderId
  model: string
  /** Titles shown so far — Regenerate asks for new ones. */
  shown: string[]
}

/** The last batch survives closing the panel (module memory, this tab only). */
let lastSession: IdeasSession | null = null

/** Collab ideas (AI `collab_ideas`): partners in adjacent niches, saved one by one as Idea-status collabs. */
export function CollabIdeasSheet({ open, onOpenChange, onOpenCollab }: { open: boolean; onOpenChange: (open: boolean) => void; onOpenCollab: (id: ID) => void }) {
  const t = useT(collabIdeasMessages)
  const ai = useAiTask("collab_ideas")
  const collabs = useTable("collabs")
  const brand = useBrand()
  const nicheMissing = !brand.niche.trim() && !brand.industry.trim()
  const [session, setSession] = useState<IdeasSession | null>(lastSession)
  const [focus, setFocus] = useState("")
  const saved = useMemo(() => new Map(collabs.map((c) => [ideaSignature(c), c.id])), [collabs])

  async function generate() {
    const result = await ai.run({ count: 5, focus: focus.trim().slice(0, 300) || null, exclude: (session?.shown ?? []).slice(-24) })
    if (!result) return
    const next: IdeasSession = {
      ideas: result.output.ideas,
      provider: result.provider,
      model: result.model,
      shown: [...(session?.shown ?? []), ...result.output.ideas.map((i) => i.title)].slice(-24),
    }
    lastSession = next
    setSession(next)
  }

  function save(idea: Idea) {
    const row = saveCollabIdea(idea)
    toast.success(t("saved"), { description: row.title, action: { label: t("open"), onClick: () => onOpenCollab(row.id) } })
  }

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={
        <span className="inline-flex items-center gap-1.5">
          {t("title")}
          <InfoHint title={t("title")}>
            <p>{t("description")}</p>
            <p>{t("how")}</p>
          </InfoHint>
        </span>
      }
    >
      <div className="flex min-w-0 flex-col gap-4" aria-busy={ai.isPending || undefined}>
        <form
          className="flex min-w-0 flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            void generate()
          }}
        >
          <label htmlFor="collab-ideas-focus" className="text-xs font-medium text-muted-foreground">
            {t("focus_label")}
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <Input id="collab-ideas-focus" value={focus} maxLength={300} placeholder={t("focus_placeholder")} onChange={(event) => setFocus(event.target.value)} className="min-w-0 flex-1" />
            <AiButton type="submit" size="default" variant={session ? "outline" : "default"} pending={ai.isPending} className="shrink-0">
              {session ? t("regenerate") : t("generate")}
            </AiButton>
          </div>
        </form>

        {nicheMissing ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs text-pretty text-muted-foreground">
            <Compass className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{t("niche_missing")}</span>
            <Link href="/strategy" className="font-medium text-foreground underline-offset-2 hover:underline">
              Brand HQ
            </Link>
          </p>
        ) : null}

        <AiErrorNotice error={ai.error} onRetry={generate} pending={ai.isPending} />

        {session ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ProviderBadge provider={session.provider} model={session.model} />
              <AiNotice className="min-w-0 flex-1 basis-48">{t("notice")}</AiNotice>
            </div>
            <ul className="flex flex-col gap-3">
              {session.ideas.map((idea) => {
                const savedId = saved.get(ideaSignature(idea)) ?? null
                return (
                  <li key={`${idea.type}-${idea.title}`} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <CollabTypeBadge type={idea.type} />
                      <span className="inline-flex items-center gap-1">
                        <PlatformIcon platform={idea.platform} className="size-3.5" />
                        {PLATFORMS[idea.platform].label}
                      </span>
                      {idea.format ? <span>· {idea.format}</span> : null}
                      {idea.pillar_id ? <PillarBadge pillarId={idea.pillar_id} variant="plain" /> : null}
                    </div>
                    <h4 className="text-sm leading-snug font-medium text-pretty">{idea.title}</h4>
                    <dl className="grid min-w-0 gap-1.5 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{t("look_for")}</dt>
                        <dd className="text-pretty">
                          <span className="font-medium">{idea.partner_niche}</span> — {idea.partner_kind}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{t("why")}</dt>
                        <dd className="text-pretty text-muted-foreground">{idea.why_it_fits}</dd>
                      </div>
                    </dl>
                    <div className="flex justify-end">
                      {savedId ? (
                        <Button type="button" variant="ghost" size="xs" className="text-good-fg" onClick={() => onOpenCollab(savedId)}>
                          <Check aria-hidden />
                          {t("saved_open")}
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="xs" onClick={() => save(idea)}>
                          <BookmarkPlus aria-hidden />
                          {t("save")}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        ) : ai.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <Lightbulb className="size-5 text-muted-foreground" aria-hidden />
            <p className="max-w-sm text-sm text-pretty text-muted-foreground">{t("empty")}</p>
          </div>
        )}
      </div>
    </DetailSheet>
  )
}
