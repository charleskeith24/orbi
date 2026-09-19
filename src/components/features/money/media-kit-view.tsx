"use client"

import { ArrowDown, ArrowUp, CircleCheck, CirclePlus, IdCard, Image as ImageIcon, Pencil, Plus, Printer, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { FormField, PageContainer, PageHeader, PlatformIcon, SectionCard, useConfirm } from "@/components/common"
import { useMyProfile, usePhotoUrl } from "@/components/features/profile/profile-store"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { dataActions, uiActions, updateBrand, useBrand, useDb, useTable } from "@/lib/store"
import type { RateCard } from "@/lib/types"
import { cn, formatMoney } from "@/lib/utils"
import { MediaKitDocument } from "./media-kit-document"
import { mediaKitMessages } from "./media-kit-messages"
import { buildMediaKit, type MediaKitGap } from "./media-kit-model"
import { RateCardDialog } from "./rate-card-dialog"

const BIO_MAX = 800
/** "Use my profile photo in the media kit" — a per-device choice (localStorage), off by default. */
const PHOTO_KEY = "pbos:media-kit-photo"
const photoListeners = new Set<() => void>()
function readPhotoChoice(): boolean {
  try {
    return window.localStorage.getItem(PHOTO_KEY) === "on"
  } catch {
    return false
  }
}
function writePhotoChoice(on: boolean) {
  try {
    if (on) window.localStorage.setItem(PHOTO_KEY, "on")
    else window.localStorage.removeItem(PHOTO_KEY)
  } catch {
    // Private mode: the switch just won't be remembered.
  }
  photoListeners.forEach((listener) => listener())
}
function subscribePhotoChoice(listener: () => void) {
  photoListeners.add(listener)
  return () => photoListeners.delete(listener)
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DETAILS_ID = "media-kit-details"

/**
 * While the print dialog is up the document is on paper colours even from dark mode (Cmd/Ctrl+P included).
 * The app shell hides itself in print (`[data-print="hide"]`, the sidebar); the editing chrome is `print:hidden`.
 */
function useLightPrint() {
  useEffect(() => {
    const root = document.documentElement
    let restore: (() => void) | null = null
    const before = () => {
      document.body.setAttribute("data-printing", "media-kit")
      if (!root.classList.contains("dark")) return
      const scheme = root.style.colorScheme
      root.classList.remove("dark")
      root.style.colorScheme = "light"
      restore = () => {
        root.classList.add("dark")
        root.style.colorScheme = scheme
      }
    }
    const after = () => {
      document.body.removeAttribute("data-printing")
      restore?.()
      restore = null
    }
    window.addEventListener("beforeprint", before)
    window.addEventListener("afterprint", after)
    return () => {
      window.removeEventListener("beforeprint", before)
      window.removeEventListener("afterprint", after)
      after()
    }
  }, [])
}

/** `/money/media-kit` — the English one-pager for brands, with editing chrome in the UI language. */
export function MediaKitView() {
  const t = useT(mediaKitMessages)
  const now = useNow()
  const db = useDb()
  const kit = useMemo(() => buildMediaKit(db, now), [db, now])
  const [rateDialog, setRateDialog] = useState<{ open: boolean; card: RateCard | null }>({ open: false, card: null })
  const { me } = useMyProfile()
  const profilePhoto = usePhotoUrl(me?.avatar_path)
  const usePhoto = useSyncExternalStore(subscribePhotoChoice, readPhotoChoice, () => false)
  useLightPrint()

  const openRateCard = (card: RateCard | null) => setRateDialog({ open: true, card })
  const focusDetails = (field: "bio" | "email") => {
    const el = document.getElementById(`${DETAILS_ID}-${field}`)
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
    el?.focus({ preventScroll: true })
  }

  function renderGap(gap: MediaKitGap) {
    const link = (href: string, label: string) => (
      <Button asChild size="xs" variant="outline">
        <Link href={href}>{label}</Link>
      </Button>
    )
    const action: Record<MediaKitGap, React.ReactNode> = {
      name: link("/strategy", t("fix_brand_hq")),
      niche: link("/strategy", t("fix_brand_hq")),
      platforms: link("/strategy", t("fix_brand_hq")),
      bio: (
        <Button type="button" size="xs" variant="outline" onClick={() => focusDetails("bio")}>
          {t("fix_details")}
        </Button>
      ),
      contact: (
        <Button type="button" size="xs" variant="outline" onClick={() => focusDetails("email")}>
          {t("fix_details")}
        </Button>
      ),
      handles: link("/strategy/platforms", t("fix_platforms")),
      followers: link("/strategy/platforms", t("fix_platforms")),
      analytics: (
        <Button type="button" size="xs" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
          {t("fix_log")}
        </Button>
      ),
      persona: link("/audience", t("fix_personas")),
      rate_cards: (
        <Button type="button" size="xs" variant="outline" onClick={() => openRateCard(null)}>
          {t("fix_rate_card")}
        </Button>
      ),
      collabs: link("/money/deals", t("fix_deals")),
    }
    return (
      <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-dashed bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground dark:bg-muted/15">
        <CirclePlus className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 basis-48 text-pretty">{t(`gap_${gap}`)}</span>
        {action[gap]}
      </p>
    )
  }

  return (
    <PageContainer>
      <style>{"@media print { @page { size: A4; margin: 14mm; } }"}</style>
      <PageHeader
        className="print:hidden"
        title={t("title")}
        icon={IdCard}
        description={t("description")}
        actions={
          <Button size="sm" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("print")}
          </Button>
        }
      />

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] print:block">
        <section aria-label={t("preview_label")} className="flex min-w-0 flex-col gap-2">
          <p className="text-xs text-muted-foreground print:hidden">{t("language_note")}</p>
          <MediaKitDocument kit={kit} renderGap={renderGap} photoUrl={usePhoto ? profilePhoto : null} />
        </section>

        <div className="flex min-w-0 flex-col gap-4 print:hidden">
          <SectionCard title={t("checklist_title")} icon={kit.missing.length ? CirclePlus : CircleCheck}>
            <p className="text-sm font-medium">{kit.missing.length ? t.plural("missing", kit.missing.length) : t("checklist_done")}</p>
            {kit.missing.length ? <p className="mt-1 text-xs text-pretty text-muted-foreground">{t("checklist_description")}</p> : null}
          </SectionCard>
          <PhotoChoice on={usePhoto} hasPhoto={Boolean(me?.avatar_path)} />
          <DetailsEditor bioIsFallback={kit.bioIsFallback} />
          <RateCardsManager onEdit={openRateCard} />
        </div>
      </div>

      <RateCardDialog open={rateDialog.open} card={rateDialog.card} onOpenChange={(open) => setRateDialog((s) => ({ ...s, open }))} />
    </PageContainer>
  )
}

function PhotoChoice({ on, hasPhoto }: { on: boolean; hasPhoto: boolean }) {
  const t = useT(mediaKitMessages)
  const id = useId()
  return (
    <SectionCard title={t("photo_title")} icon={ImageIcon}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={`${id}-photo`} className="text-sm font-medium">
            {t("photo_label")}
          </label>
          {hasPhoto ? (
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{t("photo_help")}</p>
          ) : (
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
              {t("photo_none")}{" "}
              <Link href="/settings?tab=profile" className="font-medium text-foreground underline-offset-2 hover:underline">
                {t("photo_open_profile")}
              </Link>
            </p>
          )}
        </div>
        <Switch id={`${id}-photo`} checked={on && hasPhoto} disabled={!hasPhoto} onCheckedChange={(next) => writePhotoChoice(next)} />
      </div>
    </SectionCard>
  )
}

function DetailsEditor({ bioIsFallback }: { bioIsFallback: boolean }) {
  const t = useT(mediaKitMessages)
  const brand = useBrand()
  const [draft, setDraft] = useState({ bio: brand.media_kit_bio, email: brand.contact_email, website: brand.website })
  const [touched, setTouched] = useState(false)
  // A save elsewhere (another tab, an import) refreshes an untouched form.
  const saved = { bio: brand.media_kit_bio, email: brand.contact_email, website: brand.website }
  const [base, setBase] = useState(saved)
  if (!touched && (base.bio !== saved.bio || base.email !== saved.email || base.website !== saved.website)) {
    setBase(saved)
    setDraft(saved)
  }
  const errors = {
    bio: draft.bio.trim().length > BIO_MAX ? t("error_bio", { max: BIO_MAX }) : undefined,
    email: draft.email.trim() && !EMAIL.test(draft.email.trim()) ? t("error_email") : undefined,
  }
  const dirty = draft.bio.trim() !== saved.bio || draft.email.trim() !== saved.email || draft.website.trim() !== saved.website
  const valid = !errors.bio && !errors.email

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || !dirty) return
    const next = { media_kit_bio: draft.bio.trim(), contact_email: draft.email.trim(), website: draft.website.trim() }
    updateBrand(next)
    setTouched(false)
    setBase({ bio: next.media_kit_bio, email: next.contact_email, website: next.website })
    toast.success(t("saved"))
  }

  const edit = (key: keyof typeof draft, value: string) => {
    setTouched(true)
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <SectionCard title={t("details_title")} description={t("details_description")}>
      <form id={DETAILS_ID} noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3">
        <FormField
          label={t("bio")}
          htmlFor={`${DETAILS_ID}-bio`}
          description={bioIsFallback && !draft.bio.trim() ? t("bio_fallback") : t("bio_help")}
          error={errors.bio}
        >
          <Textarea
            id={`${DETAILS_ID}-bio`}
            rows={4}
            className="min-h-20"
            value={draft.bio}
            placeholder={t("bio_placeholder")}
            aria-invalid={Boolean(errors.bio) || undefined}
            onChange={(event) => edit("bio", event.target.value)}
          />
        </FormField>
        <FormField label={t("email")} htmlFor={`${DETAILS_ID}-email`} error={errors.email}>
          <Input
            id={`${DETAILS_ID}-email`}
            type="email"
            inputMode="email"
            value={draft.email}
            maxLength={200}
            placeholder={t("email_placeholder")}
            aria-invalid={Boolean(errors.email) || undefined}
            onChange={(event) => edit("email", event.target.value)}
          />
        </FormField>
        <FormField label={t("website")} htmlFor={`${DETAILS_ID}-website`}>
          <Input
            id={`${DETAILS_ID}-website`}
            inputMode="url"
            value={draft.website}
            maxLength={200}
            placeholder={t("website_placeholder")}
            onChange={(event) => edit("website", event.target.value)}
          />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!dirty || !valid}>
            {t("save")}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

function RateCardsManager({ onEdit }: { onEdit: (card: RateCard | null) => void }) {
  const t = useT(mediaKitMessages)
  const id = useId()
  const rateCards = useTable("rate_cards")
  const [confirm, confirmDialog] = useConfirm()
  const cards = useMemo(
    () => [...rateCards].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [rateCards]
  )

  function move(index: number, step: -1 | 1) {
    const order = [...cards]
    const target = index + step
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    dataActions.updateMany(
      "rate_cards",
      order.map((card, i) => ({ id: card.id, patch: { sort_order: i } })).filter((u, i) => order[i].sort_order !== u.patch.sort_order)
    )
  }

  async function remove(card: RateCard) {
    const name = card.name || t("untitled_rate")
    const ok = await confirm({
      title: t("delete_rate_title", { name }),
      description: t("delete_rate_description"),
      confirmLabel: t("delete_confirm"),
      cancelLabel: t("cancel"),
    })
    if (!ok) return
    dataActions.remove("rate_cards", card.id)
    toast.success(t("rate_deleted"), { description: name })
  }

  return (
    <SectionCard
      title={t("rate_cards")}
      description={t("rate_cards_description")}
      contentClassName={cards.length ? "p-0 pt-2" : undefined}
      action={
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(null)}>
          <Plus aria-hidden />
          {t("add_rate_card")}
        </Button>
      }
    >
      {cards.length ? (
        <ul className="divide-y">
          {cards.map((card, index) => {
            const name = card.name || t("untitled_rate")
            return (
              <li key={card.id} className={cn("flex min-w-0 items-center gap-2 py-2 pr-2 pl-4", !card.is_active && "text-muted-foreground")}>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    {card.platform ? <PlatformIcon platform={card.platform} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                    <span className="truncate">{name}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground num">
                    {card.price === null ? t("price_on_request") : formatMoney(card.price, card.currency)}
                    {card.is_active ? "" : ` · ${t("hidden")}`}
                  </p>
                </div>
                <Switch
                  id={`${id}-${card.id}`}
                  size="sm"
                  checked={card.is_active}
                  aria-label={t("show_rate", { name })}
                  onCheckedChange={(next) => dataActions.update("rate_cards", card.id, { is_active: next })}
                />
                <div className="flex shrink-0 items-center">
                  <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} aria-label={t("move_up", { name })} onClick={() => move(index, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === cards.length - 1}
                    aria-label={t("move_down", { name })}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={t("edit_rate", { name })} onClick={() => onEdit(card)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={t("delete_rate", { name })} onClick={() => void remove(card)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("rate_empty")}</p>
      )}
      {confirmDialog}
    </SectionCard>
  )
}
