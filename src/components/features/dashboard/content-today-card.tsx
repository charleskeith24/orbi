import { format } from "date-fns"
import { AlarmClock, CalendarClock, Clapperboard, ClipboardCheck, Send, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { ColorDot, PlatformIcon, SectionCard, StageBadge, StatusPill } from "@/components/common"
import type { TodayContent } from "@/lib/analytics"
import { formatTime } from "@/lib/dates"
import type { ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CardLink } from "./card-link"
import { formatSlotTime, overdueLabel, type WeekSlot } from "./dashboard-utils"

type GroupKey = "dueToday" | "overdue" | "scheduledToday" | "awaitingProduction" | "awaitingApproval"

interface Group {
  key: GroupKey
  label: string
  icon: LucideIcon
  empty: string
  href: string
  /** Urgent groups render only when they have items (and then in the critical tone). */
  urgent?: boolean
}

const GROUPS: Group[] = [
  { key: "dueToday", label: "Due today", icon: CalendarClock, empty: "Nothing due today", href: "/today" },
  { key: "overdue", label: "Overdue", icon: AlarmClock, empty: "Nothing overdue", href: "/today", urgent: true },
  { key: "scheduledToday", label: "Scheduled today", icon: Send, empty: "Nothing scheduled for today", href: "/today" },
  {
    key: "awaitingProduction",
    label: "Awaiting production",
    icon: Clapperboard,
    empty: "Nothing waiting to be recorded or edited",
    href: "/pipeline",
  },
  { key: "awaitingApproval", label: "Awaiting approval", icon: ClipboardCheck, empty: "Nothing waiting for approval", href: "/pipeline" },
]

/** Items shown per group; the rest sit behind "+N more". */
const VISIBLE = 2

const ROW_LINK =
  "-mx-2 flex min-w-0 items-center gap-2 rounded-md px-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"

function TodaySlots({ slots }: { slots: WeekSlot[] }) {
  if (!slots.length) {
    return (
      <Link href="/calendar/schedule" className={cn(ROW_LINK, "mx-0 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground")}>
        No posting slot today — adjust your Posting Schedule
      </Link>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {slots.map(({ slot, pillar, status }) => {
        const time = formatSlotTime(slot.time)
        const filled = status === "filled"
        return (
          <li key={slot.id}>
            <Link
              href="/calendar"
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
                !filled && "border-dashed"
              )}
            >
              <span className="shrink-0 text-xs text-muted-foreground">Today&apos;s slot</span>
              {pillar ? <ColorDot color={pillar.color} /> : null}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{slot.label || "Posting slot"}</span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                {slot.platforms.map((platform) => (
                  <PlatformIcon key={platform} platform={platform} label className="size-3.5" />
                ))}
              </span>
              {time ? <span className="hidden shrink-0 text-xs text-muted-foreground num @xl:inline">{time}</span> : null}
              <StatusPill tone={filled ? "good" : "warning"}>{filled ? "Filled" : "Open slot"}</StatusPill>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function ItemMeta({ item, group, now }: { item: ContentItem; group: GroupKey; now: Date }) {
  if (group === "overdue") return <span className="shrink-0 text-xs font-medium text-critical-fg">{overdueLabel(item, now)}</span>
  if (group === "scheduledToday" && item.scheduled_at) {
    return <span className="shrink-0 text-xs text-muted-foreground num">{formatTime(item.scheduled_at)}</span>
  }
  return <StageBadge stage={item.stage} />
}

function TodayGroup({ group, items, now }: { group: Group; items: ContentItem[]; now: Date }) {
  if (group.urgent && !items.length) return null
  const Icon = group.icon
  const shown = items.slice(0, VISIBLE)
  const more = items.length - shown.length
  return (
    <section aria-label={group.label} className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5 text-xs">
        <Icon className={cn("size-3.5 shrink-0", group.urgent ? "text-critical-fg" : "text-muted-foreground")} aria-hidden />
        <span className={cn("font-medium", group.urgent && "text-critical-fg")}>{group.label}</span>
        <span className="text-muted-foreground num">{items.length}</span>
        {more > 0 ? (
          <Link
            href={group.href}
            className="ml-auto rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            +{more} more
          </Link>
        ) : null}
      </div>
      {shown.length ? (
        <ul className="flex flex-col">
          {shown.map((item) => (
            <li key={item.id}>
              <Link href={`/studio/${item.id}`} className={cn(ROW_LINK, "py-1")}>
                <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm" title={item.title}>
                  {item.title.trim() || "Untitled content"}
                </span>
                <ItemMeta item={item} group={group.key} now={now} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-1 pl-5 text-xs text-muted-foreground">{group.empty}</p>
      )}
    </section>
  )
}

/** Today's posting slot, then Due today · Overdue · Scheduled today · Awaiting production · Awaiting approval. */
export function ContentTodayCard({
  today,
  slots,
  now,
  className,
}: {
  today: TodayContent
  slots: WeekSlot[]
  now: Date
  className?: string
}) {
  return (
    <SectionCard
      title="Content Today"
      description={format(now, "EEEE, MMM d")}
      action={<CardLink href="/today">Open Today</CardLink>}
      className={className}
      contentClassName="flex flex-col gap-3"
    >
      <TodaySlots slots={slots} />
      {GROUPS.map((group) => (
        <TodayGroup key={group.key} group={group} items={today[group.key]} now={now} />
      ))}
    </SectionCard>
  )
}
