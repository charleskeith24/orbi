import * as z from "zod"
import { LANGUAGE_MAP } from "@/lib/constants"
import { EMPTY_BRAND_CONTEXT, positioningStatement } from "../context"
import { discoverNiches, toHundred } from "../offline/niche"
import { uniqueBy } from "../offline/text"
import { clampInt, defineTask, jsonBlock, uniqueStrings } from "./shared"

/** What the brand should do for the creator ("Para saan"). */
export const NICHE_AIMS = ["clients", "career", "audience", "products", "speaking", "community"] as const
export type NicheAim = (typeof NICHE_AIMS)[number]

/** expertise = built on skills (galing) · passion = built on interests (hilig) · audience = built on who they help. */
export const NICHE_KINDS = ["expertise", "passion", "audience"] as const
export type NicheKind = (typeof NICHE_KINDS)[number]

const text = (max: number) => z.string().trim().max(max).default("")
const list = (items: number, len: number) => z.array(z.string().trim().max(len)).max(items).default([])

const input = z.object({
  language: z.enum(["english", "tagalog", "taglish"]).default("english"),
  name: text(120),
  /** Hilig — topics they could talk about for hours. */
  interests: list(12, 80),
  /** Galing — skills and what they're known for. */
  skills: list(12, 80),
  help_requests: text(600),
  years_experience: z.number().int().min(0).max(80).nullable().default(null),
  proof: text(600),
  story: text(2000),
  /** Kanino — who they want to help. */
  audiences: list(8, 80),
  audience_level: text(40),
  audience_stage: text(300),
  audience_goal: text(300),
  audience_problems: list(10, 200),
  /** Para saan. */
  aims: z.array(z.enum(NICHE_AIMS)).max(6).default([]),
  role: text(160),
  industry: text(160),
})

const fit = z.object({ score: z.number().describe("1–10"), reason: z.string().describe("One line that cites the creator's own input") })

const option = z.object({
  kind: z.enum(NICHE_KINDS).describe("expertise = built on their skills; passion = built on their interests; audience = built on who they help and those people's problems"),
  name: z.string().describe("Short, specific name for the direction"),
  niche_statement: z.string().describe("The niche in one clear sentence"),
  audience: z.string().describe("A specific audience"),
  industry: z.string(),
  positioning_statement: z.string().describe("I help [audience] [result] through [method]."),
  positioning_audience: z.string(),
  positioning_result: z.string().describe("A verb phrase, e.g. “save consistently on a regular salary”"),
  positioning_method: z.string(),
  pillars: z
    .array(z.object({ name: z.string(), description: z.string(), target_percentage: z.number() }))
    .describe("4–6 pillars named for this niche (never generic names like Education or Authority); targets sum to 100"),
  sample_posts: z.array(z.object({ title: z.string(), hook: z.string() })).describe("Exactly 5"),
  monetization: z.array(z.string()).describe("2–4 ways this niche can earn, matched to their goals"),
  fit: z.object({ passion: fit, expertise: fit, demand: fit }),
  why_it_fits: z.string(),
  risk: z.string().describe("One honest risk"),
})

const output = z.object({
  options: z.array(option).describe("Exactly 3 — one expertise-led, one passion-led, one audience-led"),
  notes: z.array(z.string()).describe("Honest guidance when the input is thin; empty when it's strong"),
})

export type NicheDiscoveryInput = z.output<typeof input>
export type NicheDiscoveryOutput = z.output<typeof output>
export type NicheOption = NicheDiscoveryOutput["options"][number]

const AIM_MEANING: Record<NicheAim, string> = {
  clients: "get clients for services, freelancing or consulting",
  career: "land a better job or get promoted",
  audience: "grow an audience and influence",
  products: "sell products, templates or courses",
  speaking: "get speaking, media and collaboration invites",
  community: "build a community",
}

/** Clean every option; anything missing or malformed is filled from the offline direction of the same kind. */
function finalizeNiches(out: NicheDiscoveryOutput, a: NicheDiscoveryInput): NicheDiscoveryOutput {
  const fallback = discoverNiches(a)
  const picked = out.options.slice(0, 3)
  while (picked.length < 3) picked.push(fallback.options[picked.length])
  const kinds = new Set(picked.map((o) => o.kind))
  const options = picked.map((o, i): NicheOption => {
    const kind = kinds.size === 3 ? o.kind : NICHE_KINDS[i]
    const fb = fallback.options.find((x) => x.kind === kind) ?? fallback.options[i]
    const str = (value: string, backup: string) => value.trim() || backup
    const pillars = uniqueBy(
      o.pillars.filter((p) => p.name.trim()),
      (p) => p.name.trim()
    )
      .slice(0, 6)
      .map((p) => ({ name: p.name.trim().slice(0, 40).trim(), description: p.description.trim().slice(0, 200), target_percentage: p.target_percentage }))
    for (const p of fb.pillars) {
      if (pillars.length >= 4) break
      if (!pillars.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) pillars.push({ ...p })
    }
    const targets = toHundred(pillars.map((p) => (Number.isFinite(p.target_percentage) && p.target_percentage > 0 ? p.target_percentage : 1)))
    const posts = o.sample_posts.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), hook: p.hook.trim() }))
    for (const p of fb.sample_posts) {
      if (posts.length >= 5) break
      if (!posts.some((x) => x.title.toLowerCase() === p.title.toLowerCase())) posts.push(p)
    }
    const fitOf = (key: keyof NicheOption["fit"]) => ({
      score: clampInt(o.fit[key].score, 1, 10, fb.fit[key].score),
      reason: str(o.fit[key].reason, fb.fit[key].reason),
    })
    const audience = str(o.positioning_audience, str(o.audience, fb.positioning_audience))
    return {
      kind,
      name: str(o.name, fb.name),
      niche_statement: str(o.niche_statement, fb.niche_statement),
      audience: str(o.audience, fb.audience),
      industry: str(o.industry, fb.industry),
      positioning_statement: str(o.positioning_statement, positioningStatement(audience, o.positioning_result, o.positioning_method) || fb.positioning_statement),
      positioning_audience: audience,
      positioning_result: str(o.positioning_result, fb.positioning_result),
      positioning_method: str(o.positioning_method, fb.positioning_method),
      pillars: pillars.map((p, n) => ({ ...p, target_percentage: targets[n] })),
      sample_posts: posts.slice(0, 5),
      monetization: uniqueStrings(o.monetization, 5).length ? uniqueStrings(o.monetization, 5) : fb.monetization,
      fit: { passion: fitOf("passion"), expertise: fitOf("expertise"), demand: fitOf("demand") },
      why_it_fits: str(o.why_it_fits, fb.why_it_fits),
      risk: str(o.risk, fb.risk),
    }
  })
  return { options, notes: uniqueStrings(out.notes, 5) }
}

export const nicheDiscoveryTask = defineTask({
  name: "niche_discovery",
  description: "Niche Discovery: three distinct niche directions (expertise-, passion- and audience-led) from the creator's interests, skills, audience and goals.",
  input,
  output,
  maxTokens: 12000,

  // Only what the creator typed describes the brand here — never the loaded workspace (often the demo).
  context: (ctx, a) => ({
    ...EMPTY_BRAND_CONTEXT,
    generated_at: ctx.generated_at,
    today: ctx.today,
    weekday: ctx.weekday,
    brand: { ...EMPTY_BRAND_CONTEXT.brand, name: a.name, role: a.role, industry: a.industry, years_experience: a.years_experience, language: a.language },
  }),

  buildPrompt(_ctx, a) {
    return {
      user: [
        "Task: Niche Discovery. The creator doesn't know their niche yet. From what they typed, propose exactly 3 genuinely different niche directions:",
        "1. kind “expertise” — built on their skills, experience and proof (galing).",
        "2. kind “passion” — built on the topics they love and would talk about unpaid (hilig).",
        "3. kind “audience” — built on who they want to help and those people's problems (kanino); ideally the intersection of hilig × galing × demand.",
        "For each: a short specific name; niche_statement (one clear sentence); a specific audience; industry; positioning parts plus positioning_statement (“I help [audience] [result] through [method].”); 4–6 content pillars named for THIS niche (never generic names like Education, Authority, Journey or Personal) with one-line descriptions and target_percentage summing to 100; exactly 5 sample posts {title, hook}; 2–4 monetization paths that match what they want the brand to do; fit scores 1–10 for passion, expertise and demand, each with a one-line reason that cites their input; why_it_fits; and one honest risk.",
        "notes: short, honest guidance when the input is thin (e.g. “Add one more audience problem to sharpen this”); leave it empty when the input is strong.",
        `Rules: use only what they typed — never invent clients, numbers, credentials or results. Keep it relevant to Filipino creators and professionals. Write every text field in ${LANGUAGE_MAP[a.language].label}${a.language === "english" ? "" : " (natural, the way Filipinos actually post; technical terms stay in English)"}.`,
        `What the brand should do for them (aims): ${a.aims.map((x) => AIM_MEANING[x]).join("; ") || "not chosen yet"}.`,
        jsonBlock("creator_input", { ...a, language: LANGUAGE_MAP[a.language].label }),
      ].join("\n\n"),
    }
  },

  offline: (_ctx, a) => discoverNiches(a),

  finalize: (out, _ctx, a) => finalizeNiches(out, a),
})
