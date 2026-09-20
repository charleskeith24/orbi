"use client"

import { Compass } from "lucide-react"
import { useRouter } from "next/navigation"
import { ListEditor, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { BrandFieldShell, BrandSection, BrandTextField, type BrandSectionProps } from "./brand-fields"
import { brandFieldMessages } from "./brand-messages"
import { fieldId, LIST_LIMITS } from "./brand-model"
import { NicheAlignmentPanel } from "./niche-alignment-panel"

/** The onboarding wizard's Niche Discovery step. */
export const NICHE_DISCOVERY_HREF = "/onboarding?step=niche"

/** Niche: the one-line niche, the interests behind it, why it fits — and how well recent content matches it. */
export function NicheSection({ values, set, dirty, now }: BrandSectionProps & { dirty: boolean; now: Date }) {
  const router = useRouter()
  const t = useT(brandFieldMessages)
  const [confirm, confirmDialog] = useConfirm()
  const interests = values.interests
  const max = LIST_LIMITS.interests

  async function rediscover() {
    if (dirty) {
      const ok = await confirm({
        title: t("leave_title"),
        description: t("leave_description"),
        confirmLabel: t("leave_confirm"),
      })
      if (!ok) return
    }
    router.push(NICHE_DISCOVERY_HREF)
  }

  return (
    <BrandSection
      sectionKey="niche"
      action={
        <Button type="button" variant="outline" size="sm" aria-label={t("rerun_label")} onClick={() => void rediscover()}>
          <Compass aria-hidden />
          <span className="sm:hidden">{t("rerun_short")}</span>
          <span className="hidden sm:inline">{t("rerun_long")}</span>
        </Button>
      }
    >
      <BrandTextField
        field="niche"
        label={t("niche_label")}
        wrap
        value={values.niche}
        placeholder={t("niche_placeholder")}
        hint={t("niche_description")}
        onChange={(value) => set("niche", value)}
      />
      <BrandFieldShell
        label={t("interests_label")}
        htmlFor={fieldId("interests")}
        hint={t("interests_description")}
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
          placeholder={t("interests_placeholder")}
          aria-label={t("interests_label")}
          onChange={(value) => set("interests", value)}
        />
      </BrandFieldShell>
      <BrandTextField
        field="niche_fit"
        label={t("niche_fit_label")}
        multiline
        value={values.niche_fit}
        placeholder={t("niche_fit_placeholder")}
        hint={t("niche_fit_description")}
        onChange={(value) => set("niche_fit", value)}
      />
      <NicheAlignmentPanel niche={values.niche} interests={values.interests} now={now} />
      {confirmDialog}
    </BrandSection>
  )
}
