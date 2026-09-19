/**
 * Offline engine for Collabs: collab ideas and outreach pitches.
 *
 * Ideas pair the creator's niche with ADJACENT niches — creators who talk to the same people about a
 * different problem, so both sides gain followers without competing (personal finance ↔ freelancing,
 * online selling ↔ product photography). Partners are always described as a kind of creator, never a
 * named person or account. Pitches are short, specific DMs: who you are, what their audience gets, the
 * format, and one concrete first step — no flattery templates.
 */
import { PLATFORMS } from "@/lib/constants"
import type { CollabType, PlatformId, ScriptFormat } from "@/lib/types"
import type { BrandContext, ContextPillar } from "../context"
import { nicheTopic, type Kit } from "./brand"
import { NICHE_DOMAINS, type Bi, type NicheDomain } from "./niche-domains"
import { clean, lowerFirst, upperFirst } from "./text"

/* ------------------------------ Adjacent niches ------------------------------ */

interface Adjacent {
  /** A NICHE_DOMAINS id. */
  id: string
  /** Partner niche label when the domain's topic is too broad for this pairing. */
  niche?: Bi
  /** Who to look for, when the domain default isn't specific enough. */
  kind?: Bi
  /** Collab types that suit this pairing best. */
  types?: CollabType[]
}

/**
 * Niches that share an audience with the key niche without competing with it, best fit first. Only
 * domains the creator doesn't already cover are suggested.
 */
const ADJACENT: Record<string, Adjacent[]> = {
  taxes: [
    { id: "freelancing", types: ["joint_live", "guesting"] },
    { id: "finance", types: ["co_created", "joint_live"] },
    { id: "ecommerce", niche: ["Online selling", "Online selling"], types: ["joint_live", "co_created"] },
    { id: "business", types: ["guesting", "shoutout_swap"] },
  ],
  finance: [
    { id: "freelancing", types: ["joint_live", "duet_stitch"] },
    { id: "career", niche: ["Career and salary growth", "Career at salary growth"], types: ["co_created", "guesting"] },
    {
      id: "taxes",
      niche: ["Taxes for freelancers and employees", "Taxes para sa freelancers at employees"],
      kind: ["A tax or bookkeeping creator who explains BIR rules in plain language", "Isang tax o bookkeeping creator na nag-e-explain ng BIR rules sa simpleng paraan"],
      types: ["joint_live", "co_created"],
    },
    { id: "realestate", types: ["guesting", "joint_live"] },
    { id: "ofw", types: ["joint_live", "shoutout_swap"] },
  ],
  freelancing: [
    { id: "finance", niche: ["Money on irregular income", "Pera kahit irregular ang income"], types: ["joint_live", "co_created"] },
    {
      id: "taxes",
      niche: ["Freelancer taxes", "Taxes ng freelancers"],
      kind: ["A tax or bookkeeping creator who helps freelancers register and file with the BIR", "Isang tax o bookkeeping creator na tumutulong sa freelancers mag-register at mag-file sa BIR"],
      types: ["joint_live", "guesting"],
    },
    { id: "tech", types: ["duet_stitch", "co_created"] },
    { id: "design", types: ["co_created", "shoutout_swap"] },
    { id: "career", types: ["guesting", "shoutout_swap"] },
  ],
  ecommerce: [
    {
      id: "design",
      niche: ["Product photography", "Product photography"],
      kind: ["A product-photography or shop-visuals creator who shoots for small online sellers", "Isang product-photography o shop-visuals creator na nag-sho-shoot para sa small online sellers"],
      types: ["co_created", "duet_stitch"],
    },
    {
      id: "taxes",
      niche: ["Bookkeeping for online sellers", "Bookkeeping para sa online sellers"],
      kind: ["A bookkeeping and BIR creator who explains taxes to online sellers", "Isang bookkeeping at BIR creator na nag-e-explain ng taxes sa online sellers"],
      types: ["joint_live", "co_created"],
    },
    {
      id: "tech",
      niche: ["Automation and AI tools", "Automation at AI tools"],
      kind: ["A creator who teaches AI and automation tools to small teams", "Isang creator na nagtuturo ng AI at automation tools sa small teams"],
      types: ["guesting", "duet_stitch"],
    },
    { id: "business", types: ["joint_live", "guesting"] },
    { id: "finance", niche: ["Business cash flow", "Business cash flow"], types: ["co_created", "joint_live"] },
  ],
  marketing: [
    {
      id: "design",
      niche: ["Content design and video editing", "Content design at video editing"],
      kind: ["A designer or video editor who teaches creatives how to make ads and posts look right", "Isang designer o video editor na nagtuturo kung paano gawing maayos ang ads at posts"],
      types: ["co_created", "duet_stitch"],
    },
    { id: "sales", niche: ["Sales and closing", "Sales at closing"], types: ["joint_live", "guesting"] },
    { id: "tech", niche: ["Automation and AI tools", "Automation at AI tools"], types: ["guesting", "co_created"] },
    {
      id: "creator",
      niche: ["Creator growth", "Creator growth"],
      kind: ["A creator who teaches other creators how to grow and land brand deals", "Isang creator na nagtuturo sa ibang creators kung paano mag-grow at makakuha ng brand deals"],
      types: ["group_brand_deal", "shoutout_swap"],
    },
    { id: "business", types: ["joint_live", "guesting"] },
  ],
  creator: [
    { id: "design", niche: ["Editing and thumbnails", "Editing at thumbnails"], types: ["co_created", "duet_stitch"] },
    { id: "tech", niche: ["Creator tools and AI", "Creator tools at AI"], types: ["guesting", "duet_stitch"] },
    { id: "marketing", niche: ["Brand deals and marketing", "Brand deals at marketing"], types: ["joint_live", "group_brand_deal"] },
    { id: "finance", niche: ["Money for creators", "Pera para sa creators"], types: ["co_created", "joint_live"] },
  ],
  career: [
    { id: "finance", niche: ["Salary and money habits", "Sweldo at money habits"], types: ["co_created", "joint_live"] },
    { id: "tech", niche: ["Work tools and AI skills", "Work tools at AI skills"], types: ["duet_stitch", "guesting"] },
    { id: "growth", types: ["guesting", "shoutout_swap"] },
    { id: "education", types: ["joint_live", "co_created"] },
    { id: "leadership", types: ["guesting", "joint_live"] },
  ],
  food: [
    { id: "business", niche: ["Food business", "Food business"], kind: ["A negosyo creator who helps home-based food sellers price and grow", "Isang negosyo creator na tumutulong sa home-based food sellers mag-price at mag-grow"], types: ["joint_live", "guesting"] },
    { id: "design", niche: ["Food photography", "Food photography"], kind: ["A food-photography creator who shoots with a phone and natural light", "Isang food-photography creator na gumagamit lang ng phone at natural light"], types: ["co_created", "duet_stitch"] },
    { id: "fitness", niche: ["Healthy eating", "Healthy eating"], types: ["co_created", "duet_stitch"] },
    { id: "parenting", niche: ["Family meals", "Family meals"], types: ["joint_live", "giveaway"] },
    { id: "travel", niche: ["Food trips", "Food trips"], types: ["duet_stitch", "shoutout_swap"] },
  ],
  fitness: [
    { id: "food", niche: ["Healthy home cooking", "Healthy home cooking"], types: ["co_created", "duet_stitch"] },
    { id: "growth", niche: ["Habits and mindset", "Habits at mindset"], types: ["joint_live", "guesting"] },
    { id: "beauty", niche: ["Skincare and style", "Skincare at style"], types: ["giveaway", "co_created"] },
    { id: "healthcare", niche: ["Health explained by a professional", "Health explained ng isang professional"], types: ["guesting", "joint_live"] },
  ],
  parenting: [
    { id: "food", niche: ["Kid-friendly cooking", "Kid-friendly na luto"], types: ["co_created", "giveaway"] },
    { id: "finance", niche: ["Family budgeting", "Family budgeting"], types: ["joint_live", "co_created"] },
    { id: "education", niche: ["Learning at home", "Learning sa bahay"], types: ["guesting", "co_created"] },
    { id: "growth", niche: ["Mental health for parents", "Mental health para sa parents"], types: ["joint_live", "shoutout_swap"] },
  ],
  tech: [
    { id: "freelancing", types: ["joint_live", "guesting"] },
    { id: "career", types: ["co_created", "guesting"] },
    { id: "design", types: ["duet_stitch", "co_created"] },
    { id: "education", niche: ["Study skills", "Study skills"], types: ["co_created", "shoutout_swap"] },
  ],
  design: [
    { id: "freelancing", niche: ["Getting creative clients", "Pagkuha ng creative clients"], types: ["joint_live", "guesting"] },
    { id: "marketing", types: ["co_created", "guesting"] },
    { id: "tech", niche: ["AI tools for creatives", "AI tools para sa creatives"], types: ["duet_stitch", "co_created"] },
    { id: "creator", niche: ["Creator growth", "Creator growth"], types: ["shoutout_swap", "group_brand_deal"] },
  ],
  realestate: [
    { id: "finance", niche: ["Saving for a home", "Pag-iipon para sa bahay"], types: ["joint_live", "co_created"] },
    { id: "ofw", niche: ["OFW investing", "OFW investing"], types: ["joint_live", "guesting"] },
    { id: "design", niche: ["Small-space interiors", "Small-space interiors"], types: ["co_created", "duet_stitch"] },
    { id: "business", types: ["guesting", "shoutout_swap"] },
  ],
  ofw: [
    { id: "finance", niche: ["Remittance and savings", "Padala at ipon"], types: ["joint_live", "co_created"] },
    { id: "realestate", niche: ["Buying property from abroad", "Pagbili ng property habang nasa abroad"], types: ["guesting", "joint_live"] },
    { id: "career", niche: ["Job hunting abroad", "Job hunting abroad"], types: ["co_created", "shoutout_swap"] },
    { id: "business", niche: ["Negosyo for returning OFWs", "Negosyo para sa pauwing OFW"], types: ["guesting", "joint_live"] },
  ],
  education: [
    { id: "career", niche: ["First jobs after school", "Unang trabaho after school"], types: ["joint_live", "guesting"] },
    { id: "tech", niche: ["Study tools and AI", "Study tools at AI"], types: ["duet_stitch", "co_created"] },
    { id: "growth", niche: ["Focus and habits", "Focus at habits"], types: ["co_created", "shoutout_swap"] },
    { id: "finance", niche: ["Money for students", "Pera para sa students"], types: ["giveaway", "joint_live"] },
  ],
  travel: [
    { id: "food", niche: ["Food trips", "Food trips"], types: ["duet_stitch", "co_created"] },
    { id: "finance", niche: ["Saving for trips", "Pag-iipon para sa trips"], types: ["co_created", "joint_live"] },
    { id: "design", niche: ["Travel photography", "Travel photography"], types: ["co_created", "giveaway"] },
    { id: "ofw", types: ["guesting", "shoutout_swap"] },
  ],
  beauty: [
    { id: "fitness", niche: ["Wellness and fitness", "Wellness at fitness"], types: ["co_created", "giveaway"] },
    { id: "design", niche: ["Photos and styling", "Photos at styling"], types: ["duet_stitch", "co_created"] },
    { id: "finance", niche: ["Budgeting for young women", "Budgeting para sa young women"], types: ["joint_live", "shoutout_swap"] },
    { id: "growth", niche: ["Confidence and self-care", "Confidence at self-care"], types: ["guesting", "joint_live"] },
  ],
  growth: [
    { id: "fitness", niche: ["Movement and health", "Movement at health"], types: ["co_created", "duet_stitch"] },
    { id: "career", types: ["guesting", "joint_live"] },
    { id: "finance", niche: ["Money habits", "Money habits"], types: ["co_created", "joint_live"] },
    { id: "education", niche: ["Reading and learning", "Reading at learning"], types: ["shoutout_swap", "giveaway"] },
  ],
  business: [
    {
      id: "taxes",
      niche: ["BIR and bookkeeping for owners", "BIR at bookkeeping para sa owners"],
      kind: ["A bookkeeping or tax creator who explains BIR rules to small business owners", "Isang bookkeeping o tax creator na nag-e-explain ng BIR rules sa small business owners"],
      types: ["joint_live", "co_created"],
    },
    { id: "marketing", niche: ["Marketing on a small budget", "Marketing kahit maliit ang budget"], types: ["guesting", "joint_live"] },
    { id: "finance", niche: ["Cash flow and savings", "Cash flow at ipon"], types: ["co_created", "joint_live"] },
    { id: "design", niche: ["Branding and packaging", "Branding at packaging"], types: ["co_created", "giveaway"] },
  ],
  leadership: [
    { id: "career", niche: ["Career growth for new managers", "Career growth para sa new managers"], types: ["guesting", "joint_live"] },
    { id: "growth", niche: ["Burnout and habits", "Burnout at habits"], types: ["co_created", "joint_live"] },
    { id: "tech", niche: ["Team tools and AI", "Team tools at AI"], types: ["duet_stitch", "guesting"] },
    { id: "business", types: ["joint_live", "shoutout_swap"] },
  ],
  sales: [
    { id: "marketing", niche: ["Lead generation", "Lead generation"], types: ["joint_live", "co_created"] },
    { id: "finance", niche: ["Commission money habits", "Money habits sa commission"], types: ["co_created", "joint_live"] },
    { id: "growth", niche: ["Confidence and rejection", "Confidence at rejection"], types: ["guesting", "duet_stitch"] },
    { id: "career", types: ["guesting", "shoutout_swap"] },
  ],
  healthcare: [
    { id: "fitness", niche: ["Fitness for shift workers", "Fitness para sa shift workers"], types: ["co_created", "duet_stitch"] },
    { id: "finance", niche: ["Money for new nurses", "Pera para sa new nurses"], types: ["joint_live", "co_created"] },
    { id: "ofw", niche: ["Working abroad as a nurse", "Pag-abroad bilang nurse"], types: ["guesting", "joint_live"] },
    { id: "growth", niche: ["Burnout and self-care", "Burnout at self-care"], types: ["shoutout_swap", "joint_live"] },
  ],
  plants: [
    { id: "food", niche: ["Cooking what you grow", "Pagluto ng tinanim mo"], types: ["co_created", "duet_stitch"] },
    { id: "design", niche: ["Small-space styling", "Small-space styling"], types: ["co_created", "giveaway"] },
    { id: "parenting", niche: ["Gardening with kids", "Gardening kasama ang kids"], types: ["joint_live", "giveaway"] },
    { id: "business", niche: ["Selling plants online", "Pagbenta ng halaman online"], types: ["guesting", "joint_live"] },
  ],
  gaming: [
    { id: "tech", niche: ["Gaming gear and PCs", "Gaming gear at PCs"], types: ["duet_stitch", "giveaway"] },
    { id: "entertainment", types: ["joint_live", "shoutout_swap"] },
    { id: "creator", niche: ["Streaming and editing", "Streaming at editing"], types: ["guesting", "co_created"] },
    { id: "finance", niche: ["Money for young gamers", "Pera para sa young gamers"], types: ["co_created", "joint_live"] },
  ],
  entertainment: [
    { id: "travel", niche: ["Filming-location trips", "Trips sa filming locations"], types: ["co_created", "duet_stitch"] },
    { id: "food", niche: ["Food from the shows", "Pagkain mula sa shows"], types: ["duet_stitch", "co_created"] },
    { id: "gaming", types: ["joint_live", "shoutout_swap"] },
    { id: "beauty", niche: ["Looks from the shows", "Looks mula sa shows"], types: ["duet_stitch", "giveaway"] },
  ],
  pets: [
    { id: "parenting", niche: ["Kids and pets", "Kids at pets"], types: ["co_created", "joint_live"] },
    { id: "design", niche: ["Pet photography", "Pet photography"], types: ["co_created", "giveaway"] },
    { id: "food", niche: ["Homemade pet treats", "Homemade pet treats"], types: ["duet_stitch", "co_created"] },
    { id: "plants", niche: ["Pet-safe plants", "Pet-safe plants"], types: ["co_created", "shoutout_swap"] },
  ],
}

/** When nothing in Brand HQ points at a known niche. */
const FALLBACK_ADJACENT: Adjacent[] = [{ id: "finance" }, { id: "career" }, { id: "tech" }, { id: "design" }, { id: "growth" }]

const DOMAINS = new Map(NICHE_DOMAINS.map((d) => [d.id, d]))

/** The creator's niches from Brand HQ, strongest first; only strong matches count as "theirs". */
export function creatorDomains(ctx: BrandContext): { ranked: NicheDomain[]; own: Set<string> } {
  const b = ctx.brand
  const groups: [string[], number][] = [
    [[b.niche], 3],
    [[b.industry], 2],
    [b.expertise_areas, 1],
    [ctx.pillars.map((p) => p.name), 1],
    [b.interests, 0.5],
    [[b.positioning_audience, ...ctx.personas.map((p) => `${p.name} ${p.profession}`)], 0.5],
  ]
  const score = new Map<string, number>()
  for (const [texts, weight] of groups) {
    for (const text of texts) {
      const t = text.toLowerCase()
      if (!t.trim()) continue
      for (const d of NICHE_DOMAINS) if (d.match.test(t)) score.set(d.id, (score.get(d.id) ?? 0) + weight)
    }
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => DOMAINS.get(id)!)
  const own = new Set([...score.entries()].filter(([, s]) => s >= 2).map(([id]) => id))
  if (ranked[0]) own.add(ranked[0].id)
  return { ranked, own }
}

/* --------------------------------- Helpers --------------------------------- */

const lang = (kit: Kit) => (kit.lang === "english" ? 0 : 1)
const bi = (kit: Kit, value: Bi) => value[lang(kit)]

function fill(template: string, vars: Record<string, string>): string {
  return clean(template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? ""))
}

/** "Performance-marketing systems" → "performance marketing"; "Budget & ipon systems" → "budget & ipon". */
function compactTopic(topic: string): string {
  return clean(
    topic
      .replace(/\s+(?:systems?|strategies|strategy|tips|guides?|frameworks?|playbooks?|basics|made simple|explained)$/i, "")
      .replace(/\b([a-z]{3,})-([a-z]{3,})\b/gi, "$1 $2")
  )
}

/** Short topic phrase for the creator: their own niche words when compact, else the domain topic. */
function myTopic(ctx: BrandContext, kit: Kit, domain: NicheDomain | undefined): string {
  const own = compactTopic(nicheTopic(ctx.brand.niche))
  if (own && own.split(/\s+/).length <= 3) return kit.display(lowerFirst(own))
  if (domain) return bi(kit, domain.topic)
  const pillar = ctx.pillars[0]?.name
  if (pillar && !/^(education|authority|journey|leadership|personal|business)$/i.test(pillar)) return kit.display(lowerFirst(pillar))
  const industry = ctx.brand.industry.split(/\s*(?:&|,|\/|\(|\band\b)\s*/i)[0]?.trim()
  return industry ? kit.display(lowerFirst(industry)) : kit.say("your niche", "niche mo")
}

function audienceOf(kit: Kit): { aud: string; yourAud: string } {
  const known = Boolean(kit.audience) && kit.audience !== "people"
  return known
    ? { aud: kit.audience, yourAud: kit.say(`your ${kit.audience}`, `${kit.audience} mo`) }
    : { aud: kit.say("your followers", "followers mo"), yourAud: kit.say("your followers", "followers mo") }
}

/** "a" / "an" before an English phrase. */
function article(phrase: string): string {
  return /^(?:[aeiou]|AI\b|hour|honest)/i.test(phrase) && !/^(?:uni|use|eu|one)/i.test(phrase) ? "an" : "a"
}

/** The partner niche without its audience, for titles: "Bookkeeping for online sellers" → "bookkeeping". */
function shortNiche(label: string): string {
  return lowerFirst(clean(label.split(/\s+(?:for|para sa|ng mga|sa mga)\s+/i)[0] ?? label))
}

/** The creator's active platforms (Brand HQ platform strategies), with a PH default. */
function activePlatforms(ctx: BrandContext): PlatformId[] {
  const list = ctx.platforms.map((p) => p.platform)
  return list.length ? list : ["facebook", "tiktok", "instagram"]
}

const TYPE_PLATFORMS: Record<CollabType, PlatformId[]> = {
  duet_stitch: ["tiktok", "instagram", "youtube", "facebook"],
  joint_live: ["facebook", "tiktok", "instagram", "youtube", "linkedin"],
  guesting: ["youtube", "facebook", "linkedin", "tiktok", "instagram"],
  shoutout_swap: ["instagram", "facebook", "tiktok", "threads", "x"],
  giveaway: ["instagram", "facebook", "tiktok"],
  co_created: ["instagram", "linkedin", "facebook", "tiktok"],
  group_brand_deal: ["tiktok", "instagram", "facebook", "youtube"],
  other: ["facebook", "instagram", "tiktok"],
}

/** Which collab types suit this creator's platforms, best first. */
function typeOrder(platforms: PlatformId[], ctx: BrandContext): CollabType[] {
  const has = (p: PlatformId) => platforms.includes(p)
  const order: CollabType[] = []
  if (has("tiktok")) order.push("duet_stitch")
  if (has("facebook") || has("instagram") || has("tiktok") || has("youtube")) order.push("joint_live")
  if (has("youtube") || has("linkedin") || has("facebook")) order.push("guesting")
  if (has("instagram") || has("linkedin")) order.push("co_created")
  if (ctx.goals.some((g) => g.category === "business" || g.category === "leads")) order.push("group_brand_deal")
  order.push("shoutout_swap", "giveaway", "co_created", "joint_live", "duet_stitch", "guesting", "group_brand_deal")
  return [...new Set(order)]
}

function platformFor(type: CollabType, platforms: PlatformId[]): PlatformId {
  return TYPE_PLATFORMS[type].find((p) => platforms.includes(p)) ?? platforms[0] ?? "facebook"
}

const TYPE_SCRIPTS: Partial<Record<CollabType, ScriptFormat[]>> = {
  joint_live: ["video_brief"],
  guesting: ["podcast_outline", "long_video"],
  shoutout_swap: ["story_sequence"],
  duet_stitch: ["short_video"],
  co_created: ["carousel"],
}
const TYPE_FORMAT_FALLBACK: Record<CollabType, Bi> = {
  duet_stitch: ["Short-form video", "Short-form video"],
  joint_live: ["Live video", "Live video"],
  guesting: ["Podcast episode", "Podcast episode"],
  shoutout_swap: ["Stories", "Stories"],
  giveaway: ["Giveaway post", "Giveaway post"],
  co_created: ["Carousel", "Carousel"],
  group_brand_deal: ["Sponsored video", "Sponsored video"],
  other: ["Post", "Post"],
}

function formatFor(ctx: BrandContext, kit: Kit, type: CollabType, platform: PlatformId): string {
  const scripts = TYPE_SCRIPTS[type]
  const byScript = scripts ? ctx.formats.find((f) => scripts.includes(f.script_format)) : undefined
  if (type === "co_created" && (platform === "instagram" || platform === "linkedin") && byScript) return byScript.name
  if (byScript && type !== "co_created") return byScript.name
  return kit.formatFor(platform, type === "giveaway" ? "visual" : type === "duet_stitch" || type === "group_brand_deal" ? "video" : null)?.name ?? bi(kit, TYPE_FORMAT_FALLBACK[type])
}

/* ---------------------------------- Ideas ---------------------------------- */

const TITLES: Record<CollabType, Bi[]> = {
  duet_stitch: [
    ["Stitch series: {them} questions, answered with {me}", "Stitch series: {them} questions, sinagot gamit ang {me}"],
    ["Duet: one {them} myth, fixed with {me}", "Duet: isang {them} myth, inayos gamit ang {me}"],
  ],
  joint_live: [
    ["Joint Live: {me} × {them} Q&A for {aud}", "Joint Live: {me} × {them} Q&A para sa {aud}"],
    ["Live hot seat: {aud} bring their {me} and {them} questions", "Live hot seat: dalhin ng {aud} ang {me} at {them} questions nila"],
  ],
  guesting: [
    ["Guest episode: {me} mistakes {aud} make first", "Guest episode: mga unang {me} mistakes ng {aud}"],
    ["Guest swap: {me} on their show, {them} on yours", "Guest swap: {me} sa show nila, {them} sa show mo"],
  ],
  shoutout_swap: [
    ["Shoutout swap: who {aud} should follow next", "Shoutout swap: sino ang susunod na i-follow ng {aud}"],
    ["Story takeover swap: a day of {them} on your account", "Story takeover swap: isang araw ng {them} sa account mo"],
  ],
  giveaway: [
    ["Giveaway: a {me} starter kit plus a {them} session", "Giveaway: {me} starter kit at isang {them} session"],
    ["Joint giveaway for {aud}: one useful prize from each side", "Joint giveaway para sa {aud}: tig-isang useful na prize"],
  ],
  co_created: [
    ["Co-created carousel: {me} + {them} checklist", "Co-created carousel: {me} + {them} checklist"],
    ["Collab post: {me} or {them} — what to fix first", "Collab post: {me} o {them} — ano ang uunahin?"],
  ],
  group_brand_deal: [
    ["Group pitch: a {me} + {them} package for brands that serve {aud}", "Group pitch: {me} + {them} package para sa brands na nagse-serve sa {aud}"],
    ["Two-creator campaign: {me} and {them} for one brand", "Two-creator campaign: {me} at {them} para sa isang brand"],
  ],
  other: [
    ["7-day challenge: {me} × {them}", "7-day challenge: {me} × {them}"],
    ["Mini-series together: {me} meets {them}", "Mini-series together: {me} meets {them}"],
  ],
}

/** Why the audiences overlap without competing — one per idea, never repeated in a batch. */
const BRIDGES: Bi[] = [
  [
    "Many of {your_aud} also want to {their_result}. That's their lane, not yours — same people, different problem, so neither of you competes.",
    "Marami sa {your_aud} ang gusto ring {their_result}. Lane nila 'yon, hindi sa iyo — parehong tao, ibang problema, kaya walang nagkakompetensya.",
  ],
  [
    "Their followers come to them for {them}, yours come to you for {me} — together you answer the whole question for {aud}.",
    "Sa kanila pumupunta ang followers para sa {them}, sa iyo para sa {me} — magkasama, buo ang sagot para sa {aud}.",
  ],
  [
    "You don't teach {them} and they don't teach {me}, so each side sends the other warm followers instead of splitting them.",
    "Hindi mo tinuturo ang {them} at hindi nila tinuturo ang {me}, kaya nagpapasa kayo ng warm followers sa isa't isa imbes na maghati.",
  ],
  [
    "People who follow {them} content usually hit a {me} question next — a natural hand-off in both directions.",
    "Ang mga sumusubaybay sa {them} content ay kadalasang may {me} na tanong pagkatapos — natural na pasahan, both ways.",
  ],
  [
    "{A_them} creator already has the trust of people who look a lot like {your_aud} — you borrow that trust, they borrow yours.",
    "May tiwala na sa isang {them} creator ang mga taong kamukha ng {your_aud} — hiram kayo ng tiwala sa isa't isa.",
  ],
  [
    "Your audiences overlap but your topics don't: they bring the {them} know-how, you bring {me}, and nobody repeats the other.",
    "Nag-o-overlap ang audience ninyo pero hindi ang topics: sila sa {them}, ikaw sa {me}, walang nag-uulit ng isa't isa.",
  ],
]

const TYPE_REASONS: Record<CollabType, Bi> = {
  duet_stitch: [
    "A stitch shows up for their audience too, and you add a take they can't give.",
    "Lumalabas din ang stitch sa audience nila, at may take kang hindi nila kayang ibigay.",
  ],
  joint_live: [
    "On a joint Live both audiences ask questions in real time, and the replay keeps working afterwards.",
    "Sa joint Live, sabay na nagtatanong ang parehong audience, at gumagana pa rin ang replay pagkatapos.",
  ],
  guesting: [
    "A guest episode puts you in front of their listeners for half an hour, not three seconds of scrolling.",
    "Sa guest episode, kalahating oras kang kaharap ng listeners nila — hindi lang tatlong segundo ng scroll.",
  ],
  shoutout_swap: [
    "A recommendation from someone they already trust lands better than any ad.",
    "Mas tumatalab ang recommendation galing sa taong pinagkakatiwalaan na nila kaysa sa kahit anong ad.",
  ],
  giveaway: [
    "If the prize is something your audience actually needs, the people it brings in stay after it ends.",
    "Kapag talagang kailangan ng audience mo ang prize, may matitirang followers kahit tapos na ang giveaway.",
  ],
  co_created: [
    "You both publish it, so one piece of work reaches two feeds.",
    "Pareho ninyong ipa-publish, kaya dalawang feed ang naaabot sa isang trabaho.",
  ],
  group_brand_deal: [
    "Brands pay more for a package that reaches both audiences, and you split the pitching.",
    "Mas malaki ang binabayad ng brands sa package na naaabot ang parehong audience, at hati kayo sa pag-pitch.",
  ],
  other: [
    "A shared format gives both audiences a reason to come back for the next part.",
    "May dahilan ang parehong audience na bumalik sa susunod na part dahil sa shared format.",
  ],
}

const KIND_TEMPLATES: Bi[] = [
  ["{A_them} creator who helps {their_aud} {their_result}", "Isang {them} creator na tumutulong sa {their_aud} na {their_result}"],
  ["A creator focused on {them} whose followers are also {aud}", "Isang creator na naka-focus sa {them} na {aud} din ang followers"],
]

/** How to spot the right partner — rotated so a batch never repeats itself. */
const LOOK_FOR: Bi[] = [
  ["Look for someone around your size who posts regularly on {platform}.", "Maghanap ng kasing-laki mo na regular mag-post sa {platform}."],
  ["Aim for a similar audience size and an account that's active on {platform} every week.", "Hanapin ang kapareho mo ng laki ng audience na active sa {platform} linggo-linggo."],
  ["Pick someone whose {platform} comments are full of the same kind of people as yours.", "Piliin ang may {platform} comments na puno ng kaparehong klase ng tao sa iyo."],
  ["Start with creators you already talk to in the {platform} comments.", "Magsimula sa mga creator na nakakausap mo na sa {platform} comments."],
  ["Check that their last few {platform} posts get real conversations, not just views.", "I-check kung may totoong usapan sa huling {platform} posts nila, hindi lang views."],
  ["A smaller, active {platform} account beats a big quiet one.", "Mas okay ang maliit pero active na {platform} account kaysa malaki pero tahimik."],
]

export interface OfflineCollabIdea {
  type: CollabType
  title: string
  partner_niche: string
  partner_kind: string
  why_it_fits: string
  platform: PlatformId
  format: string
  pillar_id: string | null
}

function pillarFor(ctx: BrandContext, kit: Kit, text: string, used: Set<string>): ContextPillar | null {
  const match = kit.pillarFor(text, { exclude: [...used], fallback: false })
  if (match) return match
  return ctx.pillars.find((p) => !used.has(p.id)) ?? ctx.pillars[0] ?? null
}

/** Idea titles that were already shown (regenerate) are skipped. */
export function generateCollabIdeas(
  ctx: BrandContext,
  kit: Kit,
  options: { count: number; focus?: string | null; exclude?: readonly string[] }
): OfflineCollabIdea[] {
  const { ranked, own } = creatorDomains(ctx)
  const primary = ranked[0]
  const me = myTopic(ctx, kit, primary)
  const { aud, yourAud } = audienceOf(kit)
  const platforms = activePlatforms(ctx)
  const excluded = new Set((options.exclude ?? []).map((t) => t.trim().toLowerCase()))

  // Partners: adjacent niches of the creator's top niches, interleaved, never one of their own.
  const lists = ranked
    .filter((d, i) => i === 0 || own.has(d.id))
    .slice(0, 2)
    .map((d) => ADJACENT[d.id] ?? [])
  if (!lists.some((l) => l.length)) lists.push(FALLBACK_ADJACENT)
  const partners: Adjacent[] = []
  for (let i = 0; i < 6; i++) {
    for (const list of lists) {
      const next = list[i]
      if (next && !own.has(next.id) && !partners.some((p) => p.id === next.id)) partners.push(next)
    }
  }
  for (const extra of FALLBACK_ADJACENT) if (!own.has(extra.id) && !partners.some((p) => p.id === extra.id)) partners.push(extra)

  // A focus ("grow on TikTok", "brand deals") moves matching types first.
  const focus = (options.focus ?? "").toLowerCase()
  let types = typeOrder(platforms, ctx)
  const focusType: CollabType | null = /live/.test(focus)
    ? "joint_live"
    : /stitch|duet|tiktok/.test(focus)
      ? "duet_stitch"
      : /podcast|guest|show/.test(focus)
        ? "guesting"
        : /brand|deal|sponsor|income|kita/.test(focus)
          ? "group_brand_deal"
          : /giveaway|followers?/.test(focus)
            ? "giveaway"
            : null
  if (focusType) types = [focusType, ...types.filter((t) => t !== focusType)]

  // Regenerating starts from a different partner so the batch changes.
  const offset = excluded.size ? kit.rng.int(1, Math.max(1, partners.length - 1)) : 0
  const rotated = [...partners.slice(offset), ...partners.slice(0, offset)]

  const out: OfflineCollabIdea[] = []
  const usedTypes = new Set<CollabType>()
  const usedPillars = new Set<string>()
  const usedTitles = new Set<string>()
  const bridgeStart = kit.rng.int(0, BRIDGES.length - 1)
  // A second pass reuses partners (with a new type) only when there are fewer partners than ideas.
  for (let i = 0; out.length < options.count && i < rotated.length * 2; i++) {
    const partner = rotated[i % rotated.length]
    const domain = DOMAINS.get(partner.id)
    if (!domain) continue
    const preferred = (partner.types ?? []).find((t) => !usedTypes.has(t) && types.includes(t))
    const type = preferred ?? types.find((t) => !usedTypes.has(t)) ?? types[out.length % types.length]
    const niche = upperFirst(bi(kit, partner.niche ?? domain.topic))
    const them = shortNiche(niche)
    const vars = {
      me,
      them,
      A_them: upperFirst(`${article(them)} ${them}`),
      aud,
      your_aud: yourAud,
      their_aud: bi(kit, domain.audience),
      their_result: bi(kit, domain.result),
    }
    const titles = TITLES[type]
    let title = ""
    for (let v = 0; v < titles.length && !title; v++) {
      const candidate = upperFirst(fill(bi(kit, titles[(v + (excluded.size ? 1 : 0)) % titles.length]), vars))
      if (!usedTitles.has(candidate.toLowerCase()) && !excluded.has(candidate.toLowerCase())) title = candidate
    }
    if (!title) continue
    const platform = platformFor(type, platforms)
    const pillar = pillarFor(ctx, kit, `${them} ${me} ${title}`, usedPillars)
    const bridge = fill(bi(kit, BRIDGES[(bridgeStart + out.length) % BRIDGES.length]), vars)
    const reason = bi(kit, TYPE_REASONS[type])
    const kind = partner.kind ? bi(kit, partner.kind) : fill(bi(kit, KIND_TEMPLATES[out.length % KIND_TEMPLATES.length]), vars)
    const lookFor = fill(bi(kit, LOOK_FOR[(bridgeStart + out.length) % LOOK_FOR.length]), { platform: PLATFORMS[platform].label })
    out.push({
      type,
      title,
      partner_niche: niche,
      partner_kind: `${upperFirst(kind).replace(/[.\s]+$/, "")}. ${lookFor}`,
      why_it_fits: `${bridge} ${reason}`,
      platform,
      format: formatFor(ctx, kit, type, platform),
      pillar_id: pillar?.id ?? null,
    })
    usedTypes.add(type)
    usedTitles.add(title.toLowerCase())
    if (pillar) usedPillars.add(pillar.id)
  }
  return out
}

/* ---------------------------------- Pitch ---------------------------------- */

export interface PitchInput {
  type: CollabType
  title: string
  partner_name: string
  partner_handle: string
  partner_platform: PlatformId | null
  partner_niche: string
  collab_date: string | null
  previous: string
}

const PROPOSALS: Record<CollabType, Bi[]> = {
  duet_stitch: [
    [
      "My idea: I stitch one of your {them} videos with the {me} side of it and tag you, and you stitch my reply back — both audiences see both of us.",
      "Idea ko: i-stitch ko ang isa sa {them} videos mo gamit ang {me} side at i-tag kita, tapos i-stitch mo pabalik ang reply ko — makikita tayo ng parehong audience.",
    ],
    [
      "I'd love to do a duet series: you post the {them} tip, I add the {me} part your audience usually asks about next.",
      "Gusto ko sanang mag-duet series tayo: ikaw ang magpo-post ng {them} tip, ako ang magdadagdag ng {me} part na kadalasang tinatanong ng audience mo pagkatapos.",
    ],
  ],
  joint_live: [
    [
      "My idea: a 30-minute joint Live on {platform} — you take the {them} questions, I take the {me} ones, and the replay stays on both pages.",
      "Idea ko: 30-minute joint Live sa {platform} — ikaw sa {them} questions, ako sa {me}, at naka-save ang replay sa parehong page natin.",
    ],
    [
      "How about a joint Live Q&A on {platform}? Your audience gets answers on {me} they don't usually get from either of us alone.",
      "Joint Live Q&A kaya sa {platform}? Makakakuha ang audience mo ng sagot sa {me} na hindi nila madalas makuha sa isa lang sa atin.",
    ],
  ],
  guesting: [
    [
      "My idea: I join your show for one episode on {me} for your audience — or you join mine to talk {them}. I'll do the prep and send questions ahead.",
      "Idea ko: mag-guest ako sa show mo ng isang episode tungkol sa {me} para sa audience mo — o ikaw sa akin para sa {them}. Ako na ang bahala sa prep at questions.",
    ],
    [
      "Would you be up for a guest swap? One episode each: {me} on your channel, {them} on mine.",
      "Game ka ba sa guest swap? Tig-isang episode: {me} sa channel mo, {them} sa akin.",
    ],
  ],
  shoutout_swap: [
    [
      "My idea: a simple shoutout swap — I recommend you in my Stories, you do the same, and we each write the other's blurb so it sounds right.",
      "Idea ko: simpleng shoutout swap — ire-recommend kita sa Stories ko, ganoon ka rin, at tayo ang magsusulat ng blurb ng isa't isa para tama ang dating.",
    ],
    [
      "How about a Story takeover swap for a day? Your audience meets the {me} side, mine meets the {them} side.",
      "Story takeover swap kaya for a day? Makikilala ng audience mo ang {me} side, at ng akin ang {them} side.",
    ],
  ],
  giveaway: [
    [
      "My idea: a joint giveaway where each of us puts in one prize that's actually useful to our audiences. I'll handle the mechanics and the rules post.",
      "Idea ko: joint giveaway kung saan tig-isang prize tayo na talagang useful sa audience natin. Ako na sa mechanics at sa rules post.",
    ],
    [
      "What if we ran one giveaway together — a {me} prize from me, a {them} prize from you — so both audiences join?",
      "Paano kung isang giveaway tayo — {me} prize galing sa akin, {them} prize galing sa iyo — para sumali ang parehong audience?",
    ],
  ],
  co_created: [
    [
      "My idea: one co-created {format} we both publish — your part on {them}, mine on {me}. I can draft the first version.",
      "Idea ko: isang co-created {format} na pareho nating ipa-publish — ikaw sa {them}, ako sa {me}. Ako na ang gagawa ng first draft.",
    ],
    [
      "How about one collab post on both our feeds: “{me} or {them} — what to fix first”? You'd write your half, I'd handle the design.",
      "Isang collab post kaya sa feeds natin pareho: “{me} o {them} — ano ang uunahin?” Ikaw sa half mo, ako na sa design.",
    ],
  ],
  group_brand_deal: [
    [
      "My idea: we pitch brands together as a two-creator package — brands that want this audience pay more for both of us, and we split the outreach.",
      "Idea ko: sabay tayong mag-pitch sa brands bilang two-creator package — mas malaki ang bayad ng brands na gusto ang audience na 'to, at hati tayo sa outreach.",
    ],
    [
      "Would you be open to a joint brand pitch? A {me} + {them} package covers more of what these brands need than either of us alone.",
      "Open ka ba sa joint brand pitch? Mas buo ang {me} + {them} package para sa kailangan ng brands kaysa sa isa lang sa atin.",
    ],
  ],
  other: [
    [
      "My idea: {title} — built around what already works for your audience.",
      "Idea ko: {title} — naka-base sa kung ano na ang gumagana sa audience mo.",
    ],
    [
      "I have a collab in mind — {title} — and I think your audience would get a lot from the {me} side of it.",
      "May collab akong naiisip — {title} — at sa tingin ko malaki ang makukuha ng audience mo sa {me} side nito.",
    ],
  ],
}

const OVERLAPS: Bi[] = [
  [
    "We talk to the same kind of people about different things, so a collab gives your audience something new, not a repeat.",
    "Pareho tayo ng klase ng audience pero magkaiba ang tinuturo natin, kaya bago ang makukuha ng audience mo — hindi repeat.",
  ],
  [
    "Your {them} content and my {me} content reach the same people from different sides — nobody's competing for the same post.",
    "Naaabot ng {them} content mo at ng {me} content ko ang parehong tao mula sa magkaibang side — walang nag-aagawan.",
  ],
]

const NEXT_STEPS: Bi[] = [
  [
    "If you're open to it, I'll send a 3-line outline this week and we can pick a date from there.",
    "Kung open ka, magse-send ako ng 3-line outline this week at doon na tayo pumili ng date.",
  ],
  [
    "Can I send you a short outline? If it fits, we'll lock a date from there.",
    "Pwede ba akong mag-send ng short outline? Kung swak, mag-set tayo ng date.",
  ],
]

const CLOSINGS: Bi[] = [
  ["No pressure either way — thanks for reading!", "No pressure — salamat sa pagbasa!"],
  ["Thanks for your time!", "Salamat sa oras mo!"],
]

function firstNameOf(name: string): string {
  return clean(name).split(" ")[0] ?? ""
}

export function writeCollabPitch(ctx: BrandContext, kit: Kit, input: PitchInput): string {
  const { ranked } = creatorDomains(ctx)
  const me = myTopic(ctx, kit, ranked[0])
  const { aud } = audienceOf(kit)
  const them = shortNiche(input.partner_niche) || kit.say("your topic", "topic mo")
  const platform = input.partner_platform ?? activePlatforms(ctx)[0]
  const format = formatFor(ctx, kit, input.type, platform).toLowerCase()
  const vars = { me, them, aud, platform: PLATFORMS[platform].label, format, title: clean(input.title) || kit.say("a small collab", "isang maliit na collab") }

  const who = firstNameOf(input.partner_name) || clean(input.partner_handle)
  const greeting = who ? kit.say(`Hi ${who}!`, `Hi ${who}!`) : kit.say("Hi!", "Hello!")
  const brand = ctx.brand.brand_name.trim()
  const name = kit.firstName
  const intro = name
    ? kit.say(
        `I'm ${name}${brand ? ` from ${brand}` : ""} — I post about ${me} for ${aud}.`,
        `Ako si ${name}${brand ? ` ng ${brand}` : ""} — nagpo-post ako tungkol sa ${me} para sa ${aud}.`
      )
    : kit.say(`I make ${me} content for ${aud}.`, `Gumagawa ako ng ${me} content para sa ${aud}.`)

  const pick = (options: readonly Bi[], avoid: string) => {
    const start = kit.rng.int(0, options.length - 1)
    for (let i = 0; i < options.length; i++) {
      const text = fill(bi(kit, options[(start + i) % options.length]), vars)
      if (!avoid.includes(text)) return text
    }
    return fill(bi(kit, options[start]), vars)
  }
  const previous = input.previous
  const date = input.collab_date
    ? kit.say(
        `Would ${formatPitchDate(input.collab_date)} work for you? If yes, I'll send a short outline the day after.`,
        `Pwede ka ba sa ${formatPitchDate(input.collab_date)}? Kung oo, magse-send ako ng short outline kinabukasan.`
      )
    : null
  const parts = [
    greeting,
    intro,
    pick(OVERLAPS, previous),
    pick(PROPOSALS[input.type], previous),
    date ?? pick(NEXT_STEPS, previous),
    pick(CLOSINGS, previous),
  ]
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

function formatPitchDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()]
  return `${weekday}, ${months[m - 1]} ${d}`
}
