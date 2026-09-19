/**
 * Builds the demo collabs from ./collabs-data. Runs after Money (it links to a brand deal) so earlier ids
 * are unaffected.
 */
import type { Collab, GoalCategory, ID } from "@/lib/types"
import type { PillarKey } from "./brand-data"
import type { SeedContext } from "./context"
import { COLLABS } from "./collabs-data"
import type { CampaignKey } from "./piece-types"

export interface CollabRefs {
  /** Id of a demo content item by seed piece key ("key" or "key:index"); null when it isn't in the workspace. */
  item(ref: string): ID | null
  campaign(key: CampaignKey): ID
  deal(key: string): ID
  pillar(key: PillarKey): ID
  goal(category: GoalCategory): ID
  workspaceStart: Date
}

export function buildCollabs(ctx: SeedContext, refs: CollabRefs): Collab[] {
  const past = (d: Date) => (d > ctx.now ? ctx.now : d)
  const later = (a: Date, b: Date) => (b > a ? b : a)
  return COLLABS.map((c) => {
    const logged = ctx.date(c.logged, "10:30")
    const created = logged < refs.workspaceStart ? refs.workspaceStart : past(logged)
    const moved = later(created, past(ctx.date(c.moved, "15:10")))
    return ctx.build(
      "collabs",
      {
        id: ctx.id(`collab:${c.key}`),
        title: c.title,
        type: c.type,
        status: c.status,
        partner_name: c.partner.name ?? "",
        partner_handle: c.partner.handle ?? "",
        partner_platform: c.partner.platform ?? null,
        partner_link: c.partner.link ?? "",
        partner_niche: c.partner.niche,
        partner_followers: c.partner.followers ?? null,
        pillar_id: c.pillar ? refs.pillar(c.pillar) : null,
        goal_id: c.goal ? refs.goal(c.goal) : null,
        campaign_id: c.campaign ? refs.campaign(c.campaign) : null,
        brand_deal_id: c.deal ? refs.deal(c.deal) : null,
        content_item_ids: (c.content ?? []).map((r) => refs.item(r)).filter((id): id is ID => id !== null),
        collab_date: c.date === undefined ? null : ctx.day(c.date),
        follow_up_on: c.followUp === undefined ? null : ctx.day(c.followUp),
        outreach_message: c.outreach ?? "",
        notes: c.notes ?? "",
        rating: c.rating ?? null,
        would_repeat: c.repeat ?? null,
        status_changed_at: moved.toISOString(),
      },
      created,
      moved
    )
  })
}
