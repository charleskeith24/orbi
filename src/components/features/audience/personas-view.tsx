"use client"

import { Crosshair, MessageCircleQuestion, Plus, Users } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader, StatTile } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import {
  isUntapped,
  linksByProblem,
  questionPriority,
  questionView,
  recentContentByPersona,
  sortPersonas,
} from "./audience-model"
import { MissingLinkNotice } from "./missing-link-notice"
import { usePersonaActions } from "./persona-actions"
import { PersonaCard, type PersonaStats } from "./persona-card"
import { PersonaCoverage } from "./persona-coverage"
import { PersonaCreateDialog } from "./persona-create-dialog"
import { PersonaSheet } from "./persona-sheet"
import { useUrlState } from "./use-url-state"

const URL_KEYS = ["open"] as const

/**
 * Audience HQ (spec §5): persona cards with their footprint in the Problem Bank, the Question Bank
 * and recent content; `?open=<personaId>` opens the profile sheet.
 */
export function PersonasView() {
  const [url, setUrl] = useUrlState(URL_KEYS)
  const personas = useTable("audience_personas")
  const problems = useTable("audience_problems")
  const questions = useTable("audience_questions")
  const ideas = useTable("content_ideas")
  const items = useTable("content_items")
  const [now] = useState(() => new Date())
  const [creating, setCreating] = useState(false)

  const sorted = useMemo(() => sortPersonas(personas), [personas])
  const share = useMemo(() => recentContentByPersona(items, now), [items, now])
  const links = useMemo(() => linksByProblem(ideas, items), [ideas, items])

  const statsById = useMemo(() => {
    const map = new Map<ID, PersonaStats>()
    for (const persona of personas) {
      map.set(persona.id, {
        problems: 0,
        untapped: 0,
        questions: 0,
        openQuestions: 0,
        content: share.counts.get(persona.id) ?? 0,
        contentTotal: share.total,
      })
    }
    for (const problem of problems) {
      const stats = problem.persona_id ? map.get(problem.persona_id) : undefined
      if (!stats) continue
      stats.problems += 1
      if (isUntapped(links.get(problem.id))) stats.untapped += 1
    }
    for (const question of questions) {
      const stats = question.persona_id ? map.get(question.persona_id) : undefined
      if (!stats) continue
      stats.questions += 1
      if (questionView(question.status) === "open") stats.openQuestions += 1
    }
    return map
  }, [personas, problems, questions, links, share])

  const banks = useMemo(() => {
    const open = questions.filter((q) => questionView(q.status) === "open")
    return {
      untapped: problems.filter((p) => isUntapped(links.get(p.id))).length,
      severe: problems.filter((p) => p.severity >= 4).length,
      open: open.length,
      highOpen: open.filter((q) => questionPriority(q.frequency) === "high").length,
    }
  }, [problems, questions, links])

  const setOpen = useCallback((id: ID | null) => setUrl({ open: id ?? "" }), [setUrl])
  const actions = usePersonaActions({
    onOpen: setOpen,
    onDeleted: (id) => {
      if (url.open === id) setOpen(null)
    },
  })

  // `?open=<id>` drives the sheet; keep the last persona mounted while the sheet animates out.
  const openPersona = url.open ? personas.find((p) => p.id === url.open) : undefined
  const [shownId, setShownId] = useState<ID | null>(openPersona ? openPersona.id : null)
  if (openPersona && openPersona.id !== shownId) setShownId(openPersona.id)
  const shownPersona = shownId ? (personas.find((p) => p.id === shownId) ?? null) : null

  return (
    <PageContainer>
      <PageHeader
        title="Audience HQ"
        description="Who you create for — their goals, problems, fears and the words they use. Every idea and piece of content should speak to one of them."
        actions={
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New persona
          </Button>
        }
      />

      {url.open && !openPersona ? <MissingLinkNotice entity="persona" onDismiss={() => setOpen(null)} /> : null}

      {sorted.length ? (
        <>
          <section aria-label="Personas" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                stats={statsById.get(persona.id) ?? EMPTY_STATS}
                actions={actions}
                onOpen={() => setOpen(persona.id)}
              />
            ))}
          </section>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3 lg:items-start">
            <PersonaCoverage className="lg:col-span-2" personas={sorted} share={share} />
            <div className="grid min-w-0 content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatTile
                label="Problem Bank"
                icon={Crosshair}
                value={formatNumber(problems.length)}
                sublabel={`${formatNumber(banks.untapped)} untapped · ${formatNumber(banks.severe)} high severity`}
                href="/audience/problems"
              />
              <StatTile
                label="Question Bank"
                icon={MessageCircleQuestion}
                value={formatNumber(questions.length)}
                sublabel={`${formatNumber(banks.open)} open · ${formatNumber(banks.highOpen)} asked 5+ times`}
                href="/audience/questions"
              />
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="Define who you create for"
          description="Personas keep every idea aimed at a real person — their goals, problems and the words they use. Start with the one you most want to reach."
          action={
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New persona
            </Button>
          }
        />
      )}

      <PersonaSheet
        persona={shownPersona}
        open={Boolean(openPersona)}
        stats={shownPersona ? statsById.get(shownPersona.id) : undefined}
        actions={actions}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
      />
      <PersonaCreateDialog open={creating} onOpenChange={setCreating} onCreated={(persona) => setOpen(persona.id)} />
      {actions.confirmDialog}
    </PageContainer>
  )
}

const EMPTY_STATS: PersonaStats = { problems: 0, untapped: 0, questions: 0, openQuestions: 0, content: 0, contentTotal: 0 }
