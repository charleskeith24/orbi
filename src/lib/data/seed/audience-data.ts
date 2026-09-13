/**
 * Problem Bank and Question Bank for the demo brand. Keys are referenced by
 * ideas and content items (`problem:<key>`); question links point at pieces
 * (`item`) or ideas (`idea`) by their seed keys.
 */
import type { PlatformId, ProblemCategory, QuestionStatus } from "@/lib/types"
import type { PersonaKey, PillarKey } from "./brand-data"

export interface ProblemSeed {
  key: string
  persona: PersonaKey
  category: ProblemCategory
  severity: number
  pillar: PillarKey | null
  problem: string
  notes?: string
}

export const PROBLEMS: ProblemSeed[] = [
  // Beginner
  { key: "boost", persona: "seller", category: "beginner", severity: 3, pillar: "education", problem: "Boosts posts instead of running proper campaigns, then concludes \"hindi gumagana ang ads\"" },
  { key: "min-budget", persona: "seller", category: "beginner", severity: 3, pillar: "education", problem: "Doesn't know the minimum realistic daily budget to test an ad properly" },
  { key: "first-client", persona: "seller", category: "beginner", severity: 4, pillar: "business", problem: "Can't land a first client without a portfolio or a single case study" },
  { key: "pricing-freelance", persona: "seller", category: "beginner", severity: 4, pillar: "business", problem: "Undercharges for ads management and burns out on ₱8k/month clients" },
  { key: "marketplace-vs-site", persona: "seller", category: "beginner", severity: 2, pillar: "education", problem: "Unsure whether to build on Shopee/Lazada or their own website first" },
  // Intermediate
  { key: "creative-testing", persona: "founder", category: "intermediate", severity: 4, pillar: "education", problem: "No structured creative testing — winning ads are found by accident, then run until they die", notes: "Came up in 6 of the last 10 audits." },
  { key: "ctr-obsession", persona: "lead", category: "intermediate", severity: 3, pillar: "education", problem: "Optimizes for cheap clicks and high CTR instead of profitable purchases" },
  { key: "retargeting", persona: "founder", category: "intermediate", severity: 3, pillar: "education", problem: "Retargeting audiences overlap and cannibalise each other's budget" },
  { key: "product-page", persona: "founder", category: "intermediate", severity: 4, pillar: "education", problem: "Product pages leak conversions: weak photos, no reviews, unclear shipping and COD info" },
  { key: "creative-fatigue", persona: "lead", category: "intermediate", severity: 3, pillar: "education", problem: "Creatives fatigue in 2–3 weeks and the team has nothing ready to replace them" },
  // Advanced
  { key: "scale-roas", persona: "founder", category: "advanced", severity: 5, pillar: "authority", problem: "ROAS collapses every time budget is increased by more than 20%" },
  { key: "attribution", persona: "founder", category: "advanced", severity: 4, pillar: "authority", problem: "Meta, TikTok, GA4 and the bank account all report different numbers" },
  { key: "contribution-margin", persona: "founder", category: "advanced", severity: 5, pillar: "authority", problem: "Doesn't know contribution margin per product, so a 'good' ROAS can still lose money", notes: "The single most common root cause behind 'profitable' brands running out of cash." },
  { key: "multi-channel", persona: "founder", category: "advanced", severity: 3, pillar: "authority", problem: "Expanding to TikTok Shop or a second market without the operations to support it" },
  { key: "low-aov", persona: "founder", category: "advanced", severity: 4, pillar: "education", problem: "Sells one product at one price — no bundles, no upsells, AOV stuck under ₱900" },
  // Emotional
  { key: "founder-bottleneck", persona: "founder", category: "emotional", severity: 5, pillar: "leadership", problem: "Feels guilty delegating and ends up approving every ad, caption and refund" },
  { key: "imposter-lead", persona: "lead", category: "emotional", severity: 4, pillar: "leadership", problem: "Imposter syndrome after being promoted to lead their former teammates" },
  { key: "burnout", persona: "founder", category: "emotional", severity: 4, pillar: "personal", problem: "Burned out from being 'always on' through 9.9, 11.11 and 12.12" },
  { key: "fear-wasting", persona: "seller", category: "emotional", severity: 4, pillar: "personal", problem: "Afraid to spend on ads again after losing savings on one bad campaign" },
  { key: "comparison", persona: "seller", category: "emotional", severity: 3, pillar: "personal", problem: "Compares early results with creators flexing ₱1M months and feels behind" },
  // Financial
  { key: "cashflow", persona: "founder", category: "financial", severity: 5, pillar: "journey", problem: "Cash tied up in inventory right before a big ad push" },
  { key: "agency-burn", persona: "founder", category: "financial", severity: 4, pillar: "authority", problem: "Paid an agency ₱80k a month for six months with no clear result or explanation" },
  { key: "rising-cpm", persona: "founder", category: "financial", severity: 4, pillar: "education", problem: "CPMs rise every quarter while AOV and margins stay flat" },
  { key: "budget-cuts", persona: "lead", category: "financial", severity: 3, pillar: "leadership", problem: "Marketing budget is the first thing cut whenever sales dip" },
  { key: "sale-event-budget", persona: "founder", category: "financial", severity: 3, pillar: "education", problem: "No budget plan for sale events — spends reactively on the day itself" },
  // Career
  { key: "promotion", persona: "lead", category: "career", severity: 3, pillar: "leadership", problem: "Wants to become head of marketing but doesn't know what leadership actually looks for" },
  { key: "ai-fear", persona: "lead", category: "career", severity: 4, pillar: "authority", problem: "Worried AI will make their role obsolete within a few years" },
  { key: "freelance-to-agency", persona: "seller", category: "career", severity: 3, pillar: "journey", problem: "Wants to grow from freelancer to a small agency but doesn't know when to make the first hire" },
  { key: "present-ceo", persona: "lead", category: "career", severity: 4, pillar: "leadership", problem: "Struggles to present marketing results in the language the CEO cares about: cash and margin" },
  { key: "skill-stack", persona: "seller", category: "career", severity: 2, pillar: "education", problem: "Doesn't know which skill to learn first — ads, copy, creatives or analytics" },
  // Business
  { key: "agency-vs-inhouse", persona: "founder", category: "business", severity: 4, pillar: "business", problem: "Can't decide between hiring an agency and building an in-house team" },
  { key: "hero-product", persona: "founder", category: "business", severity: 4, pillar: "authority", problem: "80% of revenue depends on one hero product and one hero ad" },
  { key: "offer-problem", persona: "founder", category: "business", severity: 5, pillar: "authority", problem: "Blames the ads when the real issue is a weak or unclear offer", notes: "Our most-shared topic. Worth a recurring angle." },
  { key: "brand-vs-performance", persona: "lead", category: "business", severity: 3, pillar: "authority", problem: "Leadership asks for 'brand awareness' but only ever judges sales" },
  { key: "retention", persona: "founder", category: "business", severity: 3, pillar: "education", problem: "Spends everything on acquisition — no retention or repeat-purchase plan" },
  // Operational
  { key: "no-sops", persona: "founder", category: "operational", severity: 5, pillar: "leadership", problem: "No SOPs — every launch depends on whoever happens to be online" },
  { key: "reporting-time", persona: "lead", category: "operational", severity: 4, pillar: "education", problem: "Team spends 6–8 hours a week building client and management reports by hand" },
  { key: "missed-deadlines", persona: "lead", category: "operational", severity: 4, pillar: "leadership", problem: "Content and campaigns consistently miss deadlines and nobody knows why" },
  { key: "unclear-kpis", persona: "lead", category: "operational", severity: 4, pillar: "leadership", problem: "Nobody on the team knows which number they personally own" },
  { key: "vague-briefs", persona: "lead", category: "operational", severity: 3, pillar: "education", problem: "Creative briefs are vague, so editors redo the same video three or four times" },
  { key: "long-meetings", persona: "founder", category: "operational", severity: 3, pillar: "leadership", problem: "Weekly meetings run two hours and end without decisions or owners" },
]

export interface QuestionSeed {
  question: string
  source: string
  platform: PlatformId | null
  topic: string
  frequency: number
  pillar: PillarKey | null
  persona: PersonaKey
  status: QuestionStatus
  lastAskedDaysAgo: number
  /** Piece key (answered) or idea key (idea_created). */
  item?: string
  idea?: string
}

export const QUESTIONS: QuestionSeed[] = [
  { question: "When should I increase my ad budget — and by how much?", source: "TikTok comments (asked by many)", platform: "tiktok", topic: "Scaling", frequency: 9, pillar: "education", persona: "founder", status: "answered", lastAskedDaysAgo: 1, item: "three-numbers" },
  { question: "Agency or in-house team — alin ang mas okay for a ₱2M/month brand?", source: "Founder DMs", platform: "facebook", topic: "Agency vs in-house", frequency: 7, pillar: "business", persona: "founder", status: "idea_created", lastAskedDaysAgo: 2, idea: "idea:se-agency-vs-inhouse" },
  { question: "Is boosting posts a waste of money?", source: "TikTok comments", platform: "tiktok", topic: "Boosting", frequency: 8, pillar: "education", persona: "seller", status: "answered", lastAskedDaysAgo: 3, item: "stop-boosting" },
  { question: "How do you give feedback without demotivating the team?", source: "LinkedIn comments", platform: "linkedin", topic: "Feedback", frequency: 5, pillar: "leadership", persona: "lead", status: "answered", lastAskedDaysAgo: 9, item: "feedback-script" },
  { question: "What ROAS should I target for a skincare brand?", source: "Instagram DM from a beauty founder", platform: "instagram", topic: "ROAS targets", frequency: 6, pillar: "authority", persona: "founder", status: "idea_created", lastAskedDaysAgo: 0, idea: "idea:roas-by-category" },
  { question: "What AI tools do you actually use inside the agency?", source: "Ask Me Anything #2", platform: "facebook", topic: "AI tools", frequency: 7, pillar: "education", persona: "lead", status: "idea_created", lastAskedDaysAgo: 4, idea: "idea:br-ai-ep1" },
  { question: "How much should I charge as a beginner ads freelancer?", source: "TikTok comments", platform: "tiktok", topic: "Pricing", frequency: 6, pillar: "business", persona: "seller", status: "idea_created", lastAskedDaysAgo: 1, idea: "idea:freelance-pricing" },
  { question: "Paano mag-present ng marketing results sa CEO na sales lang ang tinitingnan?", source: "LinkedIn DM from a brand manager", platform: "linkedin", topic: "Reporting", frequency: 5, pillar: "leadership", persona: "lead", status: "idea_created", lastAskedDaysAgo: 2, idea: "idea:ceo-results" },
  { question: "When do you start preparing ads for 11.11?", source: "Facebook comments", platform: "facebook", topic: "Sale events", frequency: 6, pillar: "education", persona: "founder", status: "idea_created", lastAskedDaysAgo: 1, idea: "idea:1111-prep" },
  { question: "How do you hire a good media buyer? Saan kayo naghahanap?", source: "LinkedIn comments", platform: "linkedin", topic: "Hiring", frequency: 4, pillar: "leadership", persona: "founder", status: "answered", lastAskedDaysAgo: 18, item: "hire-media-buyer" },
  { question: "My ROAS is 4 but I'm not making money. Why?", source: "Post in a sellers' Facebook group", platform: "facebook", topic: "Profitability", frequency: 8, pillar: "authority", persona: "founder", status: "answered", lastAskedDaysAgo: 5, item: "roas-vanity" },
  { question: "Should I start on Shopee or build my own Shopify store?", source: "TikTok comments", platform: "tiktok", topic: "Channels", frequency: 5, pillar: "education", persona: "seller", status: "idea_created", lastAskedDaysAgo: 3, idea: "idea:shopee-or-site" },
  { question: "What do you do when an ad account gets restricted in the middle of a sale?", source: "DM from a fashion founder", platform: "facebook", topic: "Ad accounts", frequency: 3, pillar: "education", persona: "founder", status: "answered", lastAskedDaysAgo: 26, item: "account-banned-1111" },
  { question: "How do you manage 24 people and still post every day?", source: "Instagram comments", platform: "instagram", topic: "Content system", frequency: 4, pillar: "personal", persona: "lead", status: "idea_created", lastAskedDaysAgo: 6, idea: "idea:batch-content" },
  { question: "How long before I should kill an ad?", source: "TikTok comments", platform: "tiktok", topic: "Testing", frequency: 7, pillar: "education", persona: "lead", status: "answered", lastAskedDaysAgo: 4, item: "mml-kill-ad" },
  { question: "Is it too late to start an e-commerce brand in the Philippines?", source: "Ask Me Anything #1", platform: "facebook", topic: "Market", frequency: 3, pillar: "journey", persona: "seller", status: "new", lastAskedDaysAgo: 12 },
  { question: "What's in your client onboarding checklist?", source: "LinkedIn comments", platform: "linkedin", topic: "Operations", frequency: 3, pillar: "education", persona: "lead", status: "answered", lastAskedDaysAgo: 20, item: "onboard-5-days" },
  { question: "How do you handle a client who wants results in two weeks?", source: "Instagram DM", platform: "instagram", topic: "Clients", frequency: 2, pillar: "business", persona: "seller", status: "dismissed", lastAskedDaysAgo: 33 },
  { question: "Do UGC creators really outperform studio-shot ads?", source: "TikTok comments", platform: "tiktok", topic: "Creatives", frequency: 5, pillar: "authority", persona: "founder", status: "idea_created", lastAskedDaysAgo: 2, idea: "idea:s-breakdown-ugc" },
  { question: "What should my first marketing hire be?", source: "Facebook comments", platform: "facebook", topic: "Hiring", frequency: 4, pillar: "leadership", persona: "founder", status: "idea_created", lastAskedDaysAgo: 7, idea: "idea:first-marketing-hire" },
  { question: "Paano mag-set ng KPIs para sa content team?", source: "LinkedIn comments", platform: "linkedin", topic: "KPIs", frequency: 6, pillar: "leadership", persona: "lead", status: "idea_created", lastAskedDaysAgo: 3, idea: "idea:content-kpis" },
  { question: "Paano ko malalaman kung ads ang problema o 'yung product mismo?", source: "Comments on the offer post", platform: "facebook", topic: "Diagnosis", frequency: 5, pillar: "authority", persona: "founder", status: "new", lastAskedDaysAgo: 1 },
  { question: "How do I bring my COD return rate down without losing orders?", source: "Sellers' Facebook group", platform: "facebook", topic: "COD returns", frequency: 6, pillar: "education", persona: "seller", status: "new", lastAskedDaysAgo: 2 },
  { question: "Worth it pa ba mag-TikTok Shop kung malakas na kami sa Shopee?", source: "TikTok comments", platform: "tiktok", topic: "TikTok Shop", frequency: 4, pillar: "authority", persona: "founder", status: "new", lastAskedDaysAgo: 0 },
]
