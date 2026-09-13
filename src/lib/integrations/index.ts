/**
 * Integrations (spec §58, Phase 4): typed adapters with honest "not configured" states, plus the
 * manual CSV analytics import that works today. Pure modules — no React, no store writes.
 */
export * from "./types"
export * from "./registry"
export * from "./csv"
export * from "./analytics-import"
