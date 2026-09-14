/**
 * The onboarding UI language: English or Taglish, chosen on the first screen and switchable at any step.
 * Components read the active dictionary with `useCopy()`; pure helpers take a `Copy` argument.
 */
import { createContext, useContext } from "react"
import type { BrandLanguage } from "@/lib/types"
import { EN, type Copy } from "./copy-en"
import { TL } from "./copy-tl"

export type OnboardingLang = "english" | "taglish"
export type { Copy }

export const ONBOARDING_LANGS: OnboardingLang[] = ["english", "taglish"]
export const COPY: Record<OnboardingLang, Copy> = { english: EN, taglish: TL }

/** A brand's writing language as an onboarding language (Tagalog brands get the Taglish UI). */
export const langForBrand = (language: BrandLanguage): OnboardingLang => (language === "english" ? "english" : "taglish")

export const CopyContext = createContext<Copy>(EN)
export const useCopy = () => useContext(CopyContext)
