/**
 * Coerce loosely-shaped JSON toward a zod schema before strict validation: missing strings → "",
 * numeric strings → numbers, enum values matched case/spacing-insensitively, a lone value → one-item array.
 * Output schemas only use objects, arrays, enums, strings, numbers, booleans and nullable.
 */
import * as z from "zod"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const normalizeEnum = (v: string) => v.trim().toLowerCase().replace(/[\s-]+/g, "_")

export function coerceToSchema(schema: z.ZodType, value: unknown): unknown {
  if (schema instanceof z.ZodNullable) {
    return value === null || value === undefined || value === "" ? null : coerceToSchema(schema.unwrap() as z.ZodType, value)
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return value === undefined ? undefined : coerceToSchema(schema.unwrap() as z.ZodType, value)
  }
  if (schema instanceof z.ZodObject) {
    const source = isRecord(value) ? value : {}
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(schema.shape as Record<string, z.ZodType>)) out[key] = coerceToSchema(child, source[key])
    return out
  }
  if (schema instanceof z.ZodArray) {
    const list = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value]
    return list.map((v) => coerceToSchema(schema.element as z.ZodType, v))
  }
  if (schema instanceof z.ZodEnum) {
    const options = schema.options as string[]
    if (typeof value === "string") {
      if (options.includes(value)) return value
      const wanted = normalizeEnum(value)
      const match = options.find((o) => normalizeEnum(o) === wanted)
      if (match) return match
    }
    return options[0]
  }
  if (schema instanceof z.ZodString) {
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join("\n")
    return ""
  }
  if (schema instanceof z.ZodNumber) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
    return 0
  }
  if (schema instanceof z.ZodBoolean) {
    if (typeof value === "boolean") return value
    return value === "true"
  }
  return value
}

/** Coerce, then validate strictly. */
export function parseLoose<T>(schema: z.ZodType<T>, value: unknown): z.ZodSafeParseResult<T> {
  return schema.safeParse(coerceToSchema(schema, value))
}
