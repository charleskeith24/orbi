"use client"

import { Globe, Mail, MapPin } from "lucide-react"
import { PlatformIcon } from "@/components/common"
import { ProfileAvatar } from "@/components/features/profile/profile-avatar"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { cn, formatCompact, formatMoney, formatNumber, formatPercent } from "@/lib/utils"
import type { MediaKitData, MediaKitGap } from "./media-kit-model"
import { MEDIA_KIT_DAYS } from "./media-kit-model"

/**
 * The media kit one-pager. English on purpose (it is written for brands); numbers come straight from the
 * workspace and missing ones show as "—". `renderGap` draws an on-screen prompt where data is missing —
 * prompts never print.
 */
export function MediaKitDocument({
  kit,
  renderGap,
  photoUrl,
  className,
}: {
  kit: MediaKitData
  renderGap?: (gap: MediaKitGap) => React.ReactNode
  /** The creator's profile photo, when they chose to show it (Settings → Profile). */
  photoUrl?: string | null
  className?: string
}) {
  const gap = (key: MediaKitGap) => (kit.missing.includes(key) && renderGap ? <div className="print:hidden">{renderGap(key)}</div> : null)
  const title = kit.name || kit.brandName
  const period = `${formatDate(kit.period.start, "MMM d")} – ${formatDate(kit.period.end, "MMM d, yyyy")}`
  const website = kit.website.replace(/^https?:\/\//i, "").replace(/\/$/, "")
  const websiteHref = kit.website ? (/^https?:\/\//i.test(kit.website) ? kit.website : `https://${kit.website}`) : ""

  return (
    <article
      lang="en"
      className={cn(
        "mx-auto flex w-full max-w-[820px] min-w-0 flex-col gap-7 rounded-lg border bg-card p-5 text-card-foreground sm:p-8",
        "print:max-w-none print:gap-6 print:rounded-none print:border-0 print:p-0",
        className
      )}
    >
      {/* Identity */}
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b pb-6">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-4">
          {photoUrl ? <ProfileAvatar name={title || "Media kit"} photoUrl={photoUrl} alt={title || "Profile photo"} className="size-16" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Media kit</p>
            {title ? <h2 className="mt-1 text-xl leading-7 font-semibold tracking-tight">{title}</h2> : null}
            {kit.name && kit.brandName && kit.brandName !== kit.name ? <p className="text-sm text-muted-foreground">{kit.brandName}</p> : null}
            {kit.niche ? <p className="mt-2 text-sm font-medium text-pretty">{kit.niche}</p> : null}
            {gap("name")}
            {gap("niche")}
          </div>
        </div>
        <ul className="flex min-w-0 flex-col gap-1.5 text-sm">
          {kit.email ? (
            <li className="flex min-w-0 items-center gap-2">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <a href={`mailto:${kit.email}`} className="truncate underline-offset-2 hover:underline">
                {kit.email}
              </a>
            </li>
          ) : null}
          {website ? (
            <li className="flex min-w-0 items-center gap-2">
              <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <a href={websiteHref} target="_blank" rel="noreferrer" className="truncate underline-offset-2 hover:underline">
                {website}
              </a>
            </li>
          ) : null}
          {kit.location ? (
            <li className="flex min-w-0 items-center gap-2">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{kit.location}</span>
            </li>
          ) : null}
          {gap("contact")}
        </ul>
      </header>

      {/* About */}
      {kit.positioning || kit.bio || kit.missing.includes("bio") ? (
        <section className="flex min-w-0 flex-col gap-2" aria-label="About">
          <DocHeading>About</DocHeading>
          {kit.positioning ? <p className="text-sm font-medium text-pretty">{kit.positioning}</p> : null}
          {kit.bio ? <p className="max-w-[68ch] text-sm leading-relaxed text-pretty whitespace-pre-line">{kit.bio}</p> : null}
          {gap("bio")}
        </section>
      ) : null}

      {/* Reach */}
      <section className="flex min-w-0 flex-col gap-3 break-inside-avoid" aria-label="Audience and reach">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <DocHeading>Audience &amp; reach</DocHeading>
          <p className="text-xs text-muted-foreground">
            Last {MEDIA_KIT_DAYS} days · {period}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Followers" value={kit.totals.followers === null ? "—" : formatCompact(kit.totals.followers)} />
          <Figure label="Posts" value={formatNumber(kit.totals.posts)} />
          <Figure label="Avg. views per post" value={kit.totals.avgViews === null ? "—" : formatCompact(kit.totals.avgViews)} />
          <Figure label="Engagement rate" value={kit.totals.engagementRate === null ? "—" : formatPercent(kit.totals.engagementRate)} />
        </div>
        {kit.platforms.length ? (
          <div className="min-w-0 overflow-x-auto rounded-md border print:overflow-visible">
            <table className="w-full min-w-[520px] text-sm print:min-w-0">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Platform</th>
                  <th scope="col" className="px-3 py-2 font-medium">Handle</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Followers</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Avg. views</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {kit.platforms.map((p) => (
                  <tr key={p.platform}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <PlatformIcon platform={p.platform} className="size-3.5 text-muted-foreground" />
                        {PLATFORMS[p.platform].label}
                      </span>
                    </td>
                    <td className="max-w-40 truncate px-3 py-2 text-muted-foreground">{p.handle ? `@${p.handle}` : "—"}</td>
                    <td className="px-3 py-2 text-right num">{p.followers === null ? "—" : formatNumber(p.followers)}</td>
                    <td className="px-3 py-2 text-right num">{p.avgViews === null ? "—" : formatNumber(p.avgViews)}</td>
                    <td className="px-3 py-2 text-right num">{p.engagementRate === null ? "—" : formatPercent(p.engagementRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {kit.totals.measured ? (
          <p className="text-xs text-muted-foreground">
            Averages across {formatNumber(kit.totals.measured)} {kit.totals.measured === 1 ? "post" : "posts"} with analytics. Engagement rate = likes,
            comments, shares and saves ÷ reach.
          </p>
        ) : null}
        {gap("platforms")}
        {gap("handles")}
        {gap("followers")}
        {gap("analytics")}
      </section>

      {/* Top posts */}
      {kit.topPosts.length ? (
        <section className="flex min-w-0 flex-col gap-2 break-inside-avoid" aria-label="Top posts">
          <DocHeading>Top posts · last {MEDIA_KIT_DAYS} days</DocHeading>
          <ol className="flex min-w-0 flex-col divide-y rounded-md border">
            {kit.topPosts.map((post, index) => (
              <li key={post.item.id} className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm">
                <span className="w-4 shrink-0 text-xs text-muted-foreground num">{index + 1}</span>
                <PlatformIcon platform={post.item.platform} label={PLATFORMS[post.item.platform].label} className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{post.item.title.trim() || "Untitled post"}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(post.publishedAt, "MMM d, yyyy")}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block text-sm font-medium text-foreground num">{formatCompact(post.views)} views</span>
                  {post.engagementRate !== null ? <span className="num">{formatPercent(post.engagementRate)} engagement</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Audience */}
      {kit.persona || kit.missing.includes("persona") ? (
        <section className="flex min-w-0 flex-col gap-2 break-inside-avoid" aria-label="Who follows">
          <DocHeading>Who follows</DocHeading>
          {kit.persona ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{kit.persona.name}</p>
                <p className="text-xs text-pretty text-muted-foreground">
                  {[kit.persona.profession, kit.persona.age_range, kit.persona.location].filter(Boolean).join(" · ")}
                </p>
              </div>
              <PersonaList label="What they want" items={kit.persona.goals.length ? kit.persona.goals : kit.persona.aspirations} />
              <PersonaList label="What they struggle with" items={kit.persona.problems.length ? kit.persona.problems : kit.persona.frustrations} />
            </div>
          ) : null}
          {gap("persona")}
        </section>
      ) : null}

      {/* Rates */}
      <section className="flex min-w-0 flex-col gap-2" aria-label="Rates">
        <DocHeading>Rates</DocHeading>
        {kit.rateCards.length ? (
          <ul className="grid min-w-0 gap-2 sm:grid-cols-2 print:grid-cols-2">
            {kit.rateCards.map((card) => (
              <li key={card.id} className="flex min-w-0 break-inside-avoid flex-col gap-1.5 rounded-md border p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    {card.platform ? <PlatformIcon platform={card.platform} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                    <span className="truncate">{card.name || "Package"}</span>
                  </p>
                  <p className="shrink-0 text-sm font-semibold num">{card.price === null ? "Price on request" : formatMoney(card.price, card.currency)}</p>
                </div>
                {card.description ? <p className="text-xs text-pretty text-muted-foreground">{card.description}</p> : null}
                {card.deliverables.length ? (
                  <ul className="list-disc pl-4 text-xs text-pretty marker:text-muted-foreground">
                    {card.deliverables.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {gap("rate_cards")}
      </section>

      {/* Collaborations */}
      {kit.collabs.length || kit.missing.includes("collabs") ? (
        <section className="flex min-w-0 flex-col gap-2 break-inside-avoid" aria-label="Past collaborations">
          <DocHeading>Past collaborations</DocHeading>
          {kit.collabs.length ? (
            <ul className="flex flex-wrap gap-2">
              {kit.collabs.map((deal) => (
                <li key={deal.id} className="rounded-md border px-2.5 py-1 text-sm">
                  {deal.brand_name}
                </li>
              ))}
            </ul>
          ) : null}
          {gap("collabs")}
        </section>
      ) : null}

      <footer className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
        <span>{kit.email ? `Let's work together — ${kit.email}` : "Let's work together."}</span>
        <span>Figures as of {formatDate(kit.period.end, "MMM d, yyyy")}</span>
      </footer>
    </article>
  )
}

function DocHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-lg leading-7 font-semibold num">{value}</span>
    </div>
  )
}

function PersonaList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <ul className="mt-1 list-disc pl-4 text-sm text-pretty marker:text-muted-foreground">
        {items.slice(0, 3).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
