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
  title: string
  href: string
}

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description: string
  children?: NavChild[]
  /** One of the everyday modules the sidebar keeps in Simple mode (`app_settings.simple_mode`). */
  simple?: true
}

export interface NavSection {
  label: string | null
  items: NavItem[]
}

/**
 * Primary navigation (spec §45). Every href here must resolve to a real page. Module and page names are
 * product terms (ARCHITECTURE §9) and stay English in both UI languages.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { title: "Home", href: "/", icon: House, description: "Executive dashboard", simple: true },
      { title: "Today", href: "/today", icon: CalendarCheck, description: "Daily content command center", simple: true },
    ],
  },
  {
    label: "Strategy",
    items: [
      {
        title: "Strategy",
        href: "/strategy",
        icon: Compass,
        description: "Brand HQ, goals and platform strategy",
        children: [
          { title: "Brand HQ", href: "/strategy" },
          { title: "Goals", href: "/strategy/goals" },
          { title: "Platforms", href: "/strategy/platforms" },
          { title: "Flywheel & System", href: "/strategy/system" },
        ],
      },
      {
        title: "Audience",
        href: "/audience",
        icon: Users,
        description: "Personas, problems and questions",
        children: [
          { title: "Personas", href: "/audience" },
          { title: "Problem Bank", href: "/audience/problems" },
          { title: "Question Bank", href: "/audience/questions" },
        ],
      },
      {
        title: "Pillars",
        href: "/pillars",
        icon: Columns3,
        description: "Content pillars, matrix and funnel",
        children: [
          { title: "Content Pillars", href: "/pillars" },
          { title: "Content Matrix", href: "/pillars/matrix" },
          { title: "Content Funnel", href: "/pillars/funnel" },
        ],
      },
    ],
  },
  {
    label: "Create",
    items: [
      {
        title: "Ideas",
        href: "/ideas",
        icon: Lightbulb,
        description: "Idea Bank, generator, hooks and angles",
        simple: true,
        children: [
          { title: "Idea Bank", href: "/ideas" },
          { title: "Idea Generator", href: "/ideas/generator" },
          { title: "Hook Library", href: "/ideas/hooks" },
          { title: "Angle Library", href: "/ideas/angles" },
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
          { title: "Calendar", href: "/calendar" },
          { title: "Weekly Planner", href: "/calendar/planner" },
          { title: "Posting Schedule", href: "/calendar/schedule" },
        ],
      },
    ],
  },
  {
    label: "Organize",
    items: [
      { title: "Campaigns", href: "/campaigns", icon: Megaphone, description: "Grouped content pushes" },
      { title: "Collabs", href: "/collabs", icon: Blend, description: "Creator collaborations and whether they were worth it" },
      { title: "Circles", href: "/circles", icon: UsersRound, description: "Small creator groups: weekly check-ins, streaks and collab asks" },
      { title: "Series", href: "/series", icon: Repeat, description: "Recurring content series" },
      {
        title: "Story Vault",
        href: "/stories",
        icon: BookOpen,
        description: "Stories, experiences and lessons",
        children: [
          { title: "Story Vault", href: "/stories" },
          { title: "Experience → Content", href: "/stories/experience" },
        ],
      },
      {
        title: "Research",
        href: "/research",
        icon: Library,
        description: "References and inspiration",
        children: [
          { title: "Research Library", href: "/research" },
          { title: "Inspiration → Original", href: "/research/adapt" },
        ],
      },
    ],
  },
  {
    label: "Measure",
    items: [
      {
        title: "Analytics",
        href: "/analytics",
        icon: ChartColumn,
        description: "Performance and metrics logging",
        simple: true,
        children: [
          { title: "Overview", href: "/analytics" },
          { title: "Post Performance", href: "/analytics/posts" },
        ],
      },
      { title: "Winners", href: "/winners", icon: Trophy, description: "Winning Content Library" },
      { title: "Experiments", href: "/experiments", icon: FlaskConical, description: "Content experiments" },
      {
        title: "Reports",
        href: "/reports",
        icon: FileText,
        description: "Weekly and monthly reviews",
        children: [
          { title: "Weekly Report", href: "/reports" },
          { title: "Monthly Review", href: "/reports/monthly" },
        ],
      },
    ],
  },
  {
    label: "Monetize",
    items: [
      {
        title: "Money",
        href: "/money",
        icon: Wallet,
        description: "Brand deals, income and your media kit",
        simple: true,
        children: [
          { title: "Overview", href: "/money" },
          { title: "Brand Deals", href: "/money/deals" },
          { title: "Income", href: "/money/income" },
          { title: "Media Kit", href: "/money/media-kit" },
        ],
      },
    ],
  },
  {
    label: null,
    items: [
      { title: "Settings", href: "/settings", icon: Settings, description: "Targets, thresholds, data and AI", simple: true },
    ],
  },
]

/** Every navigable page (for the command palette) — Simple mode never hides anything here. */
export const ALL_PAGES: { title: string; href: string; section: string }[] = NAV_SECTIONS.flatMap((section) =>
  section.items.flatMap((item) => [
    { title: item.title, href: item.href, section: section.label ?? "General" },
    ...(item.children ?? [])
      .filter((c) => c.href !== item.href)
      .map((c) => ({ title: c.title, href: c.href, section: item.title })),
  ])
).concat([{ title: "Content Strategist", href: "/strategist", section: "AI" }])

/** Exact match for "/" ; prefix match for everything else. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The sidebar's sections. In Simple mode only `simple` modules stay — plus the module of the page you're
 * on, so a page opened from ⌘K or a link still shows where you are. `hidden` counts the modules left out.
 */
export function sidebarSections(
  sections: NavSection[],
  { simpleMode, pathname }: { simpleMode: boolean; pathname: string }
): { sections: NavSection[]; hidden: number } {
  if (!simpleMode) return { sections, hidden: 0 }
  let hidden = 0
  const visible: NavSection[] = []
  for (const section of sections) {
    const items = section.items.filter((item) => item.simple || isNavActive(pathname, item.href))
    hidden += section.items.length - items.length
    if (items.length) visible.push({ ...section, items })
  }
  return { sections: visible, hidden }
}
