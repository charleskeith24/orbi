import * as z from "zod"
import { describe, expect, it } from "vitest"
import { outputFormatFor } from "./providers/anthropic"
import { coerceToSchema, parseLoose } from "./schema"
import { AI_TASK_NAMES, getAiTask } from "./tasks"

const schema = z.object({
  category: z.enum(["curiosity", "short_video", "tofu"]),
  title: z.string(),
  score: z.number(),
  tags: z.array(z.string()),
  ref: z.string().nullable(),
  flag: z.boolean(),
  nested: z.object({ items: z.array(z.object({ key: z.string(), n: z.number() })) }),
})

describe("coerceToSchema", () => {
  it("repairs near-miss model output", () => {
    const result = parseLoose(schema, { category: "Short Video", score: "7", tags: "one", ref: "", flag: "true", nested: { items: [{ key: 3 }] } })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ category: "short_video", title: "", score: 7, tags: ["one"], ref: null, flag: true, nested: { items: [{ key: "3", n: 0 }] } })
  })

  it("falls back to the first enum option for unknown values", () => {
    expect((coerceToSchema(schema, { category: "nonsense" }) as { category: string }).category).toBe("curiosity")
  })
})

describe("outputFormatFor (Anthropic structured outputs)", () => {
  it.each(AI_TASK_NAMES)("%s: strict JSON schema with real enums", (name) => {
    const format = outputFormatFor(getAiTask(name).output)
    expect(format.type).toBe("json_schema")
    const json = JSON.stringify(format.schema)
    expect(format.schema.additionalProperties).toBe(false)
    expect(json).not.toContain("{enum:")
    expect(json).not.toContain("$schema")
    // No numeric ranges or unions that structured outputs reject.
    expect(json).not.toMatch(/"(minimum|maximum|oneOf)"/)
  })

  it("keeps enum constraints on nested and $ref'd fields", () => {
    const format = outputFormatFor(getAiTask("capture_idea").output)
    type Node = { enum?: string[]; items?: Node; $ref?: string; anyOf?: Node[] }
    const defs = (format.schema.$defs ?? {}) as Record<string, Node>
    const resolve = (node: Node | undefined): Node | undefined => (node?.$ref ? defs[node.$ref.replace("#/$defs/", "")] : node)
    const props = format.schema.properties as Record<string, Node>
    expect(resolve(props.hook_category)?.enum).toContain("story")
    expect(resolve(props.funnel_stage)?.enum).toEqual(["tofu", "mofu", "bofu"])
    expect(resolve(props.platforms.items)?.enum).toContain("tiktok")
    // what_to_post reuses one pick schema for `pick` and `alternatives` → lives in $defs.
    const wtp = outputFormatFor(getAiTask("what_to_post").output)
    expect(JSON.stringify(wtp.schema)).toContain('"enum":["facebook","tiktok"')
  })
})
