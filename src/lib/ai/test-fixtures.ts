/** Shared inputs for the AI layer tests (demo workspace on a fixed day). Not imported by app code. */
import { REPURPOSE_TYPE_IDS } from "@/lib/constants"
import { createDemoDatabase } from "@/lib/data/seed"
import type { RepurposeType } from "@/lib/types"
import { buildBrandContext } from "./context"
import {
  buildBriefInput,
  buildMonthlyReviewInput,
  buildRepurposeInput,
  buildScoreIdeaInput,
  buildScriptInput,
  buildStrategistInput,
  buildWeeklyPlanInput,
  buildWeeklyReviewInput,
  buildWhatToPostInput,
  buildWinnerReplicationInput,
} from "./inputs"
import type { AiTaskName } from "./tasks"

export const NOW = new Date(2026, 8, 11, 10, 0, 0)
export const db = createDemoDatabase("demo-user", NOW)
export const ctx = buildBrandContext(db, NOW)
export const winnerId = ctx.winners[0]?.item_id ?? db.content_items.find((i) => i.published_at)!.id
export const draftItem = db.content_items.find((i) => i.stage === "scripting") ?? db.content_items[0]
export const ALL_TARGETS = REPURPOSE_TYPE_IDS as RepurposeType[]

export const INPUTS: Record<AiTaskName, unknown> = {
  capture_idea: { text: "I realized most business owners manage content based on inspiration instead of systems." },
  generate_ideas: { count: 12 },
  generate_hooks: { topic: "creative testing for small ad budgets", count: 8 },
  score_idea: buildScoreIdeaInput(db, db.content_ideas[0]),
  content_brief: buildBriefInput(db, draftItem.id),
  generate_script: buildScriptInput(db, draftItem.id, "short_video", [db.stories[0].id]),
  score_content: {
    text: "Most founders scale ads before they know their margins.\n\nLast month a client asked us to double spend. We checked contribution margin first: ₱180 per order. At their CPA, every extra sale lost money.\n\n1. Know your margin per product\n2. Set a max CPA from it\n3. Only then raise budget 20% at a time\n\nComment “MARGIN” and I'll send you the calculator.",
    format: "facebook_post",
    platform: "facebook",
  },
  repurpose: buildRepurposeInput(db, winnerId, ALL_TARGETS, NOW),
  experience_to_content: {
    experience:
      "Yesterday our biggest client called to say they're pausing all ads for a month. I panicked at first because they're 30% of our revenue. Then I sat down with the team and we mapped every account by margin. We decided to double down on two smaller clients and offered the paused client a free audit instead. The lesson: never let one client be more than 20% of revenue.",
  },
  analyze_reference: {
    content:
      "I spent ₱2M on ads last year. Here's what I'd never do again:\n\n1. Scale before fixing the offer\n2. Hire an agency without a scorecard\n3. Trust ROAS without margins\n\nMost founders learn this the expensive way. You don't have to.\n\nWhich one hurt you the most?",
    platform: "facebook",
  },
  adapt_reference: {
    analysis: {
      hook: "“I spent ₱2M on ads last year.” — a specific-number claim.",
      structure: ["Hook: specific-number claim", "List / steps (3 lines): scannable steps or items", "Turn: challenges the obvious answer", "Question: pulls the reader in"],
      angle: "Listicle / checklist",
      psychology: "It pulls specificity — a concrete number makes the claim feel real; and loss aversion.",
      why_it_works: "Number-led hook, scannable list, ends on a question.",
      patterns: ["Open with a number", "End on a question"],
    },
    platform: "linkedin",
  },
  what_to_post: buildWhatToPostInput(db, NOW),
  winner_replication: buildWinnerReplicationInput(db, winnerId, NOW),
  weekly_review: buildWeeklyReviewInput(db, new Date(2026, 7, 31), NOW, "Leadership content"),
  monthly_review: buildMonthlyReviewInput(db, new Date(2026, 7, 1), NOW),
  weekly_plan: buildWeeklyPlanInput(db, NOW, { focus: "Leadership and hiring" }),
  strategist_chat: buildStrategistInput(db, NOW, [{ role: "user", content: "What should I post today?" }]),
  onboarding_strategy: {
    name: "Ana Cruz",
    role: "Founder, Crumb Lab",
    industry: "Home baking business coaching",
    years_experience: 6,
    expertise_areas: ["Pricing", "Instagram marketing", "Small business systems"],
    audience: "home bakers",
    result: "turn their hobby into a profitable business",
    method: "simple pricing and marketing systems",
    audience_problems: ["Underprices cakes and works for free", "Doesn't know how to get orders outside friends and family"],
    platforms: ["instagram", "facebook", "tiktok"],
    goals: ["authority", "leads"],
    language: "english",
    idea_count: 30,
  },
  niche_discovery: {
    language: "taglish",
    name: "Mika Reyes",
    interests: ["Personal finance", "Ipon challenges", "Side hustles", "K-drama"],
    skills: ["Bookkeeping", "BIR & taxes", "Excel"],
    help_requests: "Paano mag-register sa BIR as freelancer, paano mag-budget ng sahod",
    years_experience: 6,
    proof: "Natulungan ko ang 40+ freelancers mag-register at mag-file sa BIR",
    audiences: ["Freelancers", "Young professionals"],
    audience_level: "Beginner",
    audience_stage: "Bagong freelancer, first year pa lang, walang idea sa taxes",
    audience_goal: "Maging tax-compliant at makaipon kahit irregular ang income",
    audience_problems: ["Hindi alam paano mag-file ng BIR", "Walang ipon kahit malaki ang kita", "Takot sa tax penalties"],
    aims: ["clients", "products"],
  },
  collab_ideas: { count: 5 },
  collab_pitch: {
    type: "joint_live",
    title: "Joint Live: COD vs prepaid for new sellers",
    partner_name: "Tina Ramos",
    partner_handle: "@tinasells.ph",
    partner_platform: "facebook",
    partner_niche: "Seller logistics",
    collab_date: "2026-09-24",
  },
}
