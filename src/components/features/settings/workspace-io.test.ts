import { describe, expect, it } from "vitest"
import { createStarterDatabase } from "@/lib/data/seed"
import { buildWorkspaceExport, formatBytes, parseWorkspaceFile, WORKSPACE_FORMAT } from "./workspace-io"

const db = createStarterDatabase("00000000-0000-4000-8000-000000000001", new Date(2026, 8, 13))

describe("parseWorkspaceFile", () => {
  it("round-trips an export", () => {
    const file = JSON.stringify(buildWorkspaceExport(db, "local", new Date(2026, 8, 13)))
    const result = parseWorkspaceFile(file, { requireUuids: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.counts.content_formats).toBe(db.content_formats.length)
    expect(result.warnings).toEqual([])
    expect(result.exportedAt).toMatch(/^2026-09-1/)
  })

  it("accepts a bare table map and warns about unknown sections", () => {
    const result = parseWorkspaceFile(JSON.stringify({ tags: db.tags, extras: [] }))
    expect(result.ok && result.warnings.some((w) => w.includes("extras"))).toBe(true)
    expect(result.ok && result.warnings.some((w) => w.includes("brand profile"))).toBe(true)
  })

  it("rejects files that aren't a valid workspace", () => {
    const bad = (value: unknown, options = {}) => parseWorkspaceFile(typeof value === "string" ? value : JSON.stringify(value), options)
    expect(bad("{nope").ok).toBe(false)
    expect(bad({ format: "something-else", db }).ok).toBe(false)
    expect(bad({ format: WORKSPACE_FORMAT, version: 2, db }).ok).toBe(false)
    expect(bad({ db: { tags: "x" } }).ok).toBe(false)
    expect(bad({ db: { tags: [{ name: "no-id" }] } }).ok).toBe(false)
    expect(bad({ db: { tags: [db.tags[0], db.tags[0]] } }).ok).toBe(false)
    expect(bad({ db: { tags: [{ ...db.tags[0], name: 5 }] } }).ok).toBe(false)
    expect(bad({ db: { tags: [{ ...db.tags[0], id: "abc" }] } }, { requireUuids: true }).ok).toBe(false)
    expect(bad({ db: {} }).ok).toBe(false)
  })
})

describe("formatBytes", () => {
  it("scales units", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2 KB")
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB")
  })
})
