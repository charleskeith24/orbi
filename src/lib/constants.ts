/**
 * Labels, option lists and fixed system knowledge used across the app.
 * UI must read display strings from here so terminology stays consistent.
 */
import type {
  BrandLanguage,
  BrandTone,
  CampaignStatus,
  CategoricalColor,
  EngagementTaskConfig,
  ExperimentMetric,
  ExperimentStatus,
  FormatCategory,
  FunnelStage,
  GoalCategory,
  GoalMetric,
  GoalPeriod,
  HookCategory,
  IdeaScores,
  IdeaSource,
  IdeaStatus,
  MetricKey,
  PerformanceTier,
  PersonalityTrait,
  PipelineStage,
  PlatformId,
  Priority,
  ProblemCategory,
  QualityRating,
  QuestionStatus,
  RateKey,
  RepurposeStatus,
  RepurposeType,
  ResearchStatus,
  ResearchType,
  ScriptFormat,
  SeriesFrequency,
  StageGroup,
  StoryType,
  WinnerMetric,
} from "./types"

type Option<T extends string> = { id: T; label: string; description?: string }

function optionMap<T extends string, O extends Option<T>>(options: readonly O[]): Record<T, O> {
  return Object.fromEntries(options.map((o) => [o.id, o])) as Record<T, O>
}

/* -------------------------------- Platforms ------------------------------- */

export const PLATFORM_IDS: PlatformId[] = [
  "facebook",
  "tiktok",
  "instagram",
  "youtube",
  "linkedin",
  "x",
  "threads",
]

export const PLATFORMS: Record<PlatformId, { id: PlatformId; label: string; short: string; brandHex: string }> = {
  facebook: { id: "facebook", label: "Facebook", short: "FB", brandHex: "#1877F2" },
  tiktok: { id: "tiktok", label: "TikTok", short: "TT", brandHex: "#111111" },
  instagram: { id: "instagram", label: "Instagram", short: "IG", brandHex: "#E4405F" },
  youtube: { id: "youtube", label: "YouTube", short: "YT", brandHex: "#FF0000" },
  linkedin: { id: "linkedin", label: "LinkedIn", short: "IN", brandHex: "#0A66C2" },
  x: { id: "x", label: "X", short: "X", brandHex: "#111111" },
  threads: { id: "threads", label: "Threads", short: "TH", brandHex: "#111111" },
}

/* -------------------------------- Pipeline -------------------------------- */

export const PIPELINE_STAGES: { id: PipelineStage; label: string; group: StageGroup; description: string }[] = [
  { id: "idea", label: "Ideas", group: "idea", description: "Raw ideas parked on the board" },
  { id: "selected", label: "Selected", group: "idea", description: "Chosen for production" },
  { id: "brief", label: "Brief", group: "brief", description: "Defining objective, audience and message" },
  { id: "scripting", label: "Scripting", group: "script", description: "Writing the script or copy" },
  { id: "ready_for_production", label: "Ready for Production", group: "production", description: "Script approved, ready to record or design" },
  { id: "recording", label: "Recording", group: "production", description: "Being recorded / designed" },
  { id: "editing", label: "Editing", group: "production", description: "In the edit" },
  { id: "review", label: "Review", group: "review", description: "Awaiting approval" },
  { id: "revision", label: "Revision", group: "review", description: "Changes requested" },
  { id: "ready_to_post", label: "Ready to Post", group: "ready", description: "Approved, not yet scheduled" },
  { id: "scheduled", label: "Scheduled", group: "scheduled", description: "Has a publish date and time" },
  { id: "published", label: "Published", group: "published", description: "Live on the platform" },
  { id: "repurpose", label: "Repurpose", group: "published", description: "Published and queued for repurposing" },
]

export const PIPELINE_STAGE_MAP = optionMap(PIPELINE_STAGES)
export const PIPELINE_STAGE_ORDER: Record<PipelineStage, number> = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s.id, i])
) as Record<PipelineStage, number>

export const STAGE_GROUPS: { id: StageGroup; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "brief", label: "Brief" },
  { id: "script", label: "Script" },
  { id: "production", label: "Production" },
  { id: "review", label: "Review" },
  { id: "ready", label: "Ready" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
]

/** Stages that count as "in production" (not yet live). */
export const UNPUBLISHED_STAGES: PipelineStage[] = PIPELINE_STAGES.filter(
  (s) => s.group !== "published"
).map((s) => s.id)
export const PUBLISHED_STAGES: PipelineStage[] = ["published", "repurpose"]
/** Stages that count toward the content buffer (fully produced, waiting to go live). */
export const BUFFER_STAGES: PipelineStage[] = ["ready_to_post", "scheduled"]
export const PRODUCTION_STAGES: PipelineStage[] = ["ready_for_production", "recording", "editing"]
export const REVIEW_STAGES: PipelineStage[] = ["review", "revision"]

/* ---------------------------------- Ideas --------------------------------- */

export const IDEA_STATUSES: Option<IdeaStatus>[] = [
  { id: "inbox", label: "Inbox", description: "Captured, not yet evaluated" },
  { id: "researching", label: "Researching", description: "Collecting examples, data or angles" },
  { id: "validated", label: "Validated", description: "Worth making — audience problem confirmed" },
  { id: "selected", label: "Selected", description: "Chosen for an upcoming slot" },
  { id: "converted", label: "Converted to Content", description: "Turned into a content item" },
  { id: "archived", label: "Archived", description: "Parked or rejected" },
]
export const IDEA_STATUS_MAP = optionMap(IDEA_STATUSES)

export const IDEA_SOURCES: Option<IdeaSource>[] = [
  { id: "quick_capture", label: "Quick Capture" },
  { id: "ai_generator", label: "Idea Generator" },
  { id: "matrix", label: "Content Matrix" },
  { id: "problem_bank", label: "Problem Bank" },
  { id: "question_bank", label: "Question Bank" },
  { id: "research", label: "Research" },
  { id: "story", label: "Story Vault" },
  { id: "experience", label: "Experience → Content" },
  { id: "winner", label: "Winner Replication" },
  { id: "repurpose", label: "Repurposing" },
  { id: "onboarding", label: "Onboarding" },
  { id: "strategist", label: "Content Strategist" },
  { id: "planner", label: "Weekly Planner" },
  { id: "manual", label: "Manual" },
]
export const IDEA_SOURCE_MAP = optionMap(IDEA_SOURCES)

export const PRIORITIES: Option<Priority>[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
]
export const PRIORITY_MAP = optionMap(PRIORITIES)

/** Idea Priority Score (spec §39). Weights sum to 1. */
export const IDEA_SCORE_DIMENSIONS: {
  key: keyof IdeaScores
  label: string
  description: string
  weight: number
}[] = [
  { key: "audience_relevance", label: "Audience Relevance", description: "Solves a real, frequent problem for a target persona", weight: 0.2 },
  { key: "authority_potential", label: "Authority Potential", description: "Showcases your expertise and point of view", weight: 0.15 },
  { key: "business_alignment", label: "Business Alignment", description: "Moves your primary brand goal forward", weight: 0.15 },
  { key: "timeliness", label: "Timeliness", description: "Relevant right now (trend, season, current conversation)", weight: 0.1 },
  { key: "originality", label: "Originality", description: "Fresh angle or personal experience others can't copy", weight: 0.15 },
  { key: "repurposing_potential", label: "Repurposing Potential", description: "Can become multiple assets across platforms", weight: 0.1 },
  { key: "ease_of_production", label: "Ease of Production", description: "Low effort to produce well", weight: 0.15 },
]

/** HIGH ≥ 75, MEDIUM ≥ 55, else LOW. */
export const IDEA_SCORE_THRESHOLDS = { high: 75, medium: 55 }

/* ---------------------------------- Funnel -------------------------------- */

export const FUNNEL_STAGES: Record<
  FunnelStage,
  { id: FunnelStage; label: string; name: string; goal: string; examples: string[] }
> = {
  tofu: {
    id: "tofu",
    label: "TOFU",
    name: "Awareness",
    goal: "Reach new audiences",
    examples: ["Strong opinions", "Relatable posts", "Trends", "Viral hooks", "Broad educational topics"],
  },
  mofu: {
    id: "mofu",
    label: "MOFU",
    name: "Trust",
    goal: "Build expertise and relationship",
    examples: ["Tutorials", "Case studies", "Frameworks", "Experiences", "Detailed breakdowns"],
  },
  bofu: {
    id: "bofu",
    label: "BOFU",
    name: "Conversion",
    goal: "Create an action",
    examples: ["Offers", "Services", "Products", "Recruitment", "Consultations", "Partnerships", "Lead magnets"],
  },
}
export const FUNNEL_STAGE_IDS: FunnelStage[] = ["tofu", "mofu", "bofu"]

/* ---------------------------------- Goals --------------------------------- */

export const GOAL_CATEGORIES: Record<
  GoalCategory,
  { id: GoalCategory; label: string; description: string; kpis: string[]; metric: GoalMetric }
> = {
  awareness: {
    id: "awareness",
    label: "Awareness",
    description: "Get discovered by more of the right people",
    kpis: ["Reach", "Followers", "Views", "Brand searches"],
    metric: "reach",
  },
  authority: {
    id: "authority",
    label: "Authority",
    description: "Become the recognised expert in your space",
    kpis: ["Educational posts", "Saves", "Shares", "Thought leadership"],
    metric: "saves",
  },
  community: {
    id: "community",
    label: "Community",
    description: "Turn followers into conversations",
    kpis: ["Comments", "DMs", "Conversations", "Community interaction"],
    metric: "comments",
  },
  leads: {
    id: "leads",
    label: "Leads",
    description: "Create inquiries and pipeline",
    kpis: ["Inquiries", "Leads", "Calls", "Newsletter subscribers"],
    metric: "leads",
  },
  business: {
    id: "business",
    label: "Business",
    description: "Convert attention into business outcomes",
    kpis: ["Customers", "Applicants", "Partnerships", "Speaking opportunities", "Sales"],
    metric: "sales",
  },
}
export const GOAL_CATEGORY_IDS: GoalCategory[] = ["awareness", "authority", "community", "leads", "business"]

export const GOAL_METRICS: Option<GoalMetric>[] = [
  { id: "views", label: "Views" },
  { id: "reach", label: "Reach" },
  { id: "followers_gained", label: "Followers gained" },
  { id: "engagements", label: "Engagements" },
  { id: "comments", label: "Comments" },
  { id: "shares", label: "Shares" },
  { id: "saves", label: "Saves" },
  { id: "profile_visits", label: "Profile visits" },
  { id: "link_clicks", label: "Link clicks" },
  { id: "leads", label: "Leads" },
  { id: "sales", label: "Sales" },
  { id: "posts", label: "Posts published" },
]
export const GOAL_METRIC_MAP = optionMap(GOAL_METRICS)

export const GOAL_PERIODS: Option<GoalPeriod>[] = [
  { id: "weekly", label: "per week" },
  { id: "monthly", label: "per month" },
  { id: "quarterly", label: "per quarter" },
]

/* --------------------------------- Audience ------------------------------- */

export const PROBLEM_CATEGORIES: Option<ProblemCategory>[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
  { id: "emotional", label: "Emotional" },
  { id: "financial", label: "Financial" },
  { id: "career", label: "Career" },
  { id: "business", label: "Business" },
  { id: "operational", label: "Operational" },
]
export const PROBLEM_CATEGORY_MAP = optionMap(PROBLEM_CATEGORIES)

export const QUESTION_STATUSES: Option<QuestionStatus>[] = [
  { id: "new", label: "New" },
  { id: "idea_created", label: "Idea created" },
  { id: "answered", label: "Answered in content" },
  { id: "dismissed", label: "Dismissed" },
]
export const QUESTION_STATUS_MAP = optionMap(QUESTION_STATUSES)

/* ---------------------------------- Hooks --------------------------------- */

export const HOOK_CATEGORIES: Record<
  HookCategory,
  { id: HookCategory; label: string; description: string; example: string }
> = {
  curiosity: {
    id: "curiosity",
    label: "Curiosity",
    description: "Opens a loop the viewer needs closed",
    example: "I learned something recently that completely changed how I think about ___.",
  },
  contrarian: {
    id: "contrarian",
    label: "Contrarian",
    description: "Challenges a common belief",
    example: "Most people are doing ___ completely wrong.",
  },
  mistake: {
    id: "mistake",
    label: "Mistake",
    description: "Names an error the audience is probably making",
    example: "One mistake almost every beginner makes with ___.",
  },
  authority: {
    id: "authority",
    label: "Authority",
    description: "Leads with earned experience",
    example: "After years of working in ___, here's what I've realized.",
  },
  story: {
    id: "story",
    label: "Story",
    description: "Drops the viewer into a moment",
    example: "Three years ago, I made a decision that ___.",
  },
  problem: {
    id: "problem",
    label: "Problem",
    description: "Names the pain directly",
    example: "If you're struggling with ___, this might be why.",
  },
  results: {
    id: "results",
    label: "Results",
    description: "Leads with an outcome",
    example: "We changed one thing and the results surprised us.",
  },
  list: {
    id: "list",
    label: "List",
    description: "Promises a scannable set",
    example: "5 things I wish I knew before ___.",
  },
  warning: {
    id: "warning",
    label: "Warning",
    description: "Stops a harmful behaviour",
    example: "Stop doing this if you want to ___.",
  },
  question: {
    id: "question",
    label: "Question",
    description: "Asks what the audience is already wondering",
    example: "Why do some people ___ while others ___?",
  },
  custom: { id: "custom", label: "Custom", description: "Your own hook pattern", example: "" },
}
export const HOOK_CATEGORY_IDS = Object.keys(HOOK_CATEGORIES) as HookCategory[]

/* ------------------------------ Brand identity ---------------------------- */

export const LANGUAGES: Option<BrandLanguage>[] = [
  { id: "english", label: "English" },
  { id: "tagalog", label: "Tagalog" },
  { id: "taglish", label: "Taglish" },
]
export const LANGUAGE_MAP = optionMap(LANGUAGES)

export const TONES: Option<BrandTone>[] = [
  { id: "professional", label: "Professional" },
  { id: "conversational", label: "Conversational" },
  { id: "motivational", label: "Motivational" },
  { id: "educational", label: "Educational" },
  { id: "challenging", label: "Challenging" },
  { id: "casual", label: "Casual" },
]
export const TONE_MAP = optionMap(TONES)

export const PERSONALITY_TRAITS: Option<PersonalityTrait>[] = [
  { id: "educational", label: "Educational" },
  { id: "direct", label: "Direct" },
  { id: "inspirational", label: "Inspirational" },
  { id: "strategic", label: "Strategic" },
  { id: "practical", label: "Practical" },
  { id: "humorous", label: "Humorous" },
  { id: "bold", label: "Bold" },
  { id: "professional", label: "Professional" },
  { id: "authentic", label: "Authentic" },
  { id: "story_driven", label: "Story-driven" },
]
export const PERSONALITY_TRAIT_MAP = optionMap(PERSONALITY_TRAITS)

export const EXPERTISE_SUGGESTIONS = [
  "E-commerce",
  "Marketing",
  "Digital Marketing",
  "Leadership",
  "Entrepreneurship",
  "Advertising",
  "AI",
  "Business Systems",
  "Team Management",
  "Growth",
  "Personal Development",
  "Sales",
  "Branding",
]

/* ------------------------------ Formats/scripts --------------------------- */

export const FORMAT_CATEGORIES: Option<FormatCategory>[] = [
  { id: "video", label: "Video" },
  { id: "text", label: "Text" },
  { id: "visual", label: "Visual" },
  { id: "audio", label: "Audio" },
  { id: "long_form", label: "Long-form" },
  { id: "live", label: "Live" },
]
export const FORMAT_CATEGORY_MAP = optionMap(FORMAT_CATEGORIES)

export interface ScriptFormatSpec {
  id: ScriptFormat
  label: string
  description: string
  sections: { key: string; label: string; hint: string }[]
}

/** Section structures for every script type the Content Studio generates (spec §16). */
export const SCRIPT_FORMATS: Record<ScriptFormat, ScriptFormatSpec> = {
  short_video: {
    id: "short_video",
    label: "Short-form Script",
    description: "Reels, TikTok, Shorts — 30 to 90 seconds",
    sections: [
      { key: "hook", label: "Hook", hint: "First 1–3 seconds. Stop the scroll." },
      { key: "context", label: "Context", hint: "Why this matters to the viewer right now" },
      { key: "value", label: "Value", hint: "The insight, steps or framework" },
      { key: "example", label: "Example", hint: "A real example or story that proves it" },
      { key: "takeaway", label: "Key Takeaway", hint: "One sentence they should remember" },
      { key: "cta", label: "CTA", hint: "What to do next" },
    ],
  },
  long_video: {
    id: "long_video",
    label: "Long-form Video Outline",
    description: "YouTube / webinar style, 6+ minutes",
    sections: [
      { key: "hook", label: "Hook", hint: "Promise + stakes in the first 15 seconds" },
      { key: "intro", label: "Intro", hint: "Who you are and why to trust this" },
      { key: "segment_1", label: "Segment 1", hint: "First main point" },
      { key: "segment_2", label: "Segment 2", hint: "Second main point" },
      { key: "segment_3", label: "Segment 3", hint: "Third main point" },
      { key: "recap", label: "Recap", hint: "Summarise the framework" },
      { key: "cta", label: "CTA", hint: "Subscribe / next video / offer" },
    ],
  },
  facebook_post: {
    id: "facebook_post",
    label: "Facebook Post",
    description: "Story-led text post",
    sections: [
      { key: "hook", label: "Hook", hint: "First line visible before 'See more'" },
      { key: "story", label: "Story / Problem", hint: "The situation or problem" },
      { key: "insight", label: "Insight", hint: "What you realised" },
      { key: "lesson", label: "Lesson", hint: "The transferable lesson" },
      { key: "cta", label: "CTA", hint: "Question or next step" },
    ],
  },
  linkedin_post: {
    id: "linkedin_post",
    label: "LinkedIn Post",
    description: "Professional insight post",
    sections: [
      { key: "hook", label: "Hook", hint: "One or two lines, earn the click on 'more'" },
      { key: "context", label: "Context", hint: "The situation" },
      { key: "insight", label: "Insight", hint: "The non-obvious point" },
      { key: "framework", label: "Framework", hint: "Steps, list or model" },
      { key: "conclusion", label: "Conclusion", hint: "Tie it together" },
      { key: "cta", label: "CTA", hint: "Question or invitation" },
    ],
  },
  carousel: {
    id: "carousel",
    label: "Carousel",
    description: "7-slide carousel",
    sections: [
      { key: "slide_1", label: "Slide 1 — Hook", hint: "Big promise or bold claim" },
      { key: "slide_2", label: "Slide 2 — Problem", hint: "The pain" },
      { key: "slide_3", label: "Slide 3 — Insight", hint: "The shift in thinking" },
      { key: "slide_4", label: "Slide 4 — Lesson", hint: "What to do instead" },
      { key: "slide_5", label: "Slide 5 — Example", hint: "Proof" },
      { key: "slide_6", label: "Slide 6 — Framework", hint: "Steps they can save" },
      { key: "slide_7", label: "Slide 7 — CTA", hint: "Save / share / follow / DM" },
    ],
  },
  video_brief: {
    id: "video_brief",
    label: "Video Brief",
    description: "Production brief for a shoot or editor",
    sections: [
      { key: "hook", label: "Hook", hint: "Opening line and visual" },
      { key: "talking_points", label: "Talking Points", hint: "Bullet points to cover" },
      { key: "b_roll", label: "B-roll Suggestions", hint: "Cutaways and supporting footage" },
      { key: "visual_direction", label: "Visual Direction", hint: "Setting, framing, style" },
      { key: "on_screen_text", label: "On-screen Text", hint: "Captions and callouts" },
      { key: "cta", label: "CTA", hint: "Closing action" },
    ],
  },
  x_thread: {
    id: "x_thread",
    label: "X Thread",
    description: "Hook tweet + 4–8 tweets",
    sections: [
      { key: "hook", label: "Hook Tweet", hint: "Stand-alone, makes them open the thread" },
      { key: "body", label: "Thread Body", hint: "One idea per tweet, separated by blank lines" },
      { key: "cta", label: "Closing Tweet", hint: "Recap + follow / repost" },
    ],
  },
  threads_post: {
    id: "threads_post",
    label: "Threads Post",
    description: "Short conversational post",
    sections: [
      { key: "hook", label: "Hook", hint: "Conversational opener" },
      { key: "body", label: "Body", hint: "The point, short" },
      { key: "cta", label: "Question", hint: "Invite replies" },
    ],
  },
  instagram_caption: {
    id: "instagram_caption",
    label: "Instagram Caption",
    description: "Caption for a Reel or post",
    sections: [
      { key: "hook", label: "Hook", hint: "First line" },
      { key: "body", label: "Body", hint: "Value in short paragraphs" },
      { key: "cta", label: "CTA", hint: "Save / share / comment" },
      { key: "hashtags", label: "Hashtags", hint: "3–8 relevant hashtags" },
    ],
  },
  newsletter: {
    id: "newsletter",
    label: "Newsletter Insight",
    description: "One-idea email",
    sections: [
      { key: "subject", label: "Subject Line", hint: "Curiosity or clear benefit" },
      { key: "opening", label: "Opening", hint: "Personal, specific" },
      { key: "insight", label: "Insight", hint: "The idea" },
      { key: "framework", label: "Framework", hint: "How to apply it" },
      { key: "example", label: "Example", hint: "Proof or story" },
      { key: "cta", label: "CTA", hint: "Reply / click / book" },
    ],
  },
  blog: {
    id: "blog",
    label: "Blog Outline",
    description: "Long-form article outline",
    sections: [
      { key: "title", label: "Title", hint: "Searchable and specific" },
      { key: "intro", label: "Introduction", hint: "Problem and promise" },
      { key: "sections", label: "Main Sections", hint: "H2s with key points" },
      { key: "conclusion", label: "Conclusion", hint: "Summary" },
      { key: "cta", label: "CTA", hint: "Next step" },
    ],
  },
  podcast_outline: {
    id: "podcast_outline",
    label: "Podcast Outline",
    description: "Episode run of show",
    sections: [
      { key: "cold_open", label: "Cold Open", hint: "Best moment teaser" },
      { key: "intro", label: "Intro", hint: "Topic and why now" },
      { key: "segments", label: "Segments", hint: "Main talking segments" },
      { key: "takeaways", label: "Takeaways", hint: "What listeners should do" },
      { key: "cta", label: "CTA", hint: "Subscribe / review / offer" },
    ],
  },
  story_sequence: {
    id: "story_sequence",
    label: "Story Sequence",
    description: "3–5 frame IG/FB story",
    sections: [
      { key: "frame_1", label: "Frame 1", hint: "Hook" },
      { key: "frame_2", label: "Frame 2", hint: "Context" },
      { key: "frame_3", label: "Frame 3", hint: "Value" },
      { key: "frame_4", label: "Frame 4", hint: "Poll / question sticker" },
      { key: "frame_5", label: "Frame 5", hint: "CTA / link" },
    ],
  },
  custom: {
    id: "custom",
    label: "Freeform Copy",
    description: "No fixed structure",
    sections: [{ key: "body", label: "Body", hint: "Write freely" }],
  },
}
export const SCRIPT_FORMAT_IDS = Object.keys(SCRIPT_FORMATS) as ScriptFormat[]

/* ------------------------------- Repurposing ------------------------------ */

export const REPURPOSE_TYPES: Record<
  RepurposeType,
  { id: RepurposeType; label: string; platform: PlatformId | null; scriptFormat: ScriptFormat; description: string }
> = {
  facebook_post: { id: "facebook_post", label: "Facebook post", platform: "facebook", scriptFormat: "facebook_post", description: "Story-led text version" },
  linkedin_post: { id: "linkedin_post", label: "LinkedIn post", platform: "linkedin", scriptFormat: "linkedin_post", description: "Professional insight version" },
  carousel: { id: "carousel", label: "Carousel", platform: "instagram", scriptFormat: "carousel", description: "7-slide saveable breakdown" },
  x_thread: { id: "x_thread", label: "X thread", platform: "x", scriptFormat: "x_thread", description: "Thread of the key points" },
  reel_caption: { id: "reel_caption", label: "Instagram Reel caption", platform: "instagram", scriptFormat: "instagram_caption", description: "Caption + hashtags for a Reel" },
  youtube_short: { id: "youtube_short", label: "YouTube Short", platform: "youtube", scriptFormat: "short_video", description: "Vertical short script" },
  newsletter: { id: "newsletter", label: "Newsletter insight", platform: null, scriptFormat: "newsletter", description: "One-idea email" },
  follow_up: { id: "follow_up", label: "Follow-up video", platform: null, scriptFormat: "short_video", description: "Answer the top comment / go deeper" },
  part_2: { id: "part_2", label: "Part 2", platform: null, scriptFormat: "short_video", description: "Continue the story or framework" },
  opposite_opinion: { id: "opposite_opinion", label: "Opposite opinion", platform: null, scriptFormat: "short_video", description: "Steelman the other side" },
  case_study: { id: "case_study", label: "Case study", platform: "linkedin", scriptFormat: "linkedin_post", description: "Show the idea applied with results" },
  update_post: { id: "update_post", label: "Update post", platform: null, scriptFormat: "facebook_post", description: "What happened since" },
}
export const REPURPOSE_TYPE_IDS = Object.keys(REPURPOSE_TYPES) as RepurposeType[]

export const REPURPOSE_STATUSES: Option<RepurposeStatus>[] = [
  { id: "suggested", label: "Suggested" },
  { id: "drafted", label: "Drafted" },
  { id: "created", label: "Created" },
  { id: "dismissed", label: "Dismissed" },
]
export const REPURPOSE_STATUS_MAP = optionMap(REPURPOSE_STATUSES)

/* ------------------------------- Performance ------------------------------ */

export const PERFORMANCE_TIERS: Record<PerformanceTier, { id: PerformanceTier; label: string; description: string }> = {
  normal: { id: "normal", label: "Normal", description: "Performing around your usual level" },
  good: { id: "good", label: "Good", description: "Clearly above your platform average" },
  winner: { id: "winner", label: "Winner", description: "About double your platform average" },
  breakout: { id: "breakout", label: "Breakout", description: "Three times or more your platform average" },
}
export const PERFORMANCE_TIER_IDS: PerformanceTier[] = ["normal", "good", "winner", "breakout"]

export const WINNER_METRICS: Option<WinnerMetric>[] = [
  { id: "views", label: "Views", description: "Raw views vs platform average" },
  { id: "engagement_rate", label: "Engagement rate", description: "Engagement ÷ reach vs platform average" },
  { id: "engagements", label: "Total engagements", description: "Likes + comments + shares + saves" },
  { id: "leads", label: "Leads", description: "Leads generated vs platform average" },
  { id: "composite", label: "Composite", description: "Blend of views, engagement rate, shares, saves and leads" },
]
export const WINNER_METRIC_MAP = optionMap(WINNER_METRICS)

export type MetricKind = "count" | "percent" | "duration"

export const METRIC_FIELDS: { key: MetricKey; label: string; kind: MetricKind }[] = [
  { key: "views", label: "Views", kind: "count" },
  { key: "reach", label: "Reach", kind: "count" },
  { key: "likes", label: "Likes", kind: "count" },
  { key: "comments", label: "Comments", kind: "count" },
  { key: "shares", label: "Shares", kind: "count" },
  { key: "saves", label: "Saves", kind: "count" },
  { key: "followers_gained", label: "Followers gained", kind: "count" },
  { key: "profile_visits", label: "Profile visits", kind: "count" },
  { key: "link_clicks", label: "Link clicks", kind: "count" },
  { key: "leads", label: "Leads", kind: "count" },
  { key: "sales", label: "Sales", kind: "count" },
  { key: "watch_time_seconds", label: "Watch time (sec)", kind: "duration" },
  { key: "avg_retention", label: "Avg. retention %", kind: "percent" },
]

export const RATE_FIELDS: { key: RateKey; label: string; formula: string }[] = [
  { key: "engagement_rate", label: "Engagement rate", formula: "(likes + comments + shares + saves) ÷ reach" },
  { key: "share_rate", label: "Share rate", formula: "shares ÷ reach" },
  { key: "save_rate", label: "Save rate", formula: "saves ÷ reach" },
  { key: "lead_conversion_rate", label: "Lead conversion rate", formula: "leads ÷ link clicks (or profile visits)" },
  { key: "follower_conversion_rate", label: "Follower conversion rate", formula: "followers gained ÷ profile visits" },
]

export const EXPERIMENT_METRICS: Option<ExperimentMetric>[] = [
  ...METRIC_FIELDS.map((m) => ({ id: m.key as ExperimentMetric, label: m.label })),
  ...RATE_FIELDS.map((r) => ({ id: r.key as ExperimentMetric, label: r.label })),
  { id: "engagements", label: "Total engagements" },
]
export const EXPERIMENT_METRIC_MAP = optionMap(EXPERIMENT_METRICS)

/* ---------------------------- Quality score (§28) ------------------------- */

export const QUALITY_DIMENSIONS: {
  key: "hook" | "relevance" | "value" | "clarity" | "authenticity" | "cta"
  label: string
  max: number
  question: string
}[] = [
  { key: "hook", label: "Hook", max: 20, question: "Does the opening stop the scroll and create a reason to keep going?" },
  { key: "relevance", label: "Relevance", max: 20, question: "Is it clearly for the target persona and one of their real problems?" },
  { key: "value", label: "Value", max: 20, question: "Will the audience learn, feel or be able to do something new?" },
  { key: "clarity", label: "Clarity", max: 20, question: "Is there one clear message, simply expressed?" },
  { key: "authenticity", label: "Authenticity", max: 20, question: "Does it sound like you — specific, experienced, opinionated?" },
  { key: "cta", label: "CTA", max: 10, question: "Is the next step clear and aligned with the goal?" },
]

export const QUALITY_RATINGS: Record<QualityRating, { label: string; min: number }> = {
  high_potential: { label: "High Potential", min: 85 },
  solid: { label: "Solid", min: 70 },
  needs_work: { label: "Needs Work", min: 50 },
  weak: { label: "Weak", min: 0 },
}

/* -------------------------- Campaigns / series / … ------------------------ */

export const CAMPAIGN_STATUSES: Option<CampaignStatus>[] = [
  { id: "planning", label: "Planning" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
]
export const CAMPAIGN_STATUS_MAP = optionMap(CAMPAIGN_STATUSES)

export const SERIES_FREQUENCIES: Option<SeriesFrequency>[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
]
export const SERIES_FREQUENCY_MAP = optionMap(SERIES_FREQUENCIES)

export const EXPERIMENT_STATUSES: Option<ExperimentStatus>[] = [
  { id: "planned", label: "Planned" },
  { id: "running", label: "Running" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
]
export const EXPERIMENT_STATUS_MAP = optionMap(EXPERIMENT_STATUSES)

export const EXPERIMENT_TEMPLATES: { name: string; hypothesis: string; variant_a: string; variant_b: string; metric: ExperimentMetric }[] = [
  { name: "Short hooks vs long hooks", hypothesis: "Hooks under 8 words hold attention better", variant_a: "Hook under 8 words", variant_b: "Hook of 15+ words", metric: "avg_retention" },
  { name: "30-second vs 60-second videos", hypothesis: "Shorter videos get more completed views", variant_a: "~30 seconds", variant_b: "~60 seconds", metric: "views" },
  { name: "Storytelling vs educational", hypothesis: "Story-led posts earn more engagement", variant_a: "Story-led", variant_b: "Straight educational", metric: "engagement_rate" },
  { name: "Talking-head vs B-roll", hypothesis: "Talking-head builds more trust and comments", variant_a: "Talking-head", variant_b: "B-roll with voiceover", metric: "comments" },
  { name: "Tagalog vs English", hypothesis: "Taglish content feels more native to the audience", variant_a: "Taglish", variant_b: "English", metric: "engagement_rate" },
  { name: "Direct CTA vs soft CTA", hypothesis: "Direct CTAs create more leads without hurting reach", variant_a: "Direct CTA (DM / book)", variant_b: "Soft CTA (follow / save)", metric: "leads" },
]

export const STORY_TYPES: Option<StoryType>[] = [
  { id: "story", label: "Story" },
  { id: "experience", label: "Experience" },
  { id: "lesson", label: "Lesson" },
  { id: "quote", label: "Quote" },
  { id: "opinion", label: "Opinion" },
  { id: "framework", label: "Framework" },
  { id: "case_study", label: "Case study" },
  { id: "achievement", label: "Achievement" },
  { id: "failure", label: "Failure" },
  { id: "belief", label: "Belief" },
]
export const STORY_TYPE_MAP = optionMap(STORY_TYPES)

export const RESEARCH_TYPES: Option<ResearchType>[] = [
  { id: "competitor", label: "Competitor content" },
  { id: "post", label: "Interesting post" },
  { id: "trend", label: "Industry trend" },
  { id: "quote", label: "Quote" },
  { id: "video", label: "Video" },
  { id: "topic", label: "Topic" },
  { id: "article", label: "Article" },
  { id: "screenshot", label: "Screenshot / URL" },
]
export const RESEARCH_TYPE_MAP = optionMap(RESEARCH_TYPES)

export const RESEARCH_STATUSES: Option<ResearchStatus>[] = [
  { id: "saved", label: "Saved" },
  { id: "analyzed", label: "Analyzed" },
  { id: "adapted", label: "Adapted" },
  { id: "archived", label: "Archived" },
]
export const RESEARCH_STATUS_MAP = optionMap(RESEARCH_STATUSES)

/* --------------------------------- Colors --------------------------------- */

/** Fixed categorical order — assign in this order, never cycle past 8. */
export const CATEGORICAL_COLORS: CategoricalColor[] = [
  "blue",
  "orange",
  "aqua",
  "yellow",
  "magenta",
  "green",
  "violet",
  "red",
]

export const CATEGORICAL_COLOR_LABELS: Record<CategoricalColor, string> = {
  blue: "Blue",
  orange: "Orange",
  aqua: "Aqua",
  yellow: "Yellow",
  magenta: "Magenta",
  green: "Green",
  violet: "Violet",
  red: "Red",
}

/* ---------------------------------- Time ---------------------------------- */

export const DAYS_OF_WEEK: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
]

/* ------------------------------- Engagement ------------------------------- */

export const DEFAULT_ENGAGEMENT_TASKS: EngagementTaskConfig[] = [
  { key: "reply_comments", label: "Reply to comments", target: 10 },
  { key: "reply_dms", label: "Reply to DMs", target: 5 },
  { key: "comment_creators", label: "Comment on relevant creators", target: 5 },
  { key: "answer_questions", label: "Answer audience questions", target: 3 },
  { key: "collect_questions", label: "Collect audience questions as content ideas", target: 2 },
]

/* ------------------------------ System knowledge -------------------------- */

/** The ten Social Media System Principles (spec §50). */
export const SYSTEM_PRINCIPLES: { title: string; description: string }[] = [
  { title: "Never create content without understanding the audience", description: "Every idea is tied to a persona and a real problem." },
  { title: "Every piece of content needs a purpose", description: "Each item carries a goal and a funnel stage." },
  { title: "Consistency matters more than random bursts", description: "Weekly targets, a posting schedule and a content buffer." },
  { title: "Content ideas should come from real audience problems", description: "The Problem Bank and Question Bank feed the Idea Bank." },
  { title: "Winning ideas should be repeated from different angles", description: "Winners get variations, follow-ups and new hooks." },
  { title: "One good idea should produce multiple content assets", description: "The Repurposing Engine and Content Tree." },
  { title: "Performance data should influence future content", description: "Winner detection, reviews and recommendations close the loop." },
  { title: "Personal experiences create differentiation", description: "The Story Vault makes AI drafts sound like you." },
  { title: "Do not chase virality at the expense of positioning", description: "Scores measure quality and fit, not predicted virality." },
  { title: "Build recognizable expertise over time", description: "Pillars and positioning keep the message consistent." },
]

/** The core personal brand flywheel (spec §51). */
export const FLYWHEEL_STEPS: { label: string; description: string }[] = [
  { label: "Expertise", description: "What you know and have lived" },
  { label: "Content", description: "Expertise packaged for your audience" },
  { label: "Attention", description: "The right people start noticing" },
  { label: "Trust", description: "Consistent value builds credibility" },
  { label: "Authority", description: "You become the go-to voice" },
  { label: "Community", description: "Followers become conversations" },
  { label: "Opportunity", description: "Clients, partners, invitations" },
  { label: "Experience", description: "New experiences to learn from" },
  { label: "More content", description: "…which feeds the next cycle" },
]

/** Content operating rhythm (spec §52). `href` links each habit to where it happens. */
export const OPERATING_RHYTHM: Record<
  "daily" | "weekly" | "monthly",
  { label: string; steps: { label: string; description: string; href: string }[] }
> = {
  daily: {
    label: "Daily",
    steps: [
      { label: "Capture", description: "Dump ideas the moment they appear", href: "/ideas" },
      { label: "Create", description: "Move one piece forward", href: "/studio" },
      { label: "Review", description: "Approve what's waiting", href: "/pipeline" },
      { label: "Publish", description: "Ship what's scheduled", href: "/today" },
      { label: "Engage", description: "Reply, comment, collect questions", href: "/today" },
    ],
  },
  weekly: {
    label: "Weekly",
    steps: [
      { label: "Analyze", description: "Review last week's numbers", href: "/reports" },
      { label: "Plan", description: "Run the Weekly Planner", href: "/calendar/planner" },
      { label: "Produce", description: "Batch record and write", href: "/pipeline" },
      { label: "Schedule", description: "Fill the calendar", href: "/calendar" },
      { label: "Experiment", description: "Run one deliberate test", href: "/experiments" },
    ],
  },
  monthly: {
    label: "Monthly",
    steps: [
      { label: "Review", description: "Monthly brand review", href: "/reports/monthly" },
      { label: "Position", description: "Revisit positioning", href: "/strategy" },
      { label: "Optimize", description: "Rebalance pillars and platforms", href: "/pillars" },
      { label: "Double Down", description: "Replicate winners", href: "/winners" },
      { label: "Remove Weak Strategies", description: "Stop what isn't working", href: "/analytics" },
    ],
  },
}

/** Recommended starting pillars (spec §6). */
export const PILLAR_PRESETS: {
  name: string
  description: string
  color: CategoricalColor
  icon: string
  target_percentage: number
  examples: string[]
}[] = [
  { name: "Education", description: "Teach useful concepts", color: "blue", icon: "GraduationCap", target_percentage: 30, examples: ["How-to", "Tutorials", "Frameworks", "Mistakes", "Tips", "Tools", "Systems"] },
  { name: "Authority", description: "Demonstrate expertise", color: "orange", icon: "Award", target_percentage: 20, examples: ["Industry opinions", "Case studies", "Analysis", "Predictions", "Strategic breakdowns", "Lessons from experience"] },
  { name: "Journey", description: "Document real experiences", color: "aqua", icon: "Route", target_percentage: 20, examples: ["What I'm currently building", "Behind the scenes", "Lessons learned", "Failures", "Wins", "Experiments"] },
  { name: "Leadership", description: "Lead teams and make decisions", color: "yellow", icon: "Users", target_percentage: 15, examples: ["Team management", "Culture", "Decision making", "Hiring", "Accountability", "Leadership lessons"] },
  { name: "Personal", description: "Build human connection", color: "magenta", icon: "Heart", target_percentage: 10, examples: ["Personal stories", "Beliefs", "Values", "Routines", "Life lessons", "Reflections"] },
  { name: "Business", description: "Conversion content", color: "green", icon: "Briefcase", target_percentage: 5, examples: ["Offers", "Projects", "Services", "Companies", "Opportunities", "Recruitment", "Partnerships", "CTA content"] },
]

/** Content Health Score bands (spec §2). */
export const HEALTH_BANDS: { min: number; label: string; tone: "good" | "warning" | "serious" | "critical" }[] = [
  { min: 80, label: "Healthy Content System", tone: "good" },
  { min: 60, label: "Stable — Needs Attention", tone: "warning" },
  { min: 40, label: "At Risk", tone: "serious" },
  { min: 0, label: "Critical", tone: "critical" },
]
