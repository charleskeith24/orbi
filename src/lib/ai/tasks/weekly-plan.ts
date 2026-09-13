import * as z from "zod"
import { PLATFORMS } from "@/lib/constants"
import type { PlatformId } from "@/lib/types"
import { createKit } from "../offline/brand"
import { hookSlots, writeHook } from "../offline/hooks"
import { generateOfflineIdeas } from "../offline/ideas"
import { overlap, seedFor, tokenSet, truncateWords } from "../offline/text"
import { analyzeTopic } from "../offline/topic"
import { labelOf, resolveRef } from "../refs"
import { contextRefSchema, defineTask, optionalId, pickListId, platformSchema } from "./shared"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const input = z.object({
  week_start: isoDate,
  focus: z.string().trim().max(300).default(""),
  target: z.number().int().min(1).max(50).default(10),
  slots: z
    .array(
      z.object({
        date: isoDate,
        day: z.string().max(12).default(""),
        label: z.string().max(120).default(""),
        pillar_id: optionalId,
        format: z.string().max(80).default(""),
        platforms: z.array(platformSchema).max(7).default([]),
        time: z.string().max(5).nullable().default(null),
      })
    )
    .max(40)
    .default([]),
  candidates: z
    .array(
      z.object({
        kind: z.enum(["idea", "item"]).default("idea"),
        id: z.string(),
        title: z.string().max(300),
        pillar_id: optionalId,
        platform: platformSchema.nullish().transform((v) => v ?? null),
        format: z.string().max(80).default(""),
        hook: z.string().max(500).default(""),
        score: z.number().default(0),
        reason: z.string().max(300).default(""),
      })
    )
    .max(30)
    .default([]),
  top_performers: z
    .array(z.object({ title: z.string().max(300), platform: platformSchema, views: z.number().default(0), ratio: z.number().nullable().default(null), pillar_id: optionalId, hook: z.string().max(500).default("") }))
    .max(10)
    .default([]),
  already_scheduled: z.array(z.object({ date: isoDate, title: z.string().max(300), platform: platformSchema })).max(40).default([]),
})

const output = z.object({
  plan: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD within the week"),
      slot_label: z.string(),
      title: z.string(),
      idea_id: z.string().nullable().describe('Candidate ref (e.g. "C3") when using an existing idea or item, else null for a new idea'),
      item_id: z.string().nullable().describe("Always null — filled in from the candidate after planning"),
      platform: platformSchema,
      format: z.string(),
      pillar_id: contextRefSchema("content pillar", "P1"),
      hook: z.string(),
      reason: z.string().describe("One sentence: why this piece in this slot"),
    })
  ),
})

type PlanRow = z.output<typeof output>["plan"][number]

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const WEEKDAY_RE = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return WEEKDAY_NAMES[new Date(y, m - 1, d).getDay()] ?? ""
}

export const weeklyPlanTask = defineTask({
  name: "weekly_plan",
  description: "Weekly Planner: fill the week's posting slots with the best ideas for the focus, pillar mix and what's been winning.",
  input,
  output,
  maxTokens: 6000,

  buildPrompt(ctx, i) {
    const candidates = i.candidates.map((c, n) => ({ ref: `C${n + 1}`, kind: c.kind, title: c.title, pillar: labelOf(ctx, "pillar", c.pillar_id) || null, platform: c.platform, format: c.format, hook: c.hook, engine_score: c.score, reason: c.reason }))
    return {
      user: [
        `Task: plan the week starting ${i.week_start}: ${i.target} posts${i.focus ? `, with this strategic focus: “${i.focus}”` : ""}.`,
        `<posting_slots>\n${JSON.stringify(i.slots.map((s) => ({ ...s, pillar: labelOf(ctx, "pillar", s.pillar_id) || null, pillar_id: undefined })), null, 1)}\n</posting_slots>`,
        `<candidate_ideas>\n${JSON.stringify(candidates, null, 1)}\n</candidate_ideas>`,
        i.top_performers.length ? `<top_performers>\n${JSON.stringify(i.top_performers.map((t) => ({ ...t, pillar: labelOf(ctx, "pillar", t.pillar_id) || null, pillar_id: undefined })), null, 1)}\n</top_performers>` : "",
        i.already_scheduled.length ? `<already_scheduled>\n${JSON.stringify(i.already_scheduled, null, 1)}\n</already_scheduled>` : "",
        `Return ${Math.max(0, i.target - i.already_scheduled.length)} new plan rows. Fill the posting slots first (match each slot's pillar, format and platforms), then add extra posts on the lightest days. Prefer candidate ideas (reference them by C ref in idea_id); propose a new idea (idea_id null) only when no candidate fits. Balance pillars toward their targets, lean on what top performers show works, and give each row a one-sentence reason.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("weekly_plan", i))
    const needed = Math.max(0, Math.min(21, i.target - i.already_scheduled.length))
    const focus = tokenSet(i.focus)
    const used = new Set<string>()
    const scheduledKeys = new Set(i.already_scheduled.map((s) => `${s.date}|${s.platform}`))
    const weekdays = Array.from({ length: 7 }, (_, d) => addDaysIso(i.week_start, d))
    const slots = [...i.slots].sort((a, b) => a.date.localeCompare(b.date)).filter((s) => !s.platforms.length || s.platforms.some((p) => !scheduledKeys.has(`${s.date}|${p}`)))
    const topPlatform: PlatformId = i.top_performers[0]?.platform ?? kit.platformsFor()[0]
    const rows: PlanRow[] = []

    const choose = (pillarId: string | null, platform: PlatformId | null) => {
      let best: { c: (typeof i.candidates)[number]; score: number } | null = null
      for (const c of i.candidates) {
        if (used.has(c.id)) continue
        const score = c.score + (pillarId && c.pillar_id === pillarId ? 30 : 0) + (platform && c.platform === platform ? 10 : 0) + overlap(focus, tokenSet(c.title)) * 25
        if (!best || score > best.score) best = { c, score }
      }
      return best?.c ?? null
    }

    const fill = (date: string, slotLabel: string, pillarId: string | null, platformHint: PlatformId | null, formatName: string) => {
      const c = choose(pillarId, platformHint)
      let title: string
      let hook: string
      let platform: PlatformId = platformHint ?? c?.platform ?? topPlatform
      let reasonBits: string[] = []
      const pillar = ctx.pillars.find((p) => p.id === (pillarId ?? c?.pillar_id))
      if (c) {
        used.add(c.id)
        title = c.title
        hook = c.hook || writeHook(kit.hookCategories()[0] ?? "curiosity", hookSlots(analyzeTopic(c.title), kit), kit, kit.rng).text
        platform = platformHint ?? c.platform ?? topPlatform
        // The engine's reasons were computed for today; one that names another weekday's slot doesn't apply here.
        const reason = c.reason && (!WEEKDAY_RE.test(c.reason) || c.reason.includes(weekdayOf(date))) ? c.reason : ""
        reasonBits = [
          slotLabel ? `${slotLabel} slot${pillar ? ` (${pillar.name})` : ""}` : "Extra post on a light day",
          reason || (c.score ? `decision score ${Math.round(c.score)}/100` : ""),
          focus.size && overlap(focus, tokenSet(c.title)) > 0 ? `fits the focus “${truncateWords(i.focus, 8)}”` : "",
        ]
      } else {
        const [idea] = generateOfflineIdeas(ctx, kit, { count: 1, pillarId: pillar?.id ?? null, platform: platformHint, topic: i.focus || null, avoidTitles: rows.map((r) => r.title) })
        title = idea?.title ?? `${pillar?.name ?? "Open"} post`
        hook = idea?.hook ?? ""
        reasonBits = [slotLabel ? `${slotLabel} slot` : "Extra post", "no matching idea in the Idea Bank — new idea from your Problem Bank and pillars"]
      }
      const format = formatName || c?.format || kit.formatFor(platform)?.name || ""
      rows.push({
        date,
        slot_label: slotLabel || "Extra",
        title,
        idea_id: c ? c.id : null,
        item_id: null,
        platform,
        format,
        pillar_id: pillar?.id ?? c?.pillar_id ?? null,
        hook,
        reason: `${reasonBits.filter(Boolean).join("; ")}.`,
      })
    }

    for (const slot of slots) {
      if (rows.length >= needed) break
      const platform = slot.platforms.find((p) => !scheduledKeys.has(`${slot.date}|${p}`)) ?? slot.platforms[0] ?? null
      fill(slot.date, slot.label || `${slot.day} slot`, slot.pillar_id, platform, slot.format)
    }
    for (let n = 0; rows.length < needed && n < 21; n++) {
      const load = (d: string) => rows.filter((r) => r.date === d).length + i.already_scheduled.filter((s) => s.date === d).length
      const day = [...weekdays].sort((a, b) => load(a) - load(b) || a.localeCompare(b))[0]
      fill(day, "", null, n % 2 === 0 ? topPlatform : null, "")
    }
    return { plan: kit.scrubDeep(rows.sort((a, b) => a.date.localeCompare(b.date))) }
  },

  finalize(out, ctx, i) {
    const days = new Set(Array.from({ length: 7 }, (_, d) => addDaysIso(i.week_start, d)))
    return {
      plan: out.plan
        .filter((row) => days.has(row.date))
        .map((row) => {
          const id = pickListId(row.idea_id ?? row.item_id, i.candidates)
          const candidate = i.candidates.find((c) => c.id === id)
          return {
            ...row,
            idea_id: candidate?.kind === "idea" ? candidate.id : null,
            item_id: candidate?.kind === "item" ? candidate.id : null,
            pillar_id: resolveRef(ctx, "pillar", row.pillar_id) ?? candidate?.pillar_id ?? null,
            platform: (row.platform in PLATFORMS ? row.platform : (candidate?.platform ?? "facebook")) as PlatformId,
          }
        }),
    }
  },
})
