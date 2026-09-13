import * as z from "zod"
import { HOOK_CATEGORIES } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { hookSlots, hookWhy, writeHooks } from "../offline/hooks"
import { seedFor } from "../offline/text"
import { analyzeTopic } from "../offline/topic"
import { defineTask, hookCategorySchema, inputText } from "./shared"

const input = z.object({
  topic: inputText(1000).min(1, "Add a topic first."),
  count: z.number().int().min(1).max(20).default(10),
  categories: z.array(hookCategorySchema).max(11).default([]),
})

const output = z.object({
  hooks: z.array(
    z.object({
      text: z.string(),
      category: hookCategorySchema,
      why: z.string().describe("One sentence: why this hook works, citing this brand's hook performance when relevant"),
    })
  ),
})

export const generateHooksTask = defineTask({
  name: "generate_hooks",
  description: "Hook Library: N hooks for a topic across hook styles, each with why it works.",
  input,
  output,
  maxTokens: 4000,

  buildPrompt(ctx, i) {
    const styles = i.categories.length
      ? i.categories.map((c) => `${c} (${HOOK_CATEGORIES[c].description})`).join("; ")
      : "a mix of styles, weighted toward the styles that perform best for this brand"
    return {
      user: [
        `Task: write exactly ${i.count} distinct hooks for this topic.`,
        `<topic>\n${i.topic}\n</topic>`,
        `Styles: ${styles}.`,
        "Hooks are the first line or first 2 seconds: short, specific, in the creator's voice and language. Use real numbers or stories only when they exist in the context. No clickbait that the content can't pay off, no banned phrases.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("generate_hooks", i))
    const topic = analyzeTopic(i.topic)
    const story = kit.storyFor(i.topic, { minHits: 1 })
    const problem = kit.problemFor(i.topic)
    const categories = i.categories.length ? i.categories : kit.hookCategories().slice(0, 6)
    const hooks = writeHooks(hookSlots(topic, kit, { story, problem: problem?.problem ?? null }), categories, i.count, kit, kit.rng)
    return { hooks: hooks.map((h) => ({ text: h.text, category: h.category, why: hookWhy(h.category, kit) })) }
  },

  finalize(out, _ctx, i) {
    const seen = new Set<string>()
    return {
      hooks: out.hooks
        .filter((h) => {
          const key = h.text.trim().toLowerCase()
          if (!key || seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, i.count),
    }
  },
})
