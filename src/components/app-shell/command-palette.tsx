"use client"

import { defaultFilter } from "cmdk"
import {
  ArrowUpDown,
  BookOpen,
  CalendarRange,
  ChartColumn,
  Columns3,
  CornerDownLeft,
  FishingHook,
  FlaskConical,
  Handshake,
  Hash,
  Library,
  Lightbulb,
  Megaphone,
  MessageCircleQuestionMark,
  Moon,
  PenLine,
  Plus,
  Repeat,
  Send,
  Shapes,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useMemo, useState, type ReactNode } from "react"
import {
  buildAnalyticsDocs,
  buildAngleDocs,
  buildCampaignDocs,
  buildContentDocs,
  buildDealDocs,
  buildExperimentDocs,
  buildHookDocs,
  buildIdeaDocs,
  buildPersonaDocs,
  buildPillarDocs,
  buildProblemDocs,
  buildQuestionDocs,
  buildResearchDocs,
  buildSeriesDocs,
  buildStoryDocs,
  buildTopicDocs,
  currentScriptBodies,
  recentDocs,
  searchScored,
  tokenize,
  type SearchDoc,
  type SearchIndex,
  type SearchKind,
} from "@/components/app-shell/command-palette/search"
import { KeyboardShortcuts, useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { ALL_PAGES, NAV_SECTIONS } from "@/lib/navigation"
import { uiActions, useTable, useUIStore } from "@/lib/store"

const SEARCH_MIN_LENGTH = 2
const RESULTS_PER_GROUP = 6
/** cmdk title score (0–1) that counts as a match on its own: word starts score ≥ 0.89, scattered letters < 0.2. */
const FUZZY_THRESHOLD = 0.3

/** Tie-break order for result groups (groups are ranked by their best hit). */
const RESULT_GROUPS: { kind: SearchKind; heading: string; icon: LucideIcon }[] = [
  { kind: "content", heading: "Content", icon: PenLine },
  { kind: "idea", heading: "Ideas", icon: Lightbulb },
  { kind: "hook", heading: "Hooks", icon: FishingHook },
  { kind: "angle", heading: "Angles", icon: Shapes },
  { kind: "story", heading: "Stories", icon: BookOpen },
  { kind: "campaign", heading: "Campaigns", icon: Megaphone },
  { kind: "series", heading: "Series", icon: Repeat },
  { kind: "pillar", heading: "Content Pillars", icon: Columns3 },
  { kind: "persona", heading: "Personas", icon: UserRound },
  { kind: "problem", heading: "Problem Bank", icon: Target },
  { kind: "question", heading: "Question Bank", icon: MessageCircleQuestionMark },
  { kind: "research", heading: "Research", icon: Library },
  { kind: "experiment", heading: "Experiments", icon: FlaskConical },
  { kind: "deal", heading: "Brand deals", icon: Handshake },
  { kind: "topic", heading: "Topics", icon: Hash },
  { kind: "analytics", heading: "Analytics", icon: TrendingUp },
]
const KIND_ICON = new Map(RESULT_GROUPS.map((group) => [group.kind, group.icon]))

interface PaletteEntry {
  id: string
  title: string
  icon: LucideIcon
  keywords: string[]
}

const PAGES: (PaletteEntry & { href: string; section: string })[] = (() => {
  const meta = new Map<string, { icon: LucideIcon; description: string }>()
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      meta.set(item.href, { icon: item.icon, description: item.description })
      for (const child of item.children ?? []) {
        if (!meta.has(child.href)) meta.set(child.href, { icon: item.icon, description: item.description })
      }
    }
  }
  return ALL_PAGES.map((page) => ({
    ...page,
    id: page.href,
    icon: meta.get(page.href)?.icon ?? Sparkles,
    keywords: [page.section, meta.get(page.href)?.description ?? ""],
  }))
})()

/**
 * cmdk's fuzzy title score (word starts, abbreviations), falling back to a contiguous title match or
 * word starts in the keywords — scattered subsequences ("ads" → "Add analytics") don't count.
 */
function entryScore(entry: PaletteEntry, query: string): number {
  const fuzzy = defaultFilter(entry.title, query)
  if (fuzzy >= FUZZY_THRESHOLD) return fuzzy
  const tokens = tokenize(query)
  if (!tokens.length) return 0
  if (tokenize(entry.title).join(" ").includes(tokens.join(" "))) return 0.25
  const words = tokenize([entry.title, ...entry.keywords].join(" ")).join(" ").split(/[^\p{L}\p{N}]+/u)
  return tokens.every((token) => words.some((word) => word.startsWith(token))) ? 0.2 : 0
}

function rankEntries<T extends PaletteEntry>(entries: T[], query: string): T[] {
  return entries
    .map((entry) => ({ entry, score: entryScore(entry, query) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.entry)
}

/** Search documents memoized per table, built only while the palette is open. */
function useSearchIndex(): SearchIndex {
  const items = useTable("content_items")
  const ideas = useTable("content_ideas")
  const hooks = useTable("hooks")
  const angles = useTable("angles")
  const stories = useTable("stories")
  const campaigns = useTable("content_campaigns")
  const seriesRows = useTable("content_series")
  const pillars = useTable("content_pillars")
  const personas = useTable("audience_personas")
  const problems = useTable("audience_problems")
  const questions = useTable("audience_questions")
  const research = useTable("research_items")
  const experiments = useTable("content_experiments")
  const deals = useTable("brand_deals")
  const scripts = useTable("content_scripts")
  const metrics = useTable("content_metrics")

  const pillarNames = useMemo(() => new Map(pillars.map((p) => [p.id, p.name])), [pillars])
  const scriptBodies = useMemo(() => currentScriptBodies(scripts), [scripts])
  const content = useMemo(() => buildContentDocs(items, pillarNames, scriptBodies), [items, pillarNames, scriptBodies])
  const idea = useMemo(() => buildIdeaDocs(ideas, pillarNames), [ideas, pillarNames])
  const hook = useMemo(() => buildHookDocs(hooks), [hooks])
  const angle = useMemo(() => buildAngleDocs(angles), [angles])
  const story = useMemo(() => buildStoryDocs(stories, pillarNames), [stories, pillarNames])
  const campaign = useMemo(() => buildCampaignDocs(campaigns), [campaigns])
  const series = useMemo(() => buildSeriesDocs(seriesRows, pillarNames), [seriesRows, pillarNames])
  const pillar = useMemo(() => buildPillarDocs(pillars), [pillars])
  const persona = useMemo(() => buildPersonaDocs(personas), [personas])
  const problem = useMemo(() => buildProblemDocs(problems), [problems])
  const question = useMemo(() => buildQuestionDocs(questions), [questions])
  const researchDocs = useMemo(() => buildResearchDocs(research), [research])
  const experiment = useMemo(() => buildExperimentDocs(experiments), [experiments])
  const deal = useMemo(() => buildDealDocs(deals), [deals])
  const topic = useMemo(() => buildTopicDocs(ideas), [ideas])
  const analytics = useMemo(() => buildAnalyticsDocs(items, metrics), [items, metrics])

  return useMemo(
    () => ({
      content,
      idea,
      hook,
      angle,
      story,
      campaign,
      series,
      pillar,
      persona,
      problem,
      question,
      research: researchDocs,
      experiment,
      deal,
      topic,
      analytics,
    }),
    [
      content,
      idea,
      hook,
      angle,
      story,
      campaign,
      series,
      pillar,
      persona,
      problem,
      question,
      researchDocs,
      experiment,
      deal,
      topic,
      analytics,
    ]
  )
}

/** Universal search and command palette (⌘K / Ctrl+K, or "/"). Also mounts the global shortcuts. */
export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)

  return (
    <>
      <KeyboardShortcuts />
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search and commands"
        description="Search your workspace, jump to a page or run a command."
        className="top-[10vh] sm:top-[14vh] sm:max-w-xl"
      >
        <PaletteContent onClose={() => setOpen(false)} />
      </CommandDialog>
    </>
  )
}

interface PaletteAction extends PaletteEntry {
  shortcut?: string
  perform: () => void
}

function PaletteContent({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const isMac = useIsMac()
  const index = useSearchIndex()
  const [query, setQuery] = useState("")

  const trimmed = query.trim()
  const tokens = useMemo(() => tokenize(trimmed), [trimmed])
  // Groups ranked by their best hit (scores are comparable across kinds); fixed order breaks ties.
  const results = useMemo(() => {
    if (trimmed.length < SEARCH_MIN_LENGTH) return []
    return RESULT_GROUPS.map((group, order) => {
      const hits = searchScored(index[group.kind], trimmed, RESULTS_PER_GROUP)
      return { ...group, order, best: hits[0]?.score ?? 0, docs: hits.map((hit) => hit.doc) }
    })
      .filter((group) => group.docs.length > 0)
      .sort((a, b) => b.best - a.best || a.order - b.order)
  }, [index, trimmed])
  const recent = useMemo(() => recentDocs([...index.content, ...index.idea], 5), [index.content, index.idea])

  const go = (href: string) => {
    router.push(href)
    onClose()
  }
  const dark = resolvedTheme === "dark"
  const actions: PaletteAction[] = [
    {
      id: "capture",
      title: "Capture idea",
      icon: Lightbulb,
      keywords: ["quick capture", "new idea", "note"],
      shortcut: isMac ? "⌥N" : "Alt N",
      perform: () => uiActions.openDialog({ type: "quick-capture" }),
    },
    {
      id: "new-content",
      title: "New content",
      icon: Plus,
      keywords: ["create", "post", "draft"],
      perform: () => uiActions.openDialog({ type: "new-content" }),
    },
    {
      id: "log-post",
      title: "Log published post",
      icon: Send,
      keywords: ["published", "record"],
      perform: () => uiActions.openDialog({ type: "log-post" }),
    },
    {
      id: "add-metrics",
      title: "Add analytics",
      icon: ChartColumn,
      keywords: ["metrics", "views", "stats", "performance", "log"],
      perform: () => uiActions.openDialog({ type: "add-metrics" }),
    },
    {
      id: "strategist",
      title: "Ask the Content Strategist",
      icon: Sparkles,
      keywords: ["ai", "assistant", "chat", "advice"],
      shortcut: isMac ? "⌘J" : "Ctrl J",
      perform: () => uiActions.askStrategist(),
    },
    {
      id: "theme",
      title: dark ? "Switch to light theme" : "Switch to dark theme",
      icon: dark ? Sun : Moon,
      keywords: ["toggle theme", "dark mode", "light mode", "appearance"],
      perform: () => {
        setTheme(dark ? "light" : "dark")
        onClose()
      },
    },
    {
      id: "planner",
      title: "Open Weekly Planner",
      icon: CalendarRange,
      keywords: ["plan the week", "calendar", "schedule"],
      perform: () => go("/calendar/planner"),
    },
  ]
  const matchedActions = trimmed ? rankEntries(actions, trimmed) : actions
  const matchedPages = trimmed ? rankEntries(PAGES, trimmed).slice(0, RESULTS_PER_GROUP) : PAGES

  const actionItem = (action: PaletteAction) => (
    <CommandItem key={action.id} value={`action:${action.id}`} onSelect={action.perform}>
      <Row icon={action.icon} title={action.title} hint={action.shortcut ? <Kbd>{action.shortcut}</Kbd> : undefined} />
    </CommandItem>
  )
  const pageItem = (page: (typeof PAGES)[number]) => (
    <CommandItem key={page.id} value={`page:${page.href}`} onSelect={() => go(page.href)}>
      <Row icon={page.icon} title={page.title} tokens={tokens} hint={page.section} />
    </CommandItem>
  )
  const docItem = (doc: SearchDoc, prefix = "") => (
    <CommandItem key={doc.key} value={`${prefix}${doc.key}`} onSelect={() => go(doc.href)}>
      <Row
        icon={KIND_ICON.get(doc.kind) ?? PenLine}
        title={doc.title}
        secondary={doc.secondary}
        hint={doc.hint}
        tokens={tokens}
      />
    </CommandItem>
  )

  return (
    <Command shouldFilter={false} loop label="Command palette">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search content, ideas, pages… or run a command"
      />
      <CommandList className="max-h-[min(55dvh,26rem)] sm:max-h-[min(60vh,28rem)]">
        {trimmed ? (
          <>
            {matchedActions.length ? <CommandGroup heading="Actions">{matchedActions.map(actionItem)}</CommandGroup> : null}
            {matchedPages.length ? <CommandGroup heading="Pages">{matchedPages.map(pageItem)}</CommandGroup> : null}
            {results.map((group) => (
              <CommandGroup key={group.kind} heading={group.heading}>
                {group.docs.map((doc) => docItem(doc))}
              </CommandGroup>
            ))}
            <CommandGroup heading="Capture or ask">
              <CommandItem
                value="query:capture"
                onSelect={() => uiActions.openDialog({ type: "quick-capture", initialText: trimmed })}
              >
                <Row icon={Lightbulb} title={`Capture “${trimmed}” as an idea`} />
              </CommandItem>
              <CommandItem value="query:ask" onSelect={() => uiActions.askStrategist(trimmed)}>
                <Row icon={Sparkles} title={`Ask the Content Strategist: “${trimmed}”`} />
              </CommandItem>
            </CommandGroup>
          </>
        ) : (
          <>
            <CommandGroup heading="Actions">{actions.map(actionItem)}</CommandGroup>
            {recent.length ? <CommandGroup heading="Recent">{recent.map((doc) => docItem(doc, "recent:"))}</CommandGroup> : null}
            <CommandGroup heading="Pages">{PAGES.map(pageItem)}</CommandGroup>
          </>
        )}
      </CommandList>
      <div className="-mx-1 mt-1 -mb-1 flex items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Kbd>
            <ArrowUpDown />
          </Kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>
            <CornerDownLeft />
          </Kbd>
          Open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          Close
        </span>
        <span className="ml-auto hidden items-center gap-1.5 sm:flex">
          <Kbd>/</Kbd>
          or
          <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
          from anywhere
        </span>
      </div>
    </Command>
  )
}

function Row({
  icon: Icon,
  title,
  secondary,
  hint,
  tokens,
}: {
  icon: LucideIcon
  title: string
  secondary?: string
  hint?: ReactNode
  tokens?: string[]
}) {
  return (
    <>
      <Icon className="text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{tokens?.length ? <Highlight text={title} tokens={tokens} /> : title}</span>
        {secondary ? <span className="truncate text-xs text-muted-foreground">{secondary}</span> : null}
      </span>
      {hint ? <CommandShortcut className="max-w-40 truncate tracking-normal">{hint}</CommandShortcut> : null}
    </>
  )
}

/** Emphasizes the query tokens inside a title. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const lower = text.toLowerCase()
  if (lower.length !== text.length) return text
  const hits = new Array<boolean>(text.length).fill(false)
  for (const token of tokens) {
    for (let i = lower.indexOf(token); i !== -1; i = lower.indexOf(token, i + token.length)) {
      hits.fill(true, i, i + token.length)
    }
  }
  if (!hits.includes(true)) return text
  const parts: { text: string; hit: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1]
    if (last && last.hit === hits[i]) last.text += text[i]
    else parts.push({ text: text[i], hit: hits[i] })
  }
  return parts.map((part, i) =>
    part.hit ? (
      <mark key={i} className="bg-transparent font-semibold text-foreground">
        {part.text}
      </mark>
    ) : (
      <span key={i}>{part.text}</span>
    )
  )
}
