"use client"

import { Compass } from "lucide-react"
import { useRouter } from "next/navigation"
import { FormField, ListEditor, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { BrandSection, BrandTextField, type BrandSectionProps } from "./brand-fields"
import { fieldId, LIST_LIMITS } from "./brand-model"
import { NicheAlignmentPanel } from "./niche-alignment-panel"

/** The onboarding wizard's Niche Discovery step. */
export const NICHE_DISCOVERY_HREF = "/onboarding?step=niche"

/** Niche: the one-line niche, the interests behind it, why it fits — and how well recent content matches it. */
export function NicheSection({ values, set, dirty, now }: BrandSectionProps & { dirty: boolean; now: Date }) {
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()
  const interests = values.interests
  const max = LIST_LIMITS.interests

  async function rediscover() {
    if (dirty) {
      const ok = await confirm({
        title: "Leave Brand HQ with unsaved changes?",
        description: "Niche Discovery opens on its own page, so your unsaved Brand HQ edits would be lost. Save first to keep them.",
        confirmLabel: "Discard and continue",
      })
      if (!ok) return
    }
    router.push(NICHE_DISCOVERY_HREF)
  }

  return (
    <BrandSection
      sectionKey="niche"
      action={
        <Button type="button" variant="outline" size="sm" aria-label="Re-run niche discovery" onClick={() => void rediscover()}>
          <Compass aria-hidden />
          <span className="sm:hidden">Re-run</span>
          <span className="hidden sm:inline">Re-run niche discovery</span>
        </Button>
      }
    >
      <BrandTextField
        field="niche"
        label="Your niche"
        wrap
        value={values.niche}
        placeholder="e.g. Bookkeeping systems for Filipino online sellers"
        description="One line: the topic you own and who it's for."
        onChange={(value) => set("niche", value)}
      />
      <FormField
        label="Interests"
        htmlFor={fieldId("interests")}
        description="The topics you love talking about — the “hilig” behind your niche. Three to five is plenty."
        labelAction={
          <span className="text-xs text-muted-foreground num">
            {interests.length} / {max}
          </span>
        }
      >
        <ListEditor
          id={fieldId("interests")}
          value={interests}
          maxItems={max}
          placeholder="Type an interest and press Enter"
          aria-label="Interests"
          onChange={(value) => set("interests", value)}
        />
      </FormField>
      <BrandTextField
        field="niche_fit"
        label="Why this niche fits"
        multiline
        value={values.niche_fit}
        placeholder="e.g. Eight years doing this for clients (expertise), I never get tired of it (passion) and sellers keep asking me about it (demand)."
        description="Passion × expertise × audience demand — why this niche is yours to own."
        onChange={(value) => set("niche_fit", value)}
      />
      <NicheAlignmentPanel niche={values.niche} interests={values.interests} now={now} />
      {confirmDialog}
    </BrandSection>
  )
}
