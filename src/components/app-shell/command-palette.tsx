"use client"

import { defaultFilter } from "cmdk"
import {
  ArrowUpDown,
  Blend,
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
  ShieldCheck,
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
  buildCollabDocs,
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
import { paletteMessages } from "@/components/app-shell/command-palette-messages"
import { KeyboardShortcuts, useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import { useIsAdmin } from "@/components/features/admin/use-is-admin"
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
import { translator, useT, useUiLang, type UiLang } from "@/lib/i18n"
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
  { kind: "collab", heading: "Collabs", icon: Blend },
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
function useSearchIndex(lang: UiLang): SearchIndex {
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
  const collabRows = useTable("collabs")
  const scripts = useTable("content_scripts")
  const metrics = useTable("content_metrics")

  const pillarNames = useMemo(() => new Map(pillars.map((p) => [p.id, p.name])), [pillars])
  const scriptBodies = useMemo(() => currentScriptBodies(scripts), [scripts])
  const content = useMemo(() => buildContentDocs(items, pillarNames, scriptBodies, lang), [items, pillarNames, scriptBodies, lang])
  const idea = useMemo(() => buildIdeaDocs(ideas, pillarNames, lang), [ideas, pillarNames, lang])
  const hook = useMemo(() => buildHookDocs(hooks, lang), [hooks, lang])
  const angle = useMemo(() => buildAngleDocs(angles, lang), [angles, lang])
  const story = useMemo(() => buildStoryDocs(stories, pillarNames, lang), [stories, pillarNames, lang])
  const campaign = useMemo(() => buildCampaignDocs(campaigns, lang), [campaigns, lang])
  const series = useMemo(() => buildSeriesDocs(seriesRows, pillarNames, lang), [seriesRows, pillarNames, lang])
  const pillar = useMemo(() => buildPillarDocs(pillars, lang), [pillars, lang])
  const persona = useMemo(() => buildPersonaDocs(personas, lang), [personas, lang])
  const problem = useMemo(() => buildProblemDocs(problems, lang), [problems, lang])
  const question = useMemo(() => buildQuestionDocs(questions, lang), [questions, lang])
  const researchDocs = useMemo(() => buildResearchDocs(research, lang), [research, lang])
  const experiment = useMemo(() => buildExperimentDocs(experiments, lang), [experiments, lang])
  const deal = useMemo(() => buildDealDocs(deals, lang), [deals, lang])
  const collab = useMemo(() => buildCollabDocs(collabRows, lang), [collabRows, lang])
  const topic = useMemo(() => buildTopicDocs(ideas, lang), [ideas, lang])
  const analytics = useMemo(() => buildAnalyticsDocs(items, metrics, lang), [items, metrics, lang])

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
      collab,
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
      collab,
      topic,
      analytics,
    ]
  )
}

/** Universal search and command palette (⌘K / Ctrl+K, or "/"). Also mounts the global shortcuts. */
export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  const t = useT(paletteMessages)

  return (
    <>
      <KeyboardShortcuts />
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("dialog_title")}
        description={t("dialog_description")}
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
  const lang = useUiLang()
  const t = useT(paletteMessages)
  const index = useSearchIndex(lang)
  const isAdmin = useIsAdmin()
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
  // Translated titles keep the English title as a keyword, so English searches still find the action.
  const en = translator(paletteMessages, "en")
  const titled = (key: Parameters<typeof t>[0], keywords: string[]) => ({
    title: t(key),
    keywords: lang === "en" ? keywords : [en(key), ...keywords],
  })
  const actions: PaletteAction[] = [
    {
      id: "capture",
      ...titled("action_capture", ["quick capture", "new idea", "note"]),
      icon: Lightbulb,
      shortcut: isMac ? "⌥N" : "Alt N",
      perform: () => uiActions.openDialog({ type: "quick-capture" }),
    },
    {
      id: "new-content",
      ...titled("action_new_content", ["create", "post", "draft"]),
      icon: Plus,
      perform: () => uiActions.openDialog({ type: "new-content" }),
    },
    {
      id: "log-post",
      ...titled("action_log_post", ["published", "record"]),
      icon: Send,
      perform: () => uiActions.openDialog({ type: "log-post" }),
    },
    {
      id: "add-metrics",
      ...titled("action_add_metrics", ["metrics", "views", "stats", "performance", "log"]),
      icon: ChartColumn,
      perform: () => uiActions.openDialog({ type: "add-metrics" }),
    },
    {
      id: "strategist",
      ...titled("action_strategist", ["ai", "assistant", "chat", "advice"]),
      icon: Sparkles,
      shortcut: isMac ? "⌘J" : "Ctrl J",
      perform: () => uiActions.askStrategist(),
    },
    {
      id: "theme",
      ...titled(dark ? "action_light" : "action_dark", ["toggle theme", "dark mode", "light mode", "appearance"]),
      icon: dark ? Sun : Moon,
      perform: () => {
        setTheme(dark ? "light" : "dark")
        onClose()
      },
    },
    {
      id: "planner",
      ...titled("action_planner", ["plan the week", "calendar", "schedule"]),
      icon: CalendarRange,
      perform: () => go("/calendar/planner"),
    },
    // Admins only (online version) — never part of the pages everyone sees.
    ...(isAdmin
      ? [
          {
            id: "admin",
            ...titled("action_admin", ["admin", "users", "access requests", "waitlist", "feedback", "audit log"]),
            icon: ShieldCheck,
            perform: () => go("/admin"),
          },
        ]
      : []),
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
    <Command shouldFilter={false} loop label={t("palette_label")}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("placeholder")}
      />
      <CommandList className="max-h-[min(55dvh,26rem)] sm:max-h-[min(60vh,28rem)]">
        {trimmed ? (
          <>
            {matchedActions.length ? <CommandGroup heading={t("group_actions")}>{matchedActions.map(actionItem)}</CommandGroup> : null}
            {matchedPages.length ? <CommandGroup heading={t("group_pages")}>{matchedPages.map(pageItem)}</CommandGroup> : null}
            {results.map((group) => (
              <CommandGroup key={group.kind} heading={group.heading}>
                {group.docs.map((doc) => docItem(doc))}
              </CommandGroup>
            ))}
            <CommandGroup heading={t("group_capture")}>
              <CommandItem
                value="query:capture"
                onSelect={() => uiActions.openDialog({ type: "quick-capture", initialText: trimmed })}
              >
                <Row icon={Lightbulb} title={t("capture_query", { query: trimmed })} />
              </CommandItem>
              <CommandItem value="query:ask" onSelect={() => uiActions.askStrategist(trimmed)}>
                <Row icon={Sparkles} title={t("ask_query", { query: trimmed })} />
              </CommandItem>
            </CommandGroup>
          </>
        ) : (
          <>
            <CommandGroup heading={t("group_actions")}>{actions.map(actionItem)}</CommandGroup>
            {recent.length ? <CommandGroup heading={t("group_recent")}>{recent.map((doc) => docItem(doc, "recent:"))}</CommandGroup> : null}
            <CommandGroup heading={t("group_pages")}>{PAGES.map(pageItem)}</CommandGroup>
          </>
        )}
      </CommandList>
      <div className="-mx-1 mt-1 -mb-1 flex items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Kbd>
            <ArrowUpDown />
          </Kbd>
          {t("hint_navigate")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>
            <CornerDownLeft />
          </Kbd>
          {t("hint_open")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          {t("hint_close")}
        </span>
        <span className="ml-auto hidden items-center gap-1.5 sm:flex">
          <Kbd>/</Kbd>
          {t("hint_or")}
          <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
          {t("hint_anywhere")}
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
