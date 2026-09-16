/**
 * React entry point. Store code and other lib modules import from "@/lib/i18n/core" (plus
 * "@/lib/i18n/ui-lang" for `getUiLang()`) instead — this file pulls in React hooks and the data store.
 */
export * from "./core"
export { getUiLang } from "./ui-lang"
export { useT, useUiLang } from "./use-t"
