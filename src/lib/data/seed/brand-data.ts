/**
 * Demo brand: a fictional Manila-based founder of an e-commerce growth agency.
 * Every Brand HQ, pillar and persona field is filled with specific, opinionated copy.
 */
import type { CategoricalColor, InsertRow, PlatformId } from "@/lib/types"

export const OWNER = "Raf"
export const TEAM = {
  raf: "Raf",
  editor: "Bea (Editor)",
  video: "Jomar (Video)",
  copy: "Kat (Copy)",
} as const

export const BRAND: InsertRow<"brand_profiles"> = {
  name: "Rafael \"Raf\" Mendoza",
  brand_name: "Northbound Commerce",
  role: "Founder & CEO, Northbound Commerce",
  industry: "E-commerce growth & performance advertising",
  expertise_summary:
    "11 years running paid acquisition and growth for Southeast Asian e-commerce brands. Built Northbound from a two-person freelance setup into a 24-person agency managing eight figures in yearly ad spend across Meta, TikTok and Google.",
  years_experience: 11,
  location: "Pasig City, Metro Manila, Philippines",
  main_platforms: ["facebook", "tiktok", "linkedin", "instagram", "youtube"],
  who_am_i:
    "I'm Raf — I started running Facebook ads for my tita's online shop in 2015 and never stopped. Today I lead a 24-person team at Northbound Commerce that manages growth for e-commerce brands in the Philippines and the rest of Southeast Asia. I'm not a guru. I'm an operator who has burned budget, lost clients, fixed broken teams and learned what actually scales.",
  known_for:
    "Turning chaotic ad accounts into predictable growth systems. Saying the uncomfortable thing about offers, margins and team accountability. Explaining performance marketing in plain Taglish.",
  problems_solved:
    "E-commerce founders stuck at the same revenue for months, ad costs rising while ROAS falls, teams that depend on the founder for every decision, and marketing leads who can't explain their numbers to the CEO.",
  why_listen:
    "Everything I share comes from client accounts and my own agency, not theory. We've managed more than ₱400M in ad spend, scaled brands from ₱800k to ₱4M+ a month, and I share the failures as openly as the wins — including the ₱380k mistake that almost ended a client relationship.",
  point_of_view:
    "Systems beat inspiration. Most ad problems are offer problems. Scaling isn't raising budgets — it's removing bottlenecks. Profit is a strategy, not what's left over. A team that can't work without you isn't a team yet. AI won't replace marketers; marketers who use AI will replace those who don't.",
  positioning_audience: "e-commerce founders and marketing leads in Southeast Asia",
  positioning_result: "build predictable, profitable growth without burning cash or their team",
  positioning_method: "performance-marketing systems, AI-assisted operations and accountable teams",
  expertise_areas: [
    "E-commerce",
    "Advertising",
    "Digital Marketing",
    "Growth",
    "Leadership",
    "Business Systems",
    "AI",
    "Team Management",
    "Entrepreneurship",
  ],
  personality_traits: ["direct", "strategic", "practical", "story_driven", "authentic"],
  language: "taglish",
  tones: ["conversational", "educational", "challenging"],
  always_do:
    "Use real numbers (₱, %, days) whenever possible. Show the system, not just the result. Admit what I got wrong. Give one clear action the viewer can take today. Credit the team for wins. Explain jargon in plain Taglish.",
  never_do:
    "Promise overnight results or 'passive income'. Flex revenue without context. Name or shame clients. Bash competitors. Use stock motivational quotes. Post without knowing who it's for.",
  phrases_used: [
    "Systems over hype",
    "Let's be real",
    "Kaya natin 'to",
    "Profit muna bago scale",
    "Nasaan ang bottleneck?",
    "Offer first, ads second",
    "Walang shortcut, may sistema",
  ],
  phrases_avoid: ["guru", "hack", "passive income", "10x overnight", "secret formula", "crush it", "hustle harder"],
  cta_style:
    "Soft by default — comment a keyword for the template or send me a DM with your situation. Direct only on BOFU posts: book a free scaling audit, limited slots.",
  storytelling_style:
    "Start in the middle of the moment (the Slack message, the call, the dashboard at 11 p.m.), name the real stakes in pesos or people, admit my part in it, then pull out one lesson founders can use this week.",
  onboarding_completed: true,
}

export type PillarKey = "education" | "authority" | "journey" | "leadership" | "personal" | "business"
export const PILLAR_KEYS: PillarKey[] = ["education", "authority", "journey", "leadership", "personal", "business"]

/** Brand-specific copy layered over PILLAR_PRESETS (same order). */
export const PILLAR_COPY: Record<PillarKey, { description: string; examples: string[] }> = {
  education: {
    description:
      "Teach the performance-marketing and e-commerce fundamentals founders skip: offers, testing, metrics, budgets and funnels — in plain Taglish.",
    examples: [
      "Creative testing frameworks",
      "The numbers to check before scaling",
      "Ad account structure walkthroughs",
      "Product page and checkout fixes",
      "AI tools for small marketing teams",
      "Budget planning for sale events",
    ],
  },
  authority: {
    description:
      "Prove the method works: client breakdowns, strong opinions on the industry and analysis only an operator with 11 years of accounts can give.",
    examples: [
      "Marketing Breakdown case studies",
      "Contrarian takes on ROAS, agencies and growth",
      "Predictions on AI and e-commerce in SEA",
      "What the best brands we manage do differently",
      "Industry myths, debunked with data",
    ],
  },
  journey: {
    description:
      "Document building Northbound in real time — the wins, the ₱380k mistakes, the cash-flow months and the experiments.",
    examples: [
      "Founder Diary episodes",
      "Failures and what they cost",
      "Behind the scenes of client sprints",
      "Decisions I'm wrestling with this week",
      "Agency milestones and setbacks",
    ],
  },
  leadership: {
    description:
      "How we lead a 24-person team: hiring, feedback, accountability, delegation and building a team that doesn't need the founder in every decision.",
    examples: [
      "Hiring and firing lessons",
      "Meeting and feedback templates",
      "Team structure and KPIs",
      "Delegation and accountability",
      "Leading former peers",
    ],
  },
  personal: {
    description:
      "The human behind the agency: values, routines, family, faith in hard work and the lessons that don't fit in a dashboard.",
    examples: [
      "What I Learned This Week reflections",
      "Routines and weekly resets",
      "Lessons from my parents' sari-sari store",
      "Burnout and recovery",
      "Beliefs about work and success",
    ],
  },
  business: {
    description:
      "Conversion content that turns trust into clients: the free scaling audit, lead magnets, hiring posts and partnership offers.",
    examples: [
      "Free scaling audit offers",
      "Lead magnets (checklists, templates)",
      "Case-study-backed service posts",
      "Hiring announcements",
      "Partnership invitations",
    ],
  },
}

export type PersonaKey = "founder" | "lead" | "seller"
export const PERSONA_KEYS: PersonaKey[] = ["founder", "lead", "seller"]

export const PERSONAS: Record<PersonaKey, InsertRow<"audience_personas"> & { color: CategoricalColor; platforms: PlatformId[] }> = {
  founder: {
    name: "Scaling E-commerce Founder",
    age_range: "28–42",
    profession: "Founder / owner of a DTC or marketplace brand",
    industry: "E-commerce (beauty, fashion, home, food, pet supplies)",
    experience_level: "3–7 years in business, ₱1M–₱10M monthly revenue",
    location: "Metro Manila, Cebu, Davao — plus founders across SEA",
    goals: [
      "Scale past a revenue plateau without killing margins",
      "Make ad spend predictable instead of a monthly gamble",
      "Build a marketing team that runs without them",
      "Prepare the business for big sale events (9.9, 11.11, 12.12) calmly",
      "Eventually open a second channel or market",
    ],
    problems: [
      "ROAS drops every time they increase budget",
      "Relies on one hero product and one hero ad",
      "No reliable numbers — dashboards disagree with the bank account",
      "Burned by agencies that reported vanity metrics",
      "Still approves every ad and caption personally",
    ],
    fears: [
      "Spending ₱500k on ads and having nothing to show for it",
      "Cash flow crunch after a big inventory order",
      "Losing their best marketer and starting from zero",
      "Being copied by cheaper competitors on the marketplaces",
    ],
    frustrations: [
      "\"Sabi ng agency okay ang ROAS, pero bakit walang pera?\"",
      "Every guru has a different 'secret' strategy",
      "Team waits for instructions instead of taking ownership",
      "Ad account restrictions right before a sale",
      "Paying for tools nobody uses",
    ],
    aspirations: [
      "A business that grows 20–30% a year predictably",
      "Weekends without checking Ads Manager",
      "Being respected as a real brand, not just a Shopee store",
      "A leadership team they trust",
    ],
    questions: [
      "When is the right time to scale ad budget?",
      "Should I hire an agency or build in-house?",
      "What ROAS should I actually target?",
      "How do I know if the problem is my ads or my product?",
      "How much should I spend on ads per month?",
    ],
    objections: [
      "\"Na-scam na kami ng agency dati.\"",
      "\"Iba ang industry namin, hindi 'yan uubra sa amin.\"",
      "\"Wala pa kaming budget for that.\"",
      "\"Kaya ko naman 'to mag-isa.\"",
    ],
    buying_motivation:
      "Buys when a plateau starts hurting cash flow and they find someone who shows real numbers, explains the system and doesn't overpromise. Trust comes from seeing the thinking for months before the first call.",
    content_consumed: [
      "Founder podcasts and YouTube breakdowns",
      "Facebook groups for online sellers",
      "LinkedIn posts from operators",
      "Short TikTok tips on ads and e-commerce",
      "Case studies with real numbers",
    ],
    platforms: ["facebook", "tiktok", "youtube", "linkedin"],
    influencers: [
      "Global DTC operator podcasts",
      "Business book authors on systems and delegation",
      "Local business news pages",
      "Shopify and Meta official learning content",
      "Filipino founder communities and meetups",
    ],
    language_used: [
      "scale",
      "ROAS",
      "\"ang mahal na ng ads\"",
      "\"plateau na kami\"",
      "\"sold out\"",
      "\"hero product\"",
      "\"sa Shopee/Lazada ok, pero sa website hindi\"",
    ],
    is_primary: true,
    color: "blue",
    notes: "Our core client profile. Content should make them feel understood first, then show the system.",
  },
  lead: {
    name: "Marketing Team Lead",
    age_range: "25–35",
    profession: "Marketing manager / head of growth in an SME or brand",
    industry: "Retail, e-commerce, consumer brands, local startups",
    experience_level: "4–8 years in marketing, newly managing 2–8 people",
    location: "Metro Manila, BGC/Ortigas/Makati offices, hybrid set-ups",
    goals: [
      "Hit targets without working every weekend",
      "Explain marketing results confidently to the CEO",
      "Build a team that owns their numbers",
      "Get promoted to head of marketing",
      "Use AI to do more with the same headcount",
    ],
    problems: [
      "Stuck between a founder who wants sales now and a team that needs direction",
      "No clear KPIs per role",
      "Too much time building reports, too little time thinking",
      "First time managing former teammates",
      "Budget cut every time results dip",
    ],
    fears: [
      "Being blamed for results they don't fully control",
      "Losing their best people to better-paying brands",
      "Falling behind on AI and new platforms",
      "Looking incompetent in front of leadership",
    ],
    frustrations: [
      "\"Gusto ni boss viral, pero ayaw mag-invest sa creatives.\"",
      "Every week has a new priority",
      "Team makes the same mistakes repeatedly",
      "Agencies and freelancers who miss deadlines",
      "Reports that nobody reads",
    ],
    aspirations: [
      "Lead a high-performing team that people want to join",
      "Be seen as a strategic partner, not an order-taker",
      "Own the growth number of a real brand",
      "Speak at industry events someday",
    ],
    questions: [
      "What KPIs should each marketing role have?",
      "How do I give feedback without demotivating my team?",
      "How do I present marketing results to a CEO?",
      "Which AI tools are actually worth it for a small team?",
      "How do I say no to the founder's random requests?",
    ],
    objections: [
      "\"Wala akong authority to change the process.\"",
      "\"Walang oras for new systems, ang dami naming deliverables.\"",
      "\"Our company culture is different.\"",
      "\"Hindi pa ako ready mag-lead.\"",
    ],
    buying_motivation:
      "Buys templates, trainings and agency support when it makes them look competent to leadership and saves their team hours every week. Often the internal champion who brings Northbound to the founder.",
    content_consumed: [
      "LinkedIn carousels and posts",
      "Marketing newsletters",
      "YouTube tutorials on ads and analytics",
      "Leadership and management books",
      "Industry webinars",
    ],
    platforms: ["linkedin", "instagram", "youtube", "facebook"],
    influencers: [
      "B2B and growth marketing newsletters",
      "Management and leadership authors",
      "Ad platform official blogs",
      "Local marketing associations and communities",
    ],
    language_used: [
      "KPIs",
      "\"deliverables\"",
      "\"ang dami kong meetings\"",
      "\"alignment\"",
      "\"ownership\"",
      "\"bandwidth\"",
    ],
    is_primary: false,
    color: "orange",
    notes: "Responds strongly to Leadership pillar content. Frequently shares our templates internally.",
  },
  seller: {
    name: "Aspiring Online Seller / Freelancer",
    age_range: "21–30",
    profession: "Online seller, VA, or freelance ads specialist",
    industry: "Marketplace selling, dropshipping, freelance digital marketing",
    experience_level: "0–2 years, learning mostly from free content",
    location: "Provinces and Metro Manila, many working from home",
    goals: [
      "Earn a stable income online",
      "Land their first ₱30k+/month client or hit first 100 orders",
      "Learn Facebook and TikTok ads properly",
      "Build a portfolio or a real brand",
      "Quit a job they don't like",
    ],
    problems: [
      "Overwhelmed by conflicting advice",
      "Small budget — every ₱1,000 matters",
      "Doesn't know how to price services",
      "Copies trends without a strategy",
      "No proof or case studies yet",
    ],
    fears: [
      "Wasting savings on ads that don't convert",
      "Being scammed by courses and 'mentors'",
      "Never being taken seriously by bigger clients",
      "Family thinking online work isn't a real job",
    ],
    frustrations: [
      "\"Nag-boost ako pero walang benta.\"",
      "Courses that sell dreams but no real skills",
      "Clients who pay late or change scope",
      "Algorithm changes killing reach",
    ],
    aspirations: [
      "Build a real brand or agency of their own",
      "Financial freedom for their family",
      "Work with bigger brands",
      "Become a respected specialist",
    ],
    questions: [
      "How much should I charge as a beginner ads specialist?",
      "Is boosting posts a waste of money?",
      "What's the minimum budget for Facebook ads?",
      "How do I get my first client without experience?",
      "Should I sell on Shopee first or build my own website?",
    ],
    objections: [
      "\"Wala akong pera pang-ads.\"",
      "\"Saturated na 'yang niche.\"",
      "\"Para lang 'yan sa malalaking brands.\"",
    ],
    buying_motivation:
      "Mostly consumes free content now. Converts later into workshop attendees, applicants for junior roles at Northbound, or clients once their store grows.",
    content_consumed: [
      "TikTok tutorials",
      "Facebook groups for sellers and freelancers",
      "Free YouTube courses",
      "Live Q&As",
    ],
    platforms: ["tiktok", "facebook", "youtube", "instagram"],
    influencers: [
      "Free ads tutorial channels",
      "Freelancer community pages",
      "Marketplace seller education pages",
      "Motivational business pages",
    ],
    language_used: [
      "\"paano mag-start\"",
      "\"boost\"",
      "\"legit ba?\"",
      "\"sideline\"",
      "\"first client\"",
      "\"walang benta\"",
    ],
    is_primary: false,
    color: "aqua",
    notes: "Largest share of TikTok views. Keep content generous and practical; they're future clients, hires and advocates.",
  },
}
