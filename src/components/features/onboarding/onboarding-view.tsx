"use client"

import { useState } from "react"
import { useBrand, useDataStore, useTable } from "@/lib/store"
import { AlreadySetUp } from "./already-set-up"
import { COPY, CopyContext, langForBrand } from "./copy"
import { clearDraft, createDraft, loadDraft, workspaceKey, type OnboardingDraft } from "./onboarding-draft"
import { answersFromWorkspace } from "./onboarding-model"
import { Wizard } from "./wizard"

/**
 * /onboarding: Quick setup for a new workspace; on a finished workspace a notice (Detailed setup, Niche
 * Discovery or back), or — with `?step=niche` — Niche Discovery alone, pre-filled from Brand HQ.
 */
export function OnboardingView({ entry = null }: { entry?: "niche" | null }) {
  const brand = useBrand()
  const userId = useDataStore((s) => s.userId)
  const pillars = useTable("content_pillars")
  const personas = useTable("audience_personas")
  const ideas = useTable("content_ideas")
  const workspace = workspaceKey(brand)
  const brandLang = langForBrand(brand.language)
  const [draft, setDraft] = useState<OnboardingDraft | null>(() => {
    const db = useDataStore.getState().db
    const saved = loadDraft(userId, workspace)
    if (!brand.onboarding_completed) return saved?.mode === "first" ? saved : createDraft(workspace, "first", answersFromWorkspace(db), "english")
    if (entry === "niche") return saved?.mode === "niche" ? saved : createDraft(workspace, "niche", answersFromWorkspace(db, { rerun: true }), brandLang)
    return null
  })
  const [savedDraft] = useState(() => (brand.onboarding_completed && entry !== "niche" ? loadDraft(userId, workspace) : null))

  if (!draft) {
    return (
      <CopyContext.Provider value={COPY[brandLang]}>
        <AlreadySetUp
          brandName={brand.brand_name || brand.name}
          stats={{ pillars: pillars.filter((p) => p.is_active).length, personas: personas.length, ideas: ideas.length }}
          hasDraft={Boolean(savedDraft)}
          onResume={() => savedDraft && setDraft(savedDraft)}
          onRerun={() => {
            clearDraft(userId)
            setDraft(createDraft(workspace, "rerun", answersFromWorkspace(useDataStore.getState().db, { rerun: true }), brandLang))
          }}
        />
      </CopyContext.Provider>
    )
  }
  return <Wizard draft={draft} setDraft={setDraft} userId={userId} />
}
