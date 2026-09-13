"use client"

import { ArrowRight, ChevronRight, Undo2 } from "lucide-react"
import { AiButton, ProviderBadge, SectionCard } from "@/components/common"
import { AiErrorNotice } from "@/components/features/capture/ai-error-notice"
import { Button } from "@/components/ui/button"
import { extraSignals } from "./suggestion"
import {
  Alternatives,
  CreateButton,
  EditableLine,
  HookQuote,
  NoSuggestions,
  OpenIdeaButton,
  ReasonLine,
  SignalList,
  SuggestionEyebrow,
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
  if (!state.canRefine) return null
  return (
    <AiButton size="sm" pending={state.ai.isPending} pendingLabel="Refining…" onClick={() => void state.refine()}>
      {state.mode === "ai" ? "Refine again" : "Refine with AI"}
    </AiButton>
  )
}

function AiError({ state }: { state: WhatToPostState }) {
  if (!state.ai.error) return null
  return <AiErrorNotice title="Couldn't refine" message={state.ai.error.message} onRetry={() => void state.refine()} />
}

/* --------------------------------- Card ---------------------------------- */

function CardView({ state, className }: { state: WhatToPostState; className?: string }) {
  const s = state.current
  const total = state.list.length
  const provider = state.mode === "ai" ? state.ai.provider : null
  return (
    <SectionCard
      title="What to post next"
      description={
        provider ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Refined with AI from the engine&apos;s ranking
            <ProviderBadge provider={provider} model={state.ai.model ?? undefined} />
          </span>
        ) : (
          "Ranked by the Content Decision Engine"
        )
      }
      className={className}
      contentClassName="flex flex-col gap-3"
      action={
        total > 1 ? (
          <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={state.next} aria-label="Next suggestion">
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
            <SuggestionEyebrow
              s={s}
              position={state.position}
              total={total}
              action={s.ideaId ? <OpenIdeaButton ideaId={s.ideaId} size="xs" /> : undefined}
            />
            <h4 className="text-sm leading-snug font-medium text-pretty">{s.title}</h4>
            <SuggestionMeta s={s} />
          </div>
          {s.hook ? <HookQuote text={s.hook} /> : null}
          <ReasonLine text={s.reasons.topic} />
          <AiError state={state} />
          <div className="flex flex-wrap items-center gap-2">
            <CreateButton s={s} onCreate={() => state.create(s)} />
            <RefineButton state={state} />
          </div>
        </>
      ) : (
        <NoSuggestions />
      )}
    </SectionCard>
  )
}

/* --------------------------------- Full ---------------------------------- */

function FullView({ state, className }: { state: WhatToPostState; className?: string }) {
  const s = state.current
  const total = state.list.length
  const hook = state.edit?.hook ?? s?.hook ?? ""
  const cta = state.edit?.cta ?? s?.cta ?? ""
  return (
    <SectionCard
      title="Suggested Content"
      description="What to create next, ranked from pillar gaps, today's slot, audience demand, winners and platform fit."
      className={className}
      contentClassName="flex flex-col gap-4"
      action={
        s ? (
          <>
            {state.mode === "ai" ? (
              <Button type="button" size="xs" variant="ghost" className="text-muted-foreground" onClick={state.showEngine}>
                <Undo2 aria-hidden />
                <span className="max-sm:sr-only">Engine ranking</span>
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
            <SuggestionEyebrow
              s={s}
              position={state.position}
              total={total}
              action={
                state.mode === "ai" && state.ai.provider ? (
                  <ProviderBadge provider={state.ai.provider} model={state.ai.model ?? undefined} />
                ) : undefined
              }
            />
            <h4 className="text-base leading-snug font-semibold text-pretty">{s.title}</h4>
            <SuggestionMeta s={s} />
          </div>

          <div className="flex flex-col gap-2.5" key={`${state.mode}:${s.key}`}>
            <EditableLine
              label="Hook"
              value={hook}
              placeholder="Add a hook"
              edited={state.edit?.hook !== undefined}
              onSave={(value) => state.updateEdit({ hook: value })}
            />
            <EditableLine
              label="CTA"
              value={cta}
              placeholder="Add a call to action"
              edited={state.edit?.cta !== undefined}
              onSave={(value) => state.updateEdit({ cta: value })}
            />
          </div>

          <WhyList s={s} />
          <SignalList signals={extraSignals(s)} />
          <AiError state={state} />

          <div className="flex flex-wrap items-center gap-2">
            <CreateButton s={s} onCreate={() => state.create(s)} />
            <Button type="button" size="sm" variant="outline" onClick={state.next} disabled={total < 2}>
              Next suggestion
              <ArrowRight aria-hidden />
            </Button>
            <OpenIdeaButton ideaId={s.ideaId} />
          </div>

          <Alternatives list={state.list} position={state.position} onSelect={state.select} />
        </>
      ) : (
        <NoSuggestions />
      )}
    </SectionCard>
  )
}
