import {
  Blend,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  Columns3,
  Compass,
  FileText,
  FlaskConical,
  House,
  Library,
  LifeBuoy,
  Lightbulb,
  Megaphone,
  PenLine,
  Repeat,
  Settings,
  SquareKanban,
  Trophy,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export interface NavChild {
  /** Full page name, for ⌘K and the breadcrumb ("Hook Library"). */
  title: string
  /** Short label on the module's tab row ("Hooks"). */
  tab: string
  href: string
}

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description: string
  /** Sub-pages: in-page tabs (`ModuleTabs`), never nested sidebar links. The first one is the module's own page. */
  children?: NavChild[]
  /** One of the everyday modules the sidebar keeps in Simple mode (`app_settings.simple_mode`). */
  simple?: true
  /**
   * Money (ARCHITECTURE §17): hidden from the sidebar, the phone sheet and ⌘K for a member of somebody
   * else's workspace who wasn't given Money access. The database hides the rows too.
   */
  money?: true
}

export type NavSectionKey = "start" | "plan" | "create" | "grow" | "measure" | "end"

export interface NavSection {
  key: NavSectionKey
  /** Group header; null for the unlabelled top and bottom groups. Labelled groups collapse. */
  label: string | null
  items: NavItem[]
}

/**
 * Primary navigation (Calm UI): Home and Today, four collapsible groups — Plan, Create, Grow, Measure — then
 * Money, Settings and Help. One sidebar link per module; a module's sub-pages are tabs. Every href must resolve to
 * a real page. Module, page and group names are product terms (ARCHITECTURE §9) and stay English in both UI
 * languages.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "start",
    label: null,
    items: [
      { title: "Home", href: "/", icon: House, description: "Executive dashboard", simple: true },
      { title: "Today", href: "/today", icon: CalendarCheck, description: "Daily content command center", simple: true },
    ],
  },
  {
    key: "plan",
    label: "Plan",
    items: [
      {
        title: "Brand HQ",
        href: "/strategy",
        icon: Compass,
        description: "Strategy: Brand HQ, goals, platforms and the system",
        children: [
          { title: "Brand HQ", tab: "Brand HQ", href: "/strategy" },
          { title: "Goals", tab: "Goals", href: "/strategy/goals" },
          { title: "Platforms", tab: "Platforms", href: "/strategy/platforms" },
          { title: "Flywheel & System", tab: "System", href: "/strategy/system" },
        ],
      },
      {
        title: "Audience",
        href: "/audience",
        icon: Users,
        description: "Personas, problems and questions",
        children: [
          { title: "Personas", tab: "Personas", href: "/audience" },
          { title: "Problem Bank", tab: "Problems", href: "/audience/problems" },
          { title: "Question Bank", tab: "Questions", href: "/audience/questions" },
        ],
      },
      {
        title: "Pillars",
        href: "/pillars",
        icon: Columns3,
        description: "Content pillars, matrix and funnel",
        children: [
          { title: "Content Pillars", tab: "Pillars", href: "/pillars" },
          { title: "Content Matrix", tab: "Matrix", href: "/pillars/matrix" },
          { title: "Content Funnel", tab: "Funnel", href: "/pillars/funnel" },
        ],
      },
    ],
  },
  {
    key: "create",
    label: "Create",
    items: [
      {
        title: "Ideas",
        href: "/ideas",
        icon: Lightbulb,
        description: "Idea Bank, generator, hooks and angles",
        simple: true,
        children: [
          { title: "Idea Bank", tab: "Idea Bank", href: "/ideas" },
          { title: "Idea Generator", tab: "Generator", href: "/ideas/generator" },
          { title: "Hook Library", tab: "Hooks", href: "/ideas/hooks" },
          { title: "Angle Library", tab: "Angles", href: "/ideas/angles" },
        ],
      },
      {
        title: "Content Studio",
        href: "/studio",
        icon: PenLine,
        description: "Briefs, scripts, scoring and repurposing",
        simple: true,
      },
      { title: "Pipeline", href: "/pipeline", icon: SquareKanban, description: "Production board" },
      {
        title: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        description: "Calendar, weekly planner and posting schedule",
        simple: true,
        children: [
          { title: "Calendar", tab: "Calendar", href: "/calendar" },
          { title: "Weekly Planner", tab: "Weekly Planner", href: "/calendar/planner" },
          { title: "Posting Schedule", tab: "Posting Schedule", href: "/calendar/schedule" },
        ],
      },
    ],
  },
  {
    key: "grow",
    label: "Grow",
    items: [
      { title: "Collabs", href: "/collabs", icon: Blend, description: "Creator collaborations and whether they were worth it" },
      { title: "Circles", href: "/circles", icon: UsersRound, description: "Small creator groups: weekly check-ins, streaks and collab asks" },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone, description: "Grouped content pushes" },
      { title: "Series", href: "/series", icon: Repeat, description: "Recurring content series" },
      {
        title: "Story Vault",
        href: "/stories",
        icon: BookOpen,
        description: "Stories, experiences and lessons",
        children: [
          { title: "Story Vault", tab: "Vault", href: "/stories" },
          { title: "Experience → Content", tab: "Experience → Content", href: "/stories/experience" },
        ],
      },
      {
        title: "Research",
        href: "/research",
        icon: Library,
        description: "References and inspiration",
        children: [
          { title: "Research Library", tab: "Library", href: "/research" },
          { title: "Inspiration → Original", tab: "Inspiration → Original", href: "/research/adapt" },
        ],
      },
    ],
  },
  {
    key: "measure",
    label: "Measure",
    items: [
      {
        title: "Analytics",
        href: "/analytics",
        icon: ChartColumn,
        description: "Performance and metrics logging",
        simple: true,
        children: [
          { title: "Analytics", tab: "Overview", href: "/analytics" },
          { title: "Post Performance", tab: "Posts", href: "/analytics/posts" },
        ],
      },
      { title: "Winners", href: "/winners", icon: Trophy, description: "Winning Content Library" },
      {
        title: "Reports",
        href: "/reports",
        icon: FileText,
        description: "Weekly and monthly reviews",
        children: [
          { title: "Weekly Report", tab: "Weekly", href: "/reports" },
          { title: "Monthly Review", tab: "Monthly", href: "/reports/monthly" },
        ],
      },
      { title: "Experiments", href: "/experiments", icon: FlaskConical, description: "Content experiments" },
    ],
  },
  {
    key: "end",
    label: null,
    items: [
      {
        title: "Money",
        href: "/money",
        icon: Wallet,
        description: "Brand deals, income and your media kit",
        simple: true,
        money: true,
        children: [
          { title: "Money", tab: "Overview", href: "/money" },
          { title: "Brand Deals", tab: "Deals", href: "/money/deals" },
          { title: "Income", tab: "Income", href: "/money/income" },
          { title: "Media Kit", tab: "Media Kit", href: "/money/media-kit" },
        ],
      },
      { title: "Settings", href: "/settings", icon: Settings, description: "Targets, thresholds, data and AI", simple: true },
      { title: "Help", href: "/help", icon: LifeBuoy, description: "Guides, answers and shortcuts", simple: true },
    ],
  },
]

/** Every navigable page (for the command palette) — Simple mode never hides anything here. */
export const ALL_PAGES: { title: string; href: string; section: string; money?: true }[] = NAV_SECTIONS.flatMap((section) =>
  section.items.flatMap((item) => [
    { title: item.title, href: item.href, section: section.label ?? "General", ...(item.money ? { money: true as const } : {}) },
    ...(item.children ?? [])
      .filter((c) => c.href !== item.href)
      .map((c) => ({ title: c.title, href: c.href, section: item.title, ...(item.money ? { money: true as const } : {}) })),
  ])
).concat([{ title: "Content Strategist", href: "/strategist", section: "AI" }])

/** ⌘K's pages: everything, minus Money when this person has no Money access here (ARCHITECTURE §17). */
export function commandPalettePages(moneyAccess: boolean): typeof ALL_PAGES {
  return moneyAccess ? ALL_PAGES : ALL_PAGES.filter((page) => !page.money)
}

/** Exact match for "/" ; prefix match for everything else. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The module a path belongs to (its sidebar link), or null (e.g. /strategist). */
export function navModuleFor(pathname: string): NavItem | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) if (isNavActive(pathname, item.href)) return item
  }
  return null
}

/**
 * The tab row for a path: its module's sub-pages, when it has them and the path is one of them. Detail pages
 * below a module (/campaigns/<id>, /studio/<id>) get none.
 */
export function moduleTabsFor(pathname: string): { module: NavItem; tabs: { title: string; href: string }[] } | null {
  const item = navModuleFor(pathname)
  if (!item?.children?.length || !item.children.some((child) => child.href === pathname)) return null
  return { module: item, tabs: item.children.map((child) => ({ title: child.tab, href: child.href })) }
}

/**
 * The sidebar's sections. In Simple mode only `simple` modules stay — plus the module of the page you're
 * on, so a page opened from ⌘K or a link still shows where you are. `hidden` counts the modules left out.
 */
export function sidebarSections(
  sections: NavSection[],
  { simpleMode, pathname, moneyAccess = true }: { simpleMode: boolean; pathname: string; moneyAccess?: boolean }
): { sections: NavSection[]; hidden: number } {
  // Money without access is not "hidden for now" but "not yours": it never counts towards `hidden`, and
  // Simple mode can't bring it back.
  const allowed = moneyAccess ? sections : sections.map((s) => ({ ...s, items: s.items.filter((item) => !item.money) })).filter((s) => s.items.length)
  if (!simpleMode) return { sections: allowed, hidden: 0 }
  let hidden = 0
  const visible: NavSection[] = []
  for (const section of allowed) {
    const items = section.items.filter((item) => item.simple || isNavActive(pathname, item.href))
    hidden += section.items.length - items.length
    if (items.length) visible.push({ ...section, items })
  }
  return { sections: visible, hidden }
}

/** Labelled groups the sidebar can fold. */
export const COLLAPSIBLE_GROUPS: NavSectionKey[] = NAV_SECTIONS.filter((s) => s.label).map((s) => s.key)

/** The collapsed groups remembered on this device (`pbos:sidebar:collapsed`, a comma list of keys). */
export function parseCollapsedGroups(value: string | null): Set<NavSectionKey> {
  const keys = (value ?? "").split(",").map((k) => k.trim())
  return new Set(COLLAPSIBLE_GROUPS.filter((key) => keys.includes(key)))
}

/** A folded group still shows the module you're on, so the sidebar never hides where you are. */
export function groupItems(section: NavSection, { collapsed, pathname }: { collapsed: boolean; pathname: string }): NavItem[] {
  if (!collapsed || !section.label) return section.items
  return section.items.filter((item) => isNavActive(pathname, item.href))
}
