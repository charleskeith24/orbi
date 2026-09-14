"use client"

import { Crosshair, Lightbulb, Plus, SearchX } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  chipVariants,
  ColorDot,
  EmptyState,
  FacetFilter,
  FilterBar,
  PageContainer,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  StatTile,
  type FacetOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PROBLEM_CATEGORIES, PROBLEM_CATEGORY_MAP } from "@/lib/constants"
import { useTable } from "@/lib/store"
import type { AudienceProblem, ID } from "@/lib/types"
import { formatNumber, formatPercent, matchesQuery, pluralize, truncate } from "@/lib/utils"
import {
  clampSeverity,
  isProblemCategory,
  isUntapped,
  linksByProblem,
  NO_LINKS,
  NONE,
  parseIdList,
  SEVERITY_LEVELS,
  sortPersonas,
  sortProblems,
} from "./audience-model"
import { MissingLinkNotice } from "./missing-link-notice"
import { useProblemActions } from "./problem-actions"
import { ProblemFormDialog, type ProblemDefaults } from "./problem-form-dialog"
import { ProblemGroups, type ProblemGroup } from "./problem-list"
import { ProblemSheet } from "./problem-sheet"
import { useUrlState } from "./use-url-state"

const URL_KEYS = ["open", "tab", "q", "persona", "pillar", "severity", "untapped", "new"] as const
const ALL = "all"
const SEVERITY_VALUES = new Set(["1", "2", "3", "4", "5"])

function TabCount({ value }: { value: number }) {
  return <span className="text-xs font-normal text-muted-foreground num">{formatNumber(value)}</span>
}

/**
 * Problem Bank (spec §5, principle 4): audience problems by category with persona / pillar /
 * severity filters; each becomes an idea directly or through the Idea Generator.
 * URL: `?tab=<category>`, `?q=`, `?persona=`, `?pillar=`, `?severity=` (comma lists), `?untapped=1`,
 * `?new=1` (add dialog) and `?open=<problemId>`.
 */
export function ProblemBankView() {
  const [url, update] = useUrlState(URL_KEYS)
  const problems = useTable("audience_problems")
  const ideas = useTable("content_ideas")
  const items = useTable("content_items")
  const personas = useTable("audience_personas")
  const pillars = useTable("content_pillars")

  const personaById = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])
  const pillarById = useMemo(() => new Map(pillars.map((p) => [p.id, p])), [pillars])
  const links = useMemo(() => linksByProblem(ideas, items), [ideas, items])

  const tab = isProblemCategory(url.tab) ? url.tab : ALL
  const personaFilter = useMemo(
    () => parseIdList(url.persona).filter((id) => id === NONE || personaById.has(id)),
    [url.persona, personaById]
  )
  const pillarFilter = useMemo(
    () => parseIdList(url.pillar).filter((id) => id === NONE || pillarById.has(id)),
    [url.pillar, pillarById]
  )
  const severityFilter = useMemo(() => parseIdList(url.severity).filter((v) => SEVERITY_VALUES.has(v)), [url.severity])
  const untappedOnly = url.untapped === "1"
  const filtering = Boolean(url.q.trim() || personaFilter.length || pillarFilter.length || severityFilter.length || untappedOnly)

  // Every filter except the category tab, so each tab can show how many problems match.
  const filtered = useMemo(
    () =>
      problems.filter((problem) => {
        if (personaFilter.length && !personaFilter.includes(problem.persona_id ?? NONE)) return false
        if (pillarFilter.length && !pillarFilter.includes(problem.pillar_id ?? NONE)) return false
        if (severityFilter.length && !severityFilter.includes(String(clampSeverity(problem.severity)))) return false
        if (untappedOnly && !isUntapped(links.get(problem.id))) return false
        const persona = problem.persona_id ? personaById.get(problem.persona_id) : undefined
        const pillar = problem.pillar_id ? pillarById.get(problem.pillar_id) : undefined
        return matchesQuery(url.q, problem.problem, problem.notes, persona?.name, pillar?.name, PROBLEM_CATEGORY_MAP[problem.category]?.label)
      }),
    [problems, personaFilter, pillarFilter, severityFilter, untappedOnly, links, personaById, pillarById, url.q]
  )

  const tabCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const problem of filtered) counts.set(problem.category, (counts.get(problem.category) ?? 0) + 1)
    return counts
  }, [filtered])

  const groups = useMemo<ProblemGroup[]>(
    () =>
      PROBLEM_CATEGORIES.filter((c) => tab === ALL || c.id === tab)
        .map((c) => ({ category: c.id, problems: sortProblems(filtered.filter((p) => p.category === c.id), links) }))
        .filter((group) => group.problems.length > 0),
    [filtered, links, tab]
  )
  const visibleCount = groups.reduce((acc, group) => acc + group.problems.length, 0)

  const stats = useMemo(() => {
    const severe = problems.filter((p) => clampSeverity(p.severity) >= 4)
    return {
      untapped: problems.filter((p) => isUntapped(links.get(p.id))).length,
      severe: severe.length,
      severeUntapped: severe.filter((p) => isUntapped(links.get(p.id))).length,
      addressed: problems.filter((p) => (links.get(p.id)?.items.length ?? 0) > 0).length,
      personas: new Set(problems.map((p) => p.persona_id).filter(Boolean)).size,
      categories: new Set(problems.map((p) => p.category)).size,
    }
  }, [problems, links])

  const facets = useMemo(() => {
    const count = (match: (p: AudienceProblem) => boolean) => problems.filter(match).length
    const persona: FacetOption[] = [
      ...sortPersonas(personas).map((p) => ({
        value: p.id,
        label: p.name || "Untitled persona",
        count: count((x) => x.persona_id === p.id),
        icon: <ColorDot color={p.color} />,
      })),
      { value: NONE, label: "No persona", count: count((x) => !x.persona_id) },
    ]
    const pillar: FacetOption[] = [
      ...pillars
        .filter((p) => p.is_active || problems.some((x) => x.pillar_id === p.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          value: p.id,
          label: p.name || "Untitled pillar",
          count: count((x) => x.pillar_id === p.id),
          icon: <ColorDot color={p.color} />,
        })),
      { value: NONE, label: "No pillar", count: count((x) => !x.pillar_id) },
    ]
    const severity: FacetOption[] = [...SEVERITY_LEVELS].reverse().map((s) => ({
      value: String(s.value),
      label: `${s.value} · ${s.label}`,
      count: count((x) => clampSeverity(x.severity) === s.value),
    }))
    return { persona, pillar, severity }
  }, [problems, personas, pillars])

  const setOpen = useCallback((id: ID | null) => update({ open: id ?? "" }), [update])
  const actions = useProblemActions({
    onOpen: setOpen,
    onDeleted: (id) => {
      if (url.open === id) setOpen(null)
    },
  })

  // `?open=<id>` drives the sheet; keep the last problem mounted while the sheet animates out.
  const openProblem = url.open ? problems.find((p) => p.id === url.open) : undefined
  const [shownId, setShownId] = useState<ID | null>(openProblem ? openProblem.id : null)
  if (openProblem && openProblem.id !== shownId) setShownId(openProblem.id)
  const shownProblem = shownId ? (problems.find((p) => p.id === shownId) ?? null) : null

  const single = (values: string[]) => (values.length === 1 && values[0] !== NONE ? values[0] : null)
  const defaults: ProblemDefaults = {
    category: tab === ALL ? "beginner" : tab,
    persona_id: single(personaFilter),
    pillar_id: single(pillarFilter),
  }
  const resetFilters = () => update({ q: "", persona: "", pillar: "", severity: "", untapped: "" })

  function onCreated(problem: AudienceProblem) {
    update({ new: "" })
    toast.success("Problem added to the bank", {
      description: truncate(problem.problem, 80),
      action: { label: "Open", onClick: () => setOpen(problem.id) },
    })
  }

  const hiddenInOtherTabs = filtered.length - visibleCount
  const tabLabel = tab === ALL ? "" : (PROBLEM_CATEGORY_MAP[tab]?.label ?? "")
  const emptyList =
    tab !== ALL && hiddenInOtherTabs > 0 ? (
      <EmptyState
        compact
        icon={SearchX}
        title={`No ${tabLabel.toLowerCase()} problems match`}
        description={`${pluralize(hiddenInOtherTabs, "matching problem")} in other categories.`}
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => update({ tab: "" })}>
            Show all categories
          </Button>
        }
        className="rounded-lg border bg-card"
      />
    ) : filtering ? (
      <EmptyState
        compact
        icon={SearchX}
        title="No problems match"
        description="Try a different search or fewer filters."
        action={
          <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
            Reset filters
          </Button>
        }
        className="rounded-lg border bg-card"
      />
    ) : (
      <EmptyState
        compact
        icon={Crosshair}
        title={`No ${tabLabel.toLowerCase()} problems yet`}
        description="Add the ones your audience mentions — each can become a content idea."
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => update({ new: "1" })}>
            <Plus aria-hidden />
            Add problem
          </Button>
        }
        className="rounded-lg border bg-card"
      />
    )

  return (
    <PageContainer>
      <PageHeader
        title="Problem Bank"
        description="What your audience struggles with, by category and severity. Each problem can become a content idea — start with the severe ones nothing addresses yet."
        actions={
          <Button type="button" size="sm" onClick={() => update({ new: "1" })}>
            <Plus aria-hidden />
            Add problem
          </Button>
        }
      />

      {url.open && !openProblem ? <MissingLinkNotice entity="problem" onDismiss={() => setOpen(null)} /> : null}

      {problems.length ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Problems"
              value={formatNumber(problems.length)}
              sublabel={`${pluralize(stats.personas, "persona")} · ${pluralize(stats.categories, "category", "categories")}`}
            />
            <StatTile
              label="Untapped"
              icon={Lightbulb}
              value={formatNumber(stats.untapped)}
              sublabel="No idea or content yet"
              href="/audience/problems?untapped=1"
            />
            <StatTile
              label="Severity 4–5"
              value={formatNumber(stats.severe)}
              sublabel={`${formatNumber(stats.severeUntapped)} of them untapped`}
              href="/audience/problems?severity=4,5"
            />
            <StatTile
              label="Addressed in content"
              value={formatNumber(stats.addressed)}
              sublabel={`${formatPercent((stats.addressed / problems.length) * 100, 0)} of the bank`}
            />
          </div>

          <Tabs
            value={tab}
            onValueChange={(next) => update({ tab: next === ALL ? "" : next })}
            className="min-w-0 gap-3"
          >
            <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
              <TabsList variant="line" aria-label="Problem categories">
                <TabsTrigger value={ALL} className="flex-none">
                  All <TabCount value={filtered.length} />
                </TabsTrigger>
                {PROBLEM_CATEGORIES.map((category) => (
                  <TabsTrigger key={category.id} value={category.id} className="flex-none">
                    {category.label} <TabCount value={tabCounts.get(category.id) ?? 0} />
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num" aria-live="polite">
                  {visibleCount === problems.length
                    ? pluralize(problems.length, "problem")
                    : `${formatNumber(visibleCount)} of ${pluralize(problems.length, "problem")}`}
                </span>
              }
            >
              <SearchInput value={url.q} onChange={(q) => update({ q })} placeholder="Search problems…" />
              <FacetFilter title="Persona" options={facets.persona} value={personaFilter} onChange={(v) => update({ persona: v.join(",") })} />
              <FacetFilter title="Pillar" options={facets.pillar} value={pillarFilter} onChange={(v) => update({ pillar: v.join(",") })} />
              <FacetFilter title="Severity" options={facets.severity} value={severityFilter} onChange={(v) => update({ severity: v.join(",") })} />
              <button
                type="button"
                aria-pressed={untappedOnly}
                onClick={() => update({ untapped: untappedOnly ? "" : "1" })}
                className={chipVariants({ size: "sm", selected: untappedOnly })}
              >
                <Lightbulb aria-hidden />
                Untapped only
              </button>
              <ResetFiltersButton show={filtering} onClick={resetFilters} />
            </FilterBar>

            <TabsContent value={tab} className="min-w-0">
              {groups.length ? (
                <ProblemGroups
                  groups={groups}
                  showHeaders={tab === ALL}
                  links={links}
                  personas={personaById}
                  pillars={pillarById}
                  actions={actions}
                />
              ) : (
                emptyList
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EmptyState
          icon={Crosshair}
          title="Your Problem Bank is empty"
          description="List what your audience struggles with, in their words. Each problem can become a content idea — the Idea Generator can turn one into several."
          action={
            <Button type="button" size="sm" onClick={() => update({ new: "1" })}>
              <Plus aria-hidden />
              Add problem
            </Button>
          }
        />
      )}

      <ProblemSheet
        problem={shownProblem}
        open={Boolean(openProblem)}
        links={(shownProblem && links.get(shownProblem.id)) || NO_LINKS}
        actions={actions}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
      />
      <ProblemFormDialog
        open={url.new === "1"}
        defaults={defaults}
        onOpenChange={(next) => update({ new: next ? "1" : "" })}
        onCreated={onCreated}
      />
      {actions.confirmDialog}
    </PageContainer>
  )
}
