/**
 * Integrations (spec §58, Phase 4): typed adapters with honest "not configured" states, plus the
 * manual CSV analytics import that works today — generic column mapping, presets for Meta Business
 * Suite, TikTok Studio and YouTube Studio exports, and optional post bootstrap for unmatched rows.
 * Pure modules — no React, no store writes.
 */
export * from "./types"
export * from "./registry"
export * from "./csv"
export * from "./values"
export * from "./presets"
export * from "./analytics-import"
export * from "./bootstrap"
