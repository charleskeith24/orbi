"use client"

import { ArrowRight, ChevronRight, Plus, Undo2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { AiButton, Disclosure, ProviderBadge, SectionCard } from "@/components/common"
import { AiErrorNotice } from "@/components/features/capture/ai-error-notice"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { whatToPostMessages } from "./messages"
import { extraSignals } from "./suggestion"
import {
  Alternatives,
  CreateButton,
  EditableLine,
  HookQuote,
  NoSuggestions,
  OpenIdeaButton,
  ReasonLine,
  ScoreToken,
  SignalList,
  SuggestionMeta,
  WhyList,
} from "./suggestion-parts"
import { useWhatToPost, type WhatToPostState } from "./use-what-to-post"

// "What should I post?" Content Decision Engine (spec §38), used by the Home dashboard and the Today page.
// Props are a contract used by the Home dashboard and the Today page — do not change them.
export interface WhatToPostProps {
  /** 'card' = compact dashboard card, 'full' = detailed Today section. */
  variant?: "card" | "full"
  className?: string
}

/**
 * Today's best content from the deterministic ranking (recommendNextContent), with plain-language
 * reasons for topic, platform, format and angle. "Refine with AI" re-ranks it with what_to_post.
 */
export function WhatToPost({ variant = "card", className }: WhatToPostProps) {
  const state = useWhatToPost()
  return variant === "full" ? <FullView state={state} className={className} /> : <CardView state={state} className={className} />
}

function RefineButton({ state }: { state: WhatToPostState }) {
  const t = useT(whatToPostMessages)
  if (!state.canRefine) return null
  return (
    <AiButton size="sm" pending={state.ai.isPending} pendingLabel={t("refining")} onClick={() => void state.refine()}>
      {state.mode === "ai" ? t("refine_again") : t("refine_ai")}
    </AiButton>
  )
}

function AiError({ state }: { state: WhatToPostState }) {
  const t = useT(whatToPostMessages)
  if (!state.ai.error) return null
  return <AiErrorNotice title={t("couldnt_refine")} message={state.ai.error.message} onRetry={() => void state.refine()} />
}

/* --------------------------------- Card ---------------------------------- */

function CardView({ state, className }: { state: WhatToPostState; className?: string }) {
  const t = useT(whatToPostMessages)
  const s = state.current
  const total = state.list.length
  const provider = state.mode === "ai" ? state.ai.provider : null
  return (
    <SectionCard
      title={t("card_title")}
      info={t("full_info")}
      className={className}
      contentClassName="flex flex-col gap-3"
      action={
        total > 1 ? (
          <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={state.next} aria-label={t("next_suggestion")}>
            <span className="num">
              {state.position + 1}/{total}
            </span>
            <ChevronRight aria-hidden />
          </Button>
        ) : null
      }
    >
      {s ? (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h4 className="text-sm leading-snug font-medium text-pretty">{s.title}</h4>
            <SuggestionMeta s={s} />
            {provider ? <ProviderBadge provider={provider} model={state.ai.model ?? undefined} /> : null}
          </div>
          {s.hook ? <HookQuote text={s.hook} /> : null}
          <ReasonLine text={s.reasons.topic} />
          <AiError state={state} />
          <div className="flex flex-wrap items-center gap-2">
            <CreateButton s={s} onCreate={() => state.create(s)} />
            <RefineButton state={state} />
            {s.ideaId ? <OpenIdeaButton ideaId={s.ideaId} size="xs" className="ml-auto" /> : null}
          </div>
        </>
      ) : (
        <NoSuggestions />
      )}
    </SectionCard>
  )
}

/* --------------------------------- Full ---------------------------------- */

/** The CTA line: shown when there is one; otherwise a quiet "+ CTA" that opens the editor. */
function CtaLine({ value, edited, onSave }: { value: string; edited: boolean; onSave: (value: string) => void }) {
  const t = useT(whatToPostMessages)
  const [adding, setAdding] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // "+ CTA" goes straight into editing: open the click-to-edit field it reveals.
  useEffect(() => {
    if (adding) ref.current?.querySelector<HTMLButtonElement>("button")?.click()
  }, [adding])
  if (!value.trim() && !edited && !adding) {
    return (
      <Button type="button" variant="ghost" size="xs" className="-ml-2 self-start text-muted-foreground" onClick={() => setAdding(true)}>
        <Plus aria-hidden />
        {t("cta")}
      </Button>
    )
  }
  return (
    <div ref={ref} className="min-w-0">
      <EditableLine label={t("cta")} value={value} placeholder={t("cta_placeholder")} edited={edited} onSave={onSave} />
    </div>
  )
}

/**
 * Today's "Suggested Content" (Calm UI): the pick, its hook and CTA (click to edit), one reason, and the rest —
 * the four reasons, supporting signals, score breakdown and the other options — behind "Why this?" and
 * "Alternatives". The ranking's explanation is the title's ⓘ.
 */
function FullView({ state, className }: { state: WhatToPostState; className?: string }) {
  const t = useT(whatToPostMessages)
  const s = state.current
  const total = state.list.length
  const hook = state.edit?.hook ?? s?.hook ?? ""
  const cta = state.edit?.cta ?? s?.cta ?? ""
  const signals = s ? extraSignals(s) : []
  return (
    <SectionCard
      title={t("full_title")}
      info={t("full_info")}
      className={className}
      contentClassName="flex flex-col gap-3"
      action={
        s ? (
          <>
            {state.mode === "ai" ? (
              <Button type="button" size="xs" variant="ghost" className="text-muted-foreground" onClick={state.showEngine}>
                <Undo2 aria-hidden />
                <span className="max-sm:sr-only">{t("engine_ranking")}</span>
              </Button>
            ) : null}
            <RefineButton state={state} />
          </>
        ) : null
      }
    >
      {s ? (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h4 className="text-base leading-snug font-semibold text-pretty">{s.title}</h4>
            <SuggestionMeta s={s} />
            {s.kind === "item" || (state.mode === "ai" && state.ai.provider) ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {s.kind === "item" ? <span>{t("in_pipeline")}</span> : null}
                {state.mode === "ai" && state.ai.provider ? <ProviderBadge provider={state.ai.provider} model={state.ai.model ?? undefined} /> : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2" key={`${state.mode}:${s.key}`}>
            <EditableLine
              label={t("hook")}
              value={hook}
              placeholder={t("hook_placeholder")}
              edited={state.edit?.hook !== undefined}
              onSave={(value) => state.updateEdit({ hook: value })}
            />
            <CtaLine value={cta} edited={state.edit?.cta !== undefined} onSave={(value) => state.updateEdit({ cta: value })} />
          </div>

          <ReasonLine text={s.reasons.topic} />
          <Disclosure label={t("why_this")} contentClassName="flex flex-col items-start gap-2.5">
            <ScoreToken s={s} />
            <WhyList s={s} />
            <SignalList signals={signals} />
          </Disclosure>
          <AiError state={state} />

          <div className="flex flex-wrap items-center gap-2">
            <CreateButton s={s} onCreate={() => state.create(s)} />
            {total > 1 ? (
              <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={state.next} aria-label={t("next_suggestion")}>
                <span className="num">{`${state.position + 1}/${total}`}</span>
                <ArrowRight aria-hidden />
              </Button>
            ) : null}
            <OpenIdeaButton ideaId={s.ideaId} className="ml-auto" />
          </div>

          {total > 1 ? (
            <Disclosure label={t("alternatives")} meta={<span className="num">{total - 1}</span>} className="border-t pt-2">
              <Alternatives list={state.list} position={state.position} onSelect={state.select} />
            </Disclosure>
          ) : null}
        </>
      ) : (
        <NoSuggestions />
      )}
    </SectionCard>
  )
}
