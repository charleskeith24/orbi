/**
 * Campaigns, series, experiments, reviews and engagement-log notes.
 * Dates are day offsets from today; item references are piece keys.
 */
import type {
  CampaignStatus,
  CategoricalColor,
  ExperimentMetric,
  ExperimentStatus,
  ExperimentWinner,
  GoalCategory,
  PlatformId,
  SeriesFrequency,
} from "@/lib/types"
import type { PersonaKey, PillarKey } from "./brand-data"
import type { CampaignKey, SeriesKey } from "./piece-types"
import type { FormatName, TagName } from "./starter-data"

export const CAMPAIGNS: Record<
  CampaignKey,
  {
    name: string
    objective: string
    description: string
    start: number
    end: number
    persona: PersonaKey
    pillar: PillarKey
    goal: GoalCategory
    platforms: PlatformId[]
    message: string
    status: CampaignStatus
    target: number
    color: CategoricalColor
    tags: TagName[]
  }
> = {
  leadership30: {
    name: "30 Days of Leadership",
    objective: "Establish Raf as a credible leadership voice for marketing leads and founders, and restart a consistent posting rhythm after the slump.",
    description: "One leadership lesson a day for 30 days from running a 24-person agency: hiring, feedback, accountability, delegation and hard client decisions.",
    start: -66,
    end: -36,
    persona: "lead",
    pillar: "leadership",
    goal: "authority",
    platforms: ["linkedin", "facebook", "tiktok", "instagram"],
    message: "Great teams are built by clear systems and leaders who go first.",
    status: "completed",
    target: 20,
    color: "violet",
    tags: ["leadership", "team"],
  },
  "scale-sprint": {
    name: "Q3 E-commerce Scale Sprint",
    objective: "Generate 25 qualified audit leads by documenting six weeks of scaling three e-commerce brands in public.",
    description: "A public, week-by-week sprint: the plan, the numbers, what's working and what isn't — ending with the free scaling audit offer.",
    start: -14,
    end: 28,
    persona: "founder",
    pillar: "education",
    goal: "leads",
    platforms: ["tiktok", "facebook", "linkedin", "instagram", "youtube"],
    message: "Scaling isn't raising budgets. It's removing bottlenecks.",
    status: "active",
    target: 36,
    color: "red",
    tags: ["ecommerce", "growth"],
  },
  "ai-small-teams": {
    name: "AI for Small Teams",
    objective: "Become the practical, non-hype voice on AI for marketing teams of 3–10 people and grow the newsletter list.",
    description: "A four-week series on what small marketing teams should automate first, with the workflows and prompts we actually use at Northbound.",
    start: 21,
    end: 49,
    persona: "lead",
    pillar: "education",
    goal: "authority",
    platforms: ["tiktok", "linkedin", "instagram"],
    message: "Automate the boring work so your team can do the thinking work.",
    status: "planning",
    target: 12,
    color: "aqua",
    tags: ["ai", "team"],
  },
}

export const SERIES: Record<
  SeriesKey,
  {
    name: string
    description: string
    frequency: SeriesFrequency
    day: number
    platforms: PlatformId[]
    pillar: PillarKey
    format: FormatName
    hook: string
  }
> = {
  mml: {
    name: "Monday Marketing Lesson",
    description: "One practical performance-marketing lesson every Monday, under 60 seconds, that a founder or junior marketer can apply that week.",
    frequency: "weekly",
    day: 1,
    platforms: ["tiktok", "facebook"],
    pillar: "education",
    format: "Short-form Video",
    hook: "Monday Marketing Lesson: ___ (in 60 seconds).",
  },
  "founder-diary": {
    name: "Founder Diary",
    description: "Unpolished Friday-night updates from inside Northbound: decisions, setbacks, wins and what I'm thinking about.",
    frequency: "weekly",
    day: 5,
    platforms: ["tiktok", "facebook"],
    pillar: "journey",
    format: "Behind-the-scenes",
    hook: "Founder Diary. This week ___.",
  },
  wltw: {
    name: "What I Learned This Week",
    description: "Sunday reflection: one lesson from the week — about business, leadership or life — told through a specific moment.",
    frequency: "weekly",
    day: 0,
    platforms: ["facebook"],
    pillar: "personal",
    format: "Facebook Post",
    hook: "What I learned this week: ___.",
  },
  breakdown: {
    name: "Marketing Breakdown",
    description: "Every other Wednesday, a full case-study breakdown of one client result: the starting point, the bottlenecks, the numbers.",
    frequency: "biweekly",
    day: 3,
    platforms: ["youtube"],
    pillar: "authority",
    format: "Long-form Video",
    hook: "₱___ to ₱___ in ___. Here's exactly what changed.",
  },
  ama: {
    name: "Ask Me Anything",
    description: "Monthly 45-minute Facebook Live answering questions on ads, scaling, hiring and running an agency.",
    frequency: "monthly",
    day: 4,
    platforms: ["facebook"],
    pillar: "authority",
    format: "Live Video",
    hook: "Ask me anything about ___ — live for 45 minutes.",
  },
}

export interface ExperimentSeed {
  template: string
  name: string
  hypothesis: string
  variantA: string
  variantB: string
  metric: ExperimentMetric
  status: ExperimentStatus
  start: number | null
  end: number | null
  /** Item refs: piece key, optionally ":<platform index>". */
  a: string[]
  b: string[]
  result?: string
  winner?: ExperimentWinner
  lesson?: string
}

export const EXPERIMENTS: ExperimentSeed[] = [
  {
    template: "Short hooks vs long hooks",
    name: "Short hooks vs long hooks on TikTok",
    hypothesis: "Hooks under 8 words hold attention better than long setup hooks for our TikTok audience.",
    variantA: "Hook under 8 words",
    variantB: "Hook of 15+ words",
    metric: "avg_retention",
    status: "completed",
    start: -100,
    end: -60,
    a: ["stop-boosting", "team-not-lazy", "micromanaging"],
    b: ["viral-product-dies", "account-banned-1111", "automate-reporting"],
    result: "Short hooks averaged clearly higher retention across three posts each. The long hooks only held up when the first five words carried a number.",
    winner: "a",
    lesson: "Lead with the claim, not the context. If a long hook is necessary, put the number or the stakes in the first five words.",
  },
  {
    template: "Tagalog vs English",
    name: "Taglish vs English on Facebook",
    hypothesis: "Taglish posts feel more native to our Facebook audience and earn a higher engagement rate.",
    variantA: "Taglish",
    variantB: "English",
    metric: "engagement_rate",
    status: "completed",
    start: -70,
    end: -42,
    a: ["five-sops", "managing-former-peers", "fired-client-fb"],
    b: ["monday-15min:1", "hire-changed:1", "wltw-leaders-go-first"],
    result: "Taglish posts earned a clearly higher engagement rate and more comments per post. The English posts still did fine on professional topics like meetings and hiring.",
    winner: "a",
    lesson: "Default to Taglish on Facebook and TikTok; keep English for LinkedIn and YouTube titles.",
  },
  {
    template: "Direct CTA vs soft CTA",
    name: "Direct CTA vs soft CTA for audit leads",
    hypothesis: "A direct 'DM AUDIT' CTA creates more leads than a soft 'comment for the checklist' CTA without hurting reach.",
    variantA: "Direct CTA (DM / book)",
    variantB: "Soft CTA (follow / save)",
    metric: "leads",
    status: "running",
    start: -10,
    end: 18,
    a: ["offer-case-study", "s-audit-offer"],
    b: ["scale-checklist-lead", "forecast-sale:1"],
  },
  {
    template: "Talking-head vs B-roll",
    name: "Talking-head vs B-roll for Founder Diary",
    hypothesis: "Talking-head Founder Diary episodes build more trust and comments than B-roll with voiceover.",
    variantA: "Talking-head",
    variantB: "B-roll with voiceover",
    metric: "comments",
    status: "planned",
    start: 7,
    end: 35,
    a: [],
    b: [],
  },
  {
    template: "30-second vs 60-second videos",
    name: "30-second vs 60-second Monday lessons",
    hypothesis: "Monday Marketing Lessons under 30 seconds get more completed views than 60-second versions.",
    variantA: "~30 seconds",
    variantB: "~60 seconds",
    metric: "views",
    status: "planned",
    start: 14,
    end: 42,
    a: [],
    b: [],
  },
]

export interface WeeklyReviewSeed {
  weeksAgo: number
  focus: string
  what_worked: string
  what_didnt: string
  learned: string
  double_down: string
  stop: string
  test_next: string
}

export const WEEKLY_REVIEWS: WeeklyReviewSeed[] = [
  {
    weeksAgo: 1,
    focus: "Turn Scale Sprint attention into audit leads",
    what_worked: "The SCALE checklist post turned sprint viewers into checklist requests, and the LinkedIn case study built from the offer breakout started real audit conversations. The sale-event forecast walkthrough was saved by a lot of marketing leads.",
    what_didnt: "The inventory carousel underperformed on Instagram without a matching Reel. Two posts went out late because edits sat in review for two days.",
    learned: "Proof converts: posts with real before/after numbers bring warmer inquiries than tips. People also follow a story that has a next episode — the sprint diary keeps them coming back.",
    double_down: "Founder Diary sprint updates every Friday, and one proof-led BOFU post every week.",
    stop: "Posting carousels on Instagram without a Reel teaser. Leaving edits in review for more than 24 hours.",
    test_next: "Direct 'DM AUDIT' CTA vs the soft 'comment for the checklist' CTA.",
  },
  {
    weeksAgo: 2,
    focus: "Launch the Scale Sprint without dropping follow-ups to our winners",
    what_worked: "The sprint kickoff set clear expectations and pulled strong comments. 'Scaling isn't raising budgets' beat our LinkedIn average by a wide margin. The creative testing framework carousel hit about twice our usual Instagram reach, and the skincare breakdown on YouTube became our top source of audit inquiries.",
    what_didnt: "We shipped the kickoff and the skincare breakdown in the same week, so the breakdown's Shorts cut-downs slipped. 'Fire your agency' sparked a long debate on LinkedIn but very few inquiries.",
    learned: "Named frameworks with a clear order of operations get saved. Contrarian TOFU posts start conversations, not sales calls — they need a proof post and an offer behind them.",
    double_down: "Case studies with real numbers, cut into Shorts and carousels within the same week.",
    stop: "Launching two big pieces in one week without a repurposing plan.",
    test_next: "A 'Fix This Ad' teardown format using follower-submitted ads.",
  },
  {
    weeksAgo: 3,
    focus: "Answer the most-asked questions from the Question Bank",
    what_worked: "'3 numbers I check before I touch ad budget' became a TikTok winner — it answered our most frequent question directly. 'Offer, part 2' kept the offer conversation going and pulled dozens of worksheet requests.",
    what_didnt: "The profit-share case study was too long for LinkedIn; people engaged with the first half only. The 'bad week' Founder Diary had a hook that described a mood instead of a moment.",
    learned: "Question Bank topics asked 7+ times are our most reliable source of winners. Hooks need a moment, not a mood.",
    double_down: "Turn every high-frequency question into a short video within a week of it being asked.",
    stop: "LinkedIn posts over 250 words without a clear list or framework.",
    test_next: "Short hooks under 8 words on every TikTok this week.",
  },
]

export const MONTHLY_REVIEW = {
  summary:
    "A strong month for authority. 'Your ads aren't the problem. Your offer is.' became our biggest Facebook post ever and the ₱380k story kept paying off through its Facebook, LinkedIn and Shorts versions. 30 Days of Leadership finished with the strongest LinkedIn growth we've had. Weak spots: Leadership fell to about 10% of posts (target 15%) once the campaign ended, and posting dipped below target early in the month when edits stalled in review.",
  continue_doing: [
    "Story-led Journey content with real peso amounts",
    "Repurposing every winner into 3+ formats within two weeks",
    "Monday Marketing Lessons — consistent and reliable",
    "Answering high-frequency Question Bank topics",
  ],
  increase: [
    "Leadership posts — keep the campaign's momentum instead of dropping to a few a month",
    "Case studies with numbers — they generate the most audit inquiries",
    "YouTube breakdowns: fewer views, highest lead quality",
  ],
  reduce: [
    "Standalone Instagram carousels without a Reel",
    "Generic educational tips without a story or proof",
  ],
  stop: [
    "Posting on X until the core five platforms are consistent",
    "Letting edits wait more than 24 hours in review",
  ],
  experiment: [
    "Direct CTA vs soft CTA for audit leads",
    "Talking-head vs B-roll Founder Diary episodes",
    "A 'Fix This Ad' teardown series",
  ],
}

/** Rotating notes for engagement logs (not every day has one). */
export const ENGAGEMENT_NOTES = [
  "Three founders asked about agency vs in-house in DMs — added to the Question Bank.",
  "Replied to every comment on the sprint video within the first hour.",
  "Good conversation with a skincare founder in the comments; moved to DM.",
  "Commented on five SEA e-commerce operators' posts before 9 a.m.",
  "Busy client day — only cleared DMs.",
  "Collected two questions about COD returns for a future Monday lesson.",
  "Live AMA follow-ups: answered 14 questions that didn't fit in the stream.",
  "Kat helped triage comments on the Facebook post.",
  "Captured an idea from a DM about AI briefs for editors.",
]
