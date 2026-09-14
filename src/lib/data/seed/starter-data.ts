/**
 * Starter Kit library data — what every workspace needs on day one and nothing
 * personal: formats, angles, hook templates, goals, platform strategies, the
 * sample weekly posting schedule and a small tag set.
 */
import type {
  FormatCategory,
  GoalCategory,
  GoalMetric,
  HookCategory,
  PlatformId,
  ScriptFormat,
  TagColor,
} from "@/lib/types"

export const FORMAT_NAMES = [
  "Short-form Video",
  "Long-form Video",
  "Facebook Post",
  "LinkedIn Post",
  "Threads",
  "X Post",
  "Carousel",
  "Image Post",
  "Story",
  "Live Video",
  "Podcast",
  "Newsletter",
  "Blog",
  "Behind-the-scenes",
  "Case Study",
] as const
export type FormatName = (typeof FORMAT_NAMES)[number]

export const FORMATS: Record<FormatName, { category: FormatCategory; script: ScriptFormat; description: string }> = {
  "Short-form Video": {
    category: "video",
    script: "short_video",
    description: "Vertical 30–90 second video for TikTok, Reels and Shorts. Hook in two seconds, one idea per video.",
  },
  "Long-form Video": {
    category: "video",
    script: "long_video",
    description: "6–20 minute YouTube deep dive or breakdown. The most trust you can build per viewer.",
  },
  "Facebook Post": {
    category: "text",
    script: "facebook_post",
    description: "Story-led text post. The first line has to earn the 'See more' tap.",
  },
  "LinkedIn Post": {
    category: "text",
    script: "linkedin_post",
    description: "Professional insight for decision-makers. Short lines, one clear point, a question at the end.",
  },
  Threads: {
    category: "text",
    script: "threads_post",
    description: "Short conversational take written to start replies, not to broadcast.",
  },
  "X Post": {
    category: "text",
    script: "x_thread",
    description: "A single sharp post or a thread of 4–8 tight points.",
  },
  Carousel: {
    category: "visual",
    script: "carousel",
    description: "7-slide saveable breakdown: frameworks, checklists, before/after comparisons.",
  },
  "Image Post": {
    category: "visual",
    script: "instagram_caption",
    description: "Single image or quote card; the caption carries the value.",
  },
  Story: {
    category: "visual",
    script: "story_sequence",
    description: "3–5 frame Instagram or Facebook story with a poll or question sticker.",
  },
  "Live Video": {
    category: "live",
    script: "video_brief",
    description: "Live Q&A or workshop. Lowest production effort, highest comment volume.",
  },
  Podcast: {
    category: "audio",
    script: "podcast_outline",
    description: "Audio or video conversation with a clear run of show and one big takeaway.",
  },
  Newsletter: {
    category: "long_form",
    script: "newsletter",
    description: "One-idea email to the audience you own — no algorithm in between.",
  },
  Blog: {
    category: "long_form",
    script: "blog",
    description: "Searchable long-form article that keeps bringing in readers for months.",
  },
  "Behind-the-scenes": {
    category: "video",
    script: "short_video",
    description: "Raw look at how the work actually gets done. Low polish, high trust.",
  },
  "Case Study": {
    category: "long_form",
    script: "linkedin_post",
    description: "Problem → action → result with real numbers. Proof content for the middle and bottom of the funnel.",
  },
}

export const ANGLE_NAMES = [
  "Problem",
  "Mistake",
  "Myth",
  "Contrarian",
  "Tutorial",
  "Checklist",
  "Framework",
  "Story",
  "Failure",
  "Success",
  "Case Study",
  "Transformation",
  "Behind the Scenes",
  "Prediction",
  "Comparison",
  "Opinion",
  "Reaction",
  "Observation",
  "Question",
  "Challenge",
  "Lesson",
  "Before vs After",
] as const
export type AngleName = (typeof ANGLE_NAMES)[number]

export const ANGLES: Record<AngleName, { description: string; example: string }> = {
  Problem: {
    description: "Name a painful problem precisely and explain why it keeps happening.",
    example: "Why your sales stall every time you stop posting",
  },
  Mistake: {
    description: "Expose an error your audience is probably making right now — and the fix.",
    example: "The pricing mistake that keeps freelancers stuck at the same income",
  },
  Myth: {
    description: "Take a belief everyone repeats and show where it breaks.",
    example: "'Post every day' is burning out creators for no reason",
  },
  Contrarian: {
    description: "Argue the opposite of popular advice and defend it with experience.",
    example: "Why I tell clients to post less, not more",
  },
  Tutorial: {
    description: "Teach a process step by step so they can do it today.",
    example: "How to set up a weekly content review in 20 minutes",
  },
  Checklist: {
    description: "A list they can save, screenshot and run on their own work.",
    example: "The 9-point checklist I run before launching any campaign",
  },
  Framework: {
    description: "Package your method into a named, repeatable model.",
    example: "The 3-step framework I use to plan a month of content",
  },
  Story: {
    description: "Drop the viewer into a specific moment that changed how you work.",
    example: "The phone call that made me rethink my whole business",
  },
  Failure: {
    description: "Share what went wrong, what it cost and what you changed.",
    example: "I lost my biggest client. Here's what I missed.",
  },
  Success: {
    description: "Show a win and, more importantly, the decisions behind it.",
    example: "How we doubled revenue without adding headcount",
  },
  "Case Study": {
    description: "Break down a real example: starting point, actions, measurable result.",
    example: "How a 5-person team cut its reporting time in half",
  },
  Transformation: {
    description: "Show the path from before to after — including the messy middle.",
    example: "From burned-out freelancer to leading a team of ten",
  },
  "Behind the Scenes": {
    description: "Let people see how the work really happens, unpolished.",
    example: "What our Monday planning session actually looks like",
  },
  Prediction: {
    description: "Say where your industry is heading, why, and what to do about it.",
    example: "Three marketing roles AI will reshape within a year",
  },
  Comparison: {
    description: "Put two options side by side and make a clear call.",
    example: "Agency vs in-house: which one fits a growing brand?",
  },
  Opinion: {
    description: "Take a clear position on a debate in your field.",
    example: "Discount-driven growth is a trap most brands never escape",
  },
  Reaction: {
    description: "Respond to news, a trend or a widely shared post with your expert take.",
    example: "My honest take on the latest algorithm change",
  },
  Observation: {
    description: "Point out a pattern you keep seeing that others haven't named yet.",
    example: "The best operators I know all do this one boring thing",
  },
  Question: {
    description: "Answer the question your audience keeps asking in DMs and comments.",
    example: "Should your first marketing hire be a generalist or a specialist?",
  },
  Challenge: {
    description: "Invite the audience to try something for a fixed time and report back.",
    example: "Try this 7-day 'one post, one lesson' challenge",
  },
  Lesson: {
    description: "Distil one transferable lesson from something you lived through.",
    example: "The best business advice I ever got cost me nothing",
  },
  "Before vs After": {
    description: "Contrast the result before and after one specific change.",
    example: "Our onboarding process before vs after writing one SOP",
  },
}

/** Hook Library templates; the first of each category is HOOK_CATEGORIES[category].example. */
export const HOOK_TEMPLATES: Record<Exclude<HookCategory, "custom">, string[]> = {
  curiosity: [
    "I learned something recently that completely changed how I think about ___.",
    "Nobody talks about this part of ___.",
    "Here's what actually happens after you ___.",
    "The most underrated ___ skill isn't what you think.",
    "I tested ___ for 30 days. Here's what happened.",
  ],
  contrarian: [
    "Most people are doing ___ completely wrong.",
    "Unpopular opinion: ___ is overrated.",
    "Stop listening to anyone who says ___.",
    "___ isn't the problem. ___ is.",
    "Everyone says ___. I disagree.",
  ],
  mistake: [
    "One mistake almost every beginner makes with ___.",
    "The ___ mistake that cost me ___.",
    "If you're doing ___, you're leaving money on the table.",
    "I made this ___ mistake for years so you don't have to.",
  ],
  authority: [
    "After years of working in ___, here's what I've realized.",
    "I've reviewed ___ ___. The best ones all do this.",
    "What ___ years in ___ taught me about ___.",
    "Here's the exact ___ we use with every client.",
  ],
  story: [
    "Three years ago, I made a decision that ___.",
    "The day I ___, everything changed.",
    "I almost quit ___. This is what stopped me.",
    "Let me tell you about the worst ___ of my career.",
    "It was 11 p.m. when ___.",
  ],
  problem: [
    "If you're struggling with ___, this might be why.",
    "Why does ___ keep happening even when you ___?",
    "Your ___ isn't broken. Your ___ is.",
    "The real reason your ___ isn't working.",
  ],
  results: [
    "We changed one thing and the results surprised us.",
    "How we went from ___ to ___ in ___.",
    "This one ___ generated ___ in ___.",
    "___ in ___ days. Here's exactly what we did.",
  ],
  list: [
    "5 things I wish I knew before ___.",
    "3 ___ I check before ___.",
    "7 ___ every ___ should know.",
    "The only ___ tools you actually need.",
    "4 signs you're ready to ___.",
  ],
  warning: [
    "Stop doing this if you want to ___.",
    "Don't ___ until you've watched this.",
    "This ___ habit is quietly killing your ___.",
    "If your ___ looks like this, fix it now.",
  ],
  question: [
    "Why do some people ___ while others ___?",
    "What would you do if ___?",
    "Is ___ still worth it?",
    "Have you ever wondered why ___?",
  ],
}

export const GOALS: Record<
  GoalCategory,
  { name: string; description: string; metric: GoalMetric; target: number }
> = {
  awareness: {
    name: "Reach the right new people",
    description: "Get discovered by people who match your audience — not just anyone who scrolls past.",
    metric: "reach",
    target: 150000,
  },
  authority: {
    name: "Become the go-to voice on my topic",
    description: "Publish content people save and send to colleagues because it teaches something real.",
    metric: "saves",
    target: 1500,
  },
  community: {
    name: "Turn followers into conversations",
    description: "Earn comments and DMs from people who recognise their own situation in your posts.",
    metric: "comments",
    target: 800,
  },
  leads: {
    name: "Generate qualified inquiries",
    description: "Turn trust into booked calls, audit requests and newsletter sign-ups.",
    metric: "leads",
    target: 40,
  },
  business: {
    name: "Convert attention into revenue",
    description: "Close clients, sell offers and open partnerships that trace back to content.",
    metric: "sales",
    target: 8,
  },
}

export const PLATFORM_STRATEGIES: Record<
  PlatformId,
  {
    active: boolean
    frequency: number
    goal: GoalCategory
    formats: FormatName[]
    audience: string
    cta: string
    notes: string
  }
> = {
  facebook: {
    active: true,
    frequency: 3,
    goal: "community",
    formats: ["Facebook Post", "Short-form Video", "Live Video"],
    audience: "Warm, local audience — peers, past customers and people who know you offline. Long personal stories and community discussion travel furthest.",
    cta: "End with a question people can answer from their own experience; invite DMs for anything specific.",
    notes: "Text posts with a strong first line beat link posts. Reply to every comment in the first hour.",
  },
  tiktok: {
    active: true,
    frequency: 2,
    goal: "awareness",
    formats: ["Short-form Video", "Behind-the-scenes"],
    audience: "Cold audience discovering you for the first time. They decide in two seconds whether you're worth their time.",
    cta: "Follow for part 2, or comment a keyword to get the resource.",
    notes: "One idea per video. Front-load the payoff, captions on every frame.",
  },
  instagram: {
    active: true,
    frequency: 2,
    goal: "authority",
    formats: ["Carousel", "Short-form Video", "Story"],
    audience: "Mixed warm and cold audience that saves and shares practical, visual content.",
    cta: "Save this for later and send it to someone who needs it.",
    notes: "Carousels drive saves; Stories keep existing followers close.",
  },
  youtube: {
    active: true,
    frequency: 1,
    goal: "authority",
    formats: ["Long-form Video", "Short-form Video", "Podcast"],
    audience: "High-intent viewers searching for a solution. They'll watch 15 minutes if the first 30 seconds promise a clear answer.",
    cta: "Subscribe for the next breakdown; link to the free resource in the description.",
    notes: "Titles and thumbnails do half the work. Chapters help retention.",
  },
  linkedin: {
    active: true,
    frequency: 2,
    goal: "leads",
    formats: ["LinkedIn Post", "Carousel", "Case Study"],
    audience: "Decision-makers, managers and peers. Rewards specific, experience-based insight over motivation.",
    cta: "Ask for their take in the comments; offer a resource or a call for those who want help.",
    notes: "Post early on weekdays. Short lines, no external links in the post body.",
  },
  x: {
    active: false,
    frequency: 2,
    goal: "awareness",
    formats: ["X Post"],
    audience: "Fast-moving, opinionated audience that rewards sharp takes and useful threads.",
    cta: "Repost the first post if it helped; follow for more threads like this.",
    notes: "Optional channel — switch it on once your core platforms post consistently.",
  },
  threads: {
    active: false,
    frequency: 3,
    goal: "community",
    formats: ["Threads"],
    audience: "Casual, conversational audience that prefers replies to broadcasts.",
    cta: "Ask a simple question people can answer in one line.",
    notes: "Good place to test raw ideas before turning them into bigger posts.",
  },
}

/**
 * Sample weekly posting strategy (spec §49). Per-platform slot counts match PLATFORM_STRATEGIES frequencies
 * (FB 3 · TikTok 2 · IG 2 · YouTube 1 · LinkedIn 2 = 10 = the starter weekly_post_target).
 */
export const POSTING_SLOTS: { day: number; label: string; format: FormatName; platforms: PlatformId[]; time: string }[] = [
  { day: 1, label: "Educational / Authority", format: "Short-form Video", platforms: ["tiktok", "facebook"], time: "18:30" },
  { day: 2, label: "Story / Journey", format: "Facebook Post", platforms: ["facebook"], time: "20:00" },
  { day: 3, label: "Tutorial / Framework", format: "Carousel", platforms: ["instagram", "linkedin"], time: "12:00" },
  { day: 4, label: "Opinion / Leadership", format: "LinkedIn Post", platforms: ["linkedin"], time: "08:30" },
  { day: 5, label: "Behind the Scenes", format: "Behind-the-scenes", platforms: ["tiktok", "instagram"], time: "21:00" },
  { day: 6, label: "Personal / Lifestyle", format: "Short-form Video", platforms: ["youtube"], time: "19:00" },
  { day: 0, label: "Reflection / Community", format: "Facebook Post", platforms: ["facebook"], time: "21:00" },
]

export const TAG_NAMES = [
  "marketing",
  "leadership",
  "ecommerce",
  "business",
  "ai",
  "story",
  "lesson",
  "founder",
  "team",
  "growth",
] as const
export type TagName = (typeof TAG_NAMES)[number]

export const TAG_COLORS: Record<TagName, TagColor> = {
  marketing: "blue",
  leadership: "orange",
  ecommerce: "aqua",
  business: "yellow",
  ai: "magenta",
  story: "green",
  lesson: "violet",
  founder: "red",
  team: "gray",
  growth: "gray",
}
