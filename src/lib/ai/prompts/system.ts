/**
 * Brand Voice system prompt (spec §29 + §57) and the compact text rendering of the
 * Brand Context / analytics snapshot that every prompt carries.
 */
import { FUNNEL_STAGES, HOOK_CATEGORIES, PERFORMANCE_TIERS, PLATFORMS } from "@/lib/constants"
import type { AnalyticsSnapshot, BrandContext } from "../context"
import { labelOf, refOf } from "../refs"

const fmt = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits })

const LANGUAGE_RULES: Record<BrandContext["brand"]["language"], string> = {
  english: "Write in natural, plain, conversational English.",
  tagalog:
    "Write in natural, conversational Filipino (Tagalog), the way the creator actually talks. Keep the technical terms Filipinos normally say in English (ads, ROAS, budget, content, sales). Never produce stiff, textbook or word-for-word-translated Tagalog.",
  taglish:
    "Write in Taglish: natural Filipino–English code-switching, the way Metro Manila professionals actually talk and post. Switch at the phrase level — English for technical and business terms, Tagalog for emphasis, emotion and connection (e.g. “Real talk: kung hindi mo alam ang numbers mo, huwag ka munang mag-scale.”). Don't translate English sentence by sentence, and don't write a whole piece in only one language.",
}

function line(label: string, value: string | null | undefined): string {
  const v = (value ?? "").trim()
  return v ? `${label}: ${v}` : ""
}

function block(title: string, lines: (string | false | null | undefined)[]): string {
  const body = lines.filter((l): l is string => typeof l === "string" && l.trim() !== "")
  return body.length ? `## ${title}\n${body.join("\n")}` : ""
}

/**
 * Compact, human-readable rendering of the Brand Context with short refs instead of UUIDs.
 * `voice: false` omits the voice rules (the system prompt states them once in its Voice section).
 */
export function renderBrandContext(ctx: BrandContext, options: { voice?: boolean } = {}): string {
  const b = ctx.brand
  const voice = options.voice ?? true
  const identity = [b.name, b.role].filter(Boolean).join(" — ")
  const sections: string[] = []

  sections.push(
    block("Brand HQ", [
      line("Creator", `${identity}${b.brand_name && !identity.includes(b.brand_name) ? ` (${b.brand_name})` : ""}`),
      line("Industry", [b.industry, b.location, b.years_experience ? `${b.years_experience} years of experience` : ""].filter(Boolean).join(" · ")),
      line("Positioning", b.positioning_statement),
      line("Who I am", b.who_am_i),
      line("Known for", b.known_for),
      line("Point of view", b.point_of_view),
      line("Problems I solve", b.problems_solved),
      line("Why listen", b.why_listen),
      line("Expertise", b.expertise_summary),
      line("Expertise areas", b.expertise_areas.join(", ")),
      voice && line("Personality", b.personality.join(", ")),
      voice && line("Tone", b.tones.join(", ")),
      voice && line("Language", b.language === "english" ? "English" : b.language === "tagalog" ? "Tagalog" : "Taglish"),
      voice && line("Always", b.always_do),
      voice && line("Never", b.never_do),
      voice && line("Phrases I use", b.phrases_used.map((p) => `“${p}”`).join(" · ")),
      voice && line("Words to avoid", b.phrases_avoid.join(", ")),
      voice && line("CTA style", b.cta_style),
      voice && line("Storytelling style", b.storytelling_style),
    ])
  )

  sections.push(
    block(
      "Goals",
      ctx.goals.map(
        (g) =>
          `- ${refOf(ctx, "goal", g.id)}${g.is_primary ? " [primary]" : g.is_secondary ? " [secondary]" : ""} ${g.name} (${g.category})${g.target ? ` — target ${g.target}` : ""}`
      )
    )
  )

  sections.push(
    block(
      "Content Pillars (target share | last 30 days)",
      ctx.pillars.map(
        (p) =>
          `- ${refOf(ctx, "pillar", p.id)} ${p.name} — target ${p.target_percentage}%${p.recent_share !== null ? ` | now ${fmt(p.recent_share, 0)}%` : ""}. ${p.description}${p.examples.length ? ` e.g. ${p.examples.slice(0, 4).join("; ")}` : ""}`
      )
    )
  )

  sections.push(
    block(
      "Personas",
      ctx.personas.map((p) =>
        [
          `- ${refOf(ctx, "persona", p.id)}${p.is_primary ? " [primary]" : ""} ${p.name} — ${[p.profession, p.experience_level].filter(Boolean).join("; ")}${p.platforms.length ? `; on ${p.platforms.map((x) => PLATFORMS[x].label).join(", ")}` : ""}`,
          p.goals.length ? `  Goals: ${p.goals.join("; ")}` : "",
          p.problems.length ? `  Problems: ${p.problems.join("; ")}` : "",
          p.frustrations.length ? `  Frustrations: ${p.frustrations.join("; ")}` : "",
          p.questions.length ? `  Asks: ${p.questions.join("; ")}` : "",
          p.is_primary && p.objections.length ? `  Objections: ${p.objections.join("; ")}` : "",
          p.language_used.length ? `  Their words: ${p.language_used.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
  )

  sections.push(
    block(
      "Problem Bank (severity 1–5)",
      ctx.problems.map((p) => {
        const links = [refOf(ctx, "persona", p.persona_id), refOf(ctx, "pillar", p.pillar_id)].filter(Boolean).join(", ")
        return `- ${refOf(ctx, "problem", p.id)} [sev ${p.severity}${links ? `; ${links}` : ""}] ${p.problem}`
      })
    )
  )

  sections.push(
    block(
      "Question Bank (times asked)",
      ctx.questions.map((q) => {
        const links = [refOf(ctx, "persona", q.persona_id), refOf(ctx, "pillar", q.pillar_id)].filter(Boolean).join(", ")
        return `- ${refOf(ctx, "question", q.id)} [×${q.frequency}${links ? `; ${links}` : ""}] ${q.question}`
      })
    )
  )

  sections.push(
    block(
      "Platforms (last 90 days)",
      ctx.platforms.map((p) => {
        const perf = p.posts_90d
          ? `${p.posts_90d} posts, ${fmt(p.avg_views)} avg views, ${fmt(p.engagement_rate, 1)}% engagement`
          : "no measured posts yet"
        const formats = p.preferred_format_ids.map((id) => ctx.formats.find((f) => f.id === id)?.name).filter(Boolean)
        const pillars = p.preferred_pillar_ids.map((id) => refOf(ctx, "pillar", id)).filter(Boolean)
        return [
          `- ${p.label}: ${p.posting_frequency ? `${p.posting_frequency} posts/week target; ` : ""}${perf}`,
          formats.length ? `; prefers ${formats.join(", ")}` : "",
          pillars.length ? `; pillars ${pillars.join(", ")}` : "",
          p.audience ? `. Audience: ${p.audience}` : "",
          p.cta_style ? ` CTA: ${p.cta_style}` : "",
        ].join("")
      })
    )
  )

  if (ctx.formats.length) {
    sections.push(`## Content formats\n${ctx.formats.map((f) => `${refOf(ctx, "format", f.id)} ${f.name}`).join(" · ")}`)
  }
  if (ctx.angles.length) {
    sections.push(`## Angles\n${ctx.angles.map((a) => `${refOf(ctx, "angle", a.id)} ${a.name}`).join(" · ")}`)
  }
  if (ctx.hook_performance.length) {
    sections.push(
      `## Hook styles by avg views vs overall (last 90 days)\n${ctx.hook_performance
        .map((h) => `${h.label} ${h.ratio !== null ? `${fmt(h.ratio, 2)}×` : "—"} (${h.posts} posts)`)
        .join(" · ")}`
    )
  }
  sections.push(
    block(
      "Hook Library favourites (___ = blank to fill)",
      ctx.top_hooks.map((h) => `- [${HOOK_CATEGORIES[h.category]?.label ?? h.category}] “${h.text}”`)
    )
  )
  sections.push(
    block(
      "Recent winners",
      ctx.winners.map((w) => {
        const bits = [
          `${PERFORMANCE_TIERS[w.tier]?.label ?? w.tier}${w.ratio !== null ? ` ${fmt(w.ratio, 1)}×` : ""} on ${PLATFORMS[w.platform]?.label ?? w.platform}`,
          `${fmt(w.views)} views`,
          refOf(ctx, "pillar", w.pillar_id),
          ctx.formats.find((f) => f.id === w.format_id)?.name ?? "",
          w.hook_category ? `${w.hook_category} hook` : "",
        ].filter(Boolean)
        return `- “${w.title}” — ${bits.join(", ")}${w.hook && w.hook !== w.title ? `. Hook: “${w.hook}”` : ""}${w.why_it_worked ? `. Why it worked: ${w.why_it_worked}` : ""}`
      })
    )
  )
  if (ctx.recent_titles.length) {
    sections.push(`## Recently published (don't repeat)\n${ctx.recent_titles.slice(0, 20).map((t) => `“${t}”`).join(" · ")}`)
  }
  sections.push(
    block(
      "Story Vault",
      ctx.stories.map((s) => {
        const star = [
          line("Situation", s.situation),
          line("Problem", s.problem),
          line("Action", s.action),
          line("Result", s.result),
          line("Emotion", s.emotion),
        ].filter(Boolean)
        return `- ${refOf(ctx, "story", s.id)} [${s.type}${s.is_favorite ? ", favourite" : ""}${s.pillar_id ? `, ${refOf(ctx, "pillar", s.pillar_id)}` : ""}] ${s.title}${star.length ? `. ${star.join(" ")}` : ""}${s.lesson ? ` Lesson: ${s.lesson}` : ""}${s.keywords.length ? ` (${s.keywords.join(", ")})` : ""}`
      })
    )
  )
  sections.push(
    block(
      "Posting schedule",
      ctx.schedule.map(
        (s) =>
          `- ${s.day}: ${[s.label, labelOf(ctx, "pillar", s.pillar_id), ctx.formats.find((f) => f.id === s.format_id)?.name].filter(Boolean).join(" / ")}${s.platforms.length ? ` on ${s.platforms.map((p) => PLATFORMS[p].label).join(", ")}` : ""}${s.time ? ` at ${s.time}` : ""}`
      )
    )
  )
  const ft = ctx.settings.funnel_targets
  sections.push(
    `## Settings\nWeekly target: ${ctx.settings.weekly_post_target} posts. Funnel targets: ${FUNNEL_STAGES.tofu.label} ${ft.tofu}% / ${FUNNEL_STAGES.mofu.label} ${ft.mofu}% / ${FUNNEL_STAGES.bofu.label} ${ft.bofu}%. Week starts ${ctx.settings.week_starts_on === 0 ? "Sunday" : "Monday"}.`
  )

  return sections.filter(Boolean).join("\n\n")
}

/** Numbers-only rendering of an analytics snapshot (pillars shown as refs). */
export function renderSnapshot(snapshot: AnalyticsSnapshot, ctx: BrandContext): string {
  const s = snapshot
  const pillar = (id: string | null) => labelOf(ctx, "pillar", id) || "no pillar"
  const group = (title: string, rows: AnalyticsSnapshot["platforms"]) =>
    rows.length
      ? `${title}: ${rows
          .map((g) => `${g.label} ${fmt(g.avg_views)} avg views${g.ratio !== null ? ` (${fmt(g.ratio, 2)}×)` : ""}, ${fmt(g.engagement_rate, 1)}% ER, ${g.posts} posts${g.leads ? `, ${g.leads} leads` : ""}`)
          .join("; ")}`
      : ""
  return [
    `Content Health Score: ${s.health.score}/100 (${s.health.band}). ${s.health.components.map((c) => `${c.label} ${fmt(c.score, 1)}/${c.max} — ${c.detail}`).join(" | ")}`,
    `Content Buffer: ${fmt(s.buffer.days, 1)} days (${s.buffer.ready_count} ready; status ${s.buffer.label || s.buffer.status}; target ${s.buffer.target_days} days).`,
    `This week: ${s.weekly.published}/${s.weekly.target} posts published (${s.weekly.pct}%), ${s.weekly.scheduled_remaining} scheduled, ${s.weekly.days_left} days left — ${s.weekly.on_track ? "on track" : "behind"}.`,
    `Last 30 days: ${s.totals_30d.posts} posts, ${fmt(s.totals_30d.views)} views, ${fmt(s.totals_30d.engagements)} engagements (${fmt(s.totals_30d.engagement_rate, 1)}% ER), ${s.totals_30d.leads} leads, ${fmt(s.totals_30d.followers_gained)} followers gained.`,
    s.engagement_trend.change_pct !== null
      ? `Engagement trend: ${s.engagement_trend.change_pct > 0 ? "+" : ""}${s.engagement_trend.change_pct}% vs the 90 days before (${fmt(s.engagement_trend.current, 1)}% vs ${fmt(s.engagement_trend.previous, 1)}%).`
      : "",
    s.pillar_mix.length
      ? `Pillar mix (last 30 days, actual vs target): ${s.pillar_mix.map((r) => `${refOf(ctx, "pillar", r.pillar_id) || r.label} ${r.label} ${fmt(r.actual_pct, 0)}% vs ${fmt(r.target_pct, 0)}%`).join("; ")}`
      : "",
    s.funnel_mix.length ? `Funnel mix: ${s.funnel_mix.map((r) => `${r.label} ${fmt(r.actual_pct, 0)}% vs ${fmt(r.target_pct, 0)}%`).join("; ")}` : "",
    s.mix_warnings.length ? `Mix warnings: ${s.mix_warnings.join(" | ")}` : "",
    group("Platforms (90 days)", s.platforms),
    group("Pillars (90 days)", s.pillars),
    group("Formats (90 days)", s.formats),
    group("Hook styles (90 days)", s.hook_styles),
    s.winners.length
      ? `Winners: ${s.winners.map((w) => `“${w.title}” (${w.tier}${w.ratio !== null ? ` ${fmt(w.ratio, 1)}×` : ""}, ${fmt(w.views)} views, ${w.platform}, ${pillar(w.pillar_id)})`).join("; ")}`
      : "",
    s.underperformers.length
      ? `Underperformers: ${s.underperformers.map((w) => `“${w.title}” (${w.ratio !== null ? `${fmt(w.ratio, 2)}×` : "—"} baseline, ${fmt(w.views)} views, ${w.platform}, ${pillar(w.pillar_id)})`).join("; ")}`
      : "",
    s.insights.length ? `Insights: ${s.insights.map((i) => `[${i.type}] ${i.text}`).join(" | ")}` : "",
    s.recommendations.length
      ? `Decision engine picks: ${s.recommendations.map((r) => `“${r.title}” (${r.score}/100, ${r.platform}; ${r.reasons.topic})`).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function hasBrand(ctx: BrandContext): boolean {
  const b = ctx.brand
  return Boolean(b.name || b.brand_name || b.positioning_statement || b.point_of_view || ctx.pillars.length)
}

/**
 * The system prompt for every task: who we write for, the voice rules, the reasoning and honesty
 * rules, then the full Brand HQ context. Task-specific rules are appended by the gateway.
 */
export function brandVoiceSystemPrompt(ctx: BrandContext): string {
  const b = ctx.brand
  const who = b.name || "the creator"
  const first = b.name ? b.name.replace(/["“”].*?["“”]\s*/g, "").split(/\s+/)[0] : "the creator"
  const brandLabel = b.brand_name || b.name || "this personal brand"
  const rules = [
    `You are the Content Strategist and ghostwriter inside the Personal Brand Content OS for ${brandLabel}. You write as and for ${who}${b.role ? ` (${b.role})` : ""} — in their voice, for their audience, toward their goals.`,
    "Before writing anything, read the Brand HQ context below. Every output must fit the positioning, audience, pillars, goals and voice described there.",
    "",
    "# Voice",
    `- ${LANGUAGE_RULES[b.language]}`,
    b.tones.length ? `- Tone: ${b.tones.join(", ")}.` : "",
    b.personality.length ? `- Personality: ${b.personality.join(", ")}.` : "",
    b.always_do ? `- Always: ${b.always_do}` : "",
    b.never_do ? `- Never: ${b.never_do}` : "",
    b.phrases_used.length ? `- Signature phrases (use naturally — at most one or two per piece, never forced): ${b.phrases_used.map((p) => `“${p}”`).join(", ")}.` : "",
    b.phrases_avoid.length ? `- Never use these words or phrases: ${b.phrases_avoid.join(", ")}.` : "",
    b.cta_style ? `- CTA style: ${b.cta_style}` : "",
    b.storytelling_style ? `- Storytelling style: ${b.storytelling_style}` : "",
    "",
    "# How to write",
    `- Be specific, personal and opinionated where it fits. Sound like ${first}, not like a brand account: concrete numbers, real situations, the audience's own words.`,
    "- No generic corporate copy or clichés (“in today's fast-paced world”, “unlock your potential”, “game-changer”, “level up”, “take it to the next level”, “dive in”). No emoji walls, no hashtag spam.",
    "- Ground ideas in real audience problems and questions from the Problem Bank, Question Bank and personas, and in what has actually worked for this brand (recent winners, hook performance).",
    `- Never invent facts about ${who}'s life, clients, numbers or results. Use only experiences and numbers that appear in the Story Vault, winners or Brand HQ; otherwise speak generally or leave a clear placeholder like [add your number].`,
    "- When you recommend or decide something, explain why using what actually applies: positioning, audience, goal, platform, pillar, funnel stage, recent performance, existing content, audience problems and previous winners — cite the numbers from the context.",
    "- Don't repeat recently published titles; find a fresh angle instead.",
    "- Never claim to predict virality or guarantee results. Scores are quality evaluations, not predictions.",
    "- Never copy or closely paraphrase other creators' content. Borrow structure and psychology only; the substance must come from this creator's expertise and stories.",
    "- Id fields: use only the short refs shown in the context (P1 pillar, A1 persona, R1 problem, Q1 question, F1 format, N1 angle, S1 story, G1 goal) or refs given in the task. Never invent one — use null when nothing fits.",
    "- Respond only with data matching the requested JSON schema. Fields are plain text unless the task says markdown.",
    "",
    `# Brand HQ and workspace context (today is ${ctx.weekday ? `${ctx.weekday}, ` : ""}${ctx.today || "unknown"})`,
    hasBrand(ctx)
      ? renderBrandContext(ctx, { voice: false })
      : "Brand HQ has not been filled in yet. Work from the task input, keep claims modest, and leave placeholders where personal details are needed.\n\n" +
        renderBrandContext(ctx, { voice: false }),
  ]
  return rules.filter((r, i, all) => r !== "" || (all[i - 1] ?? "") !== "").join("\n")
}
