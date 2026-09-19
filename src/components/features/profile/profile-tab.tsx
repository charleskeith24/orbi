"use client"

import { Camera, CircleAlert, Eye, Globe, HardDrive, Lock, Plus, ShieldCheck, Trash2, UsersRound, X } from "lucide-react"
import Link from "next/link"
import { useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { FormField, InfoHint, PlatformIcon, SectionCard, useConfirm } from "@/components/common"
import { SaveBar } from "@/components/features/settings/save-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { PROFILE_LINK_PLATFORMS, type LinkError } from "@/lib/profiles/links"
import {
  cleanLine,
  draftFromProfile,
  isDraftDirty,
  linksFromDraft,
  newLinkKey,
  patchFromDraft,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileLinkDraft,
} from "@/lib/profiles/profile"
import { PROFILE_LIMITS, ProfileApiError, publicViewOf, type MyProfile, type ProfileLinkPlatform, type ProfilesSource } from "@/lib/profiles/types"
import { useBrand } from "@/lib/store"
import { cn } from "@/lib/utils"
import { profileMessages } from "./messages"
import { PhotoCropDialog } from "./photo-crop-dialog"
import { checkPhotoFile, loadPhoto, PHOTO_ACCEPT, type LoadedPhoto } from "./photo-encode"
import { ProfileAvatar } from "./profile-avatar"
import { ProfileCardBody } from "./profile-card"
import { useDescribeProfileError } from "./profile-errors"
import { profileActions, useMyProfile, usePhotoUrl } from "./profile-store"

const LINK_ERROR_KEY: Record<LinkError, "error_link_empty" | "error_link_url" | "error_link_handle" | "error_link_too_long"> = {
  empty: "error_link_empty",
  url: "error_link_url",
  handle: "error_link_handle",
  too_long: "error_link_too_long",
}

/**
 * Settings → Profile (`/settings?tab=profile`), Calm UI: the form — photo, display name, headline, location, links
 * and the opt-in niche — beside a compact live Preview whose ⓘ says who can see it. Online it's saved to the
 * account; in local mode to this device only, said in one line.
 */
export function ProfileTab() {
  const t = useT(profileMessages)
  const { me, status, error, source } = useMyProfile()

  if (!me || !source) {
    if (status === "error") {
      return (
        <div role="alert" className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{t("load_failed")}</p>
            <ErrorText error={error} />
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void profileActions.loadMe()}>
              {t("retry")}
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div role="status" aria-busy="true" aria-label={t("loading")} className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[34rem] rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }
  return <ProfileEditor key={me.id} me={me} source={source} />
}

function ErrorText({ error }: { error: unknown }) {
  const describe = useDescribeProfileError()
  return <p className="text-xs text-muted-foreground">{describe(error)}</p>
}

function ProfileEditor({ me, source }: { me: MyProfile; source: ProfilesSource }) {
  const t = useT(profileMessages)
  const describe = useDescribeProfileError()
  const brand = useBrand()
  const id = useId()
  const [base, setBase] = useState(me)
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(me))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const local = source !== "live"

  // A save (here or elsewhere, e.g. the photo) brings a new profile: keep unsaved edits, move the baseline.
  if (me !== base) {
    const wasClean = !isDraftDirty(draft, base)
    setBase(me)
    if (wasClean) setDraft(draftFromProfile(me))
  }

  const errors = validateProfileDraft(draft)
  const dirty = isDraftDirty(draft, me)
  const valid = patchFromDraft(draft) !== null
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const showError = (key: string) => submitted || touched[key]

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const patch = patchFromDraft(draft)
    if (!patch || !dirty || saving) return
    setSaving(true)
    try {
      const saved = await profileActions.save(patch)
      setBase(saved)
      setDraft(draftFromProfile(saved))
      setTouched({})
      setSubmitted(false)
      toast.success(t("saved"))
    } catch (error) {
      toast.error(t("save_failed"), { description: describe(error) })
    } finally {
      setSaving(false)
    }
  }

  const brandNiche = brand.niche.trim()
  const mainPlatform = brand.main_platforms[0] ?? null
  const preview = useMemo(
    () =>
      publicViewOf(
        {
          ...me,
          display_name: cleanLine(draft.display_name),
          headline: cleanLine(draft.headline),
          location: cleanLine(draft.location),
          links: linksFromDraft(draft.links),
          show_niche: draft.show_niche,
        },
        { niche: brand.niche, main_platforms: brand.main_platforms }
      ),
    [me, draft, brand.niche, brand.main_platforms]
  )
  const photoUrl = usePhotoUrl(me.avatar_path)
  const fallbackName = brand.name.trim() || t("section_title")

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {local ? <LocalNote /> : null}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
          <SectionCard contentClassName="flex flex-col gap-5">
            <PhotoField me={me} photoUrl={photoUrl} name={preview.display_name || fallbackName} source={source} />

            <FormField
              label={t("name_label")}
              htmlFor={`${id}-name`}
              error={errors.display_name ? t("error_too_long", { max: PROFILE_LIMITS.displayName }) : undefined}
            >
              <Input
                id={`${id}-name`}
                value={draft.display_name}
                maxLength={PROFILE_LIMITS.displayName + 20}
                autoComplete="name"
                placeholder={brand.name.trim() ? t("name_placeholder", { name: brand.name.trim() }) : t("name_placeholder_default")}
                aria-invalid={Boolean(errors.display_name) || undefined}
                onChange={(e) => set("display_name", e.target.value)}
              />
            </FormField>

            <FormField
              label={t("headline_label")}
              htmlFor={`${id}-headline`}
              labelAction={
                <span className={cn("text-xs num", errors.headline ? "text-critical-fg" : "text-muted-foreground")} aria-hidden>
                  {t("count", { count: cleanLine(draft.headline).length, max: PROFILE_LIMITS.headline })}
                </span>
              }
              error={errors.headline ? t("error_too_long", { max: PROFILE_LIMITS.headline }) : undefined}
            >
              <Input
                id={`${id}-headline`}
                value={draft.headline}
                maxLength={PROFILE_LIMITS.headline + 40}
                placeholder={t("headline_placeholder")}
                aria-invalid={Boolean(errors.headline) || undefined}
                onChange={(e) => set("headline", e.target.value)}
              />
            </FormField>

            <FormField
              label={t("location_label")}
              htmlFor={`${id}-location`}
              error={errors.location ? t("error_too_long", { max: PROFILE_LIMITS.location }) : undefined}
              className="sm:max-w-sm"
            >
              <Input
                id={`${id}-location`}
                value={draft.location}
                maxLength={PROFILE_LIMITS.location + 20}
                autoComplete="address-level2"
                placeholder={t("location_placeholder")}
                aria-invalid={Boolean(errors.location) || undefined}
                onChange={(e) => set("location", e.target.value)}
              />
            </FormField>

            <LinksEditor
              links={draft.links}
              errors={errors.links ?? {}}
              showError={showError}
              onTouch={(key) => setTouched((x) => ({ ...x, [key]: true }))}
              onChange={(links) => set("links", links)}
            />

            <div className="flex min-w-0 items-start justify-between gap-4 rounded-md border px-3 py-2.5">
              <div className="min-w-0">
                <label htmlFor={`${id}-niche`} className="text-sm font-medium">
                  {t("niche_label")}
                </label>
                {brandNiche ? (
                  <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                    {t("niche_help", { niche: brandNiche })}
                    {mainPlatform ? (
                      <span className="whitespace-nowrap">
                        {" · "}
                        <PlatformIcon platform={mainPlatform} className="inline size-3 align-[-2px]" /> {PLATFORMS[mainPlatform].label}
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("niche_empty")}{" "}
                    <Link href="/strategy" className="font-medium text-foreground underline-offset-2 hover:underline">
                      {t("niche_open_brand")}
                    </Link>
                  </p>
                )}
              </div>
              <Switch
                id={`${id}-niche`}
                checked={draft.show_niche}
                disabled={!brandNiche && !draft.show_niche}
                onCheckedChange={(checked) => set("show_niche", checked)}
              />
            </div>
          </SectionCard>
          <SaveBar
            dirty={dirty}
            valid={valid}
            onDiscard={() => {
              setDraft(draftFromProfile(me))
              setTouched({})
              setSubmitted(false)
            }}
          />
          {saving ? <span className="sr-only" role="status">{t("crop_saving")}</span> : null}
        </form>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16">
          <SectionCard title={t("preview_title")} info={<VisibilityInfo local={local} />}>
            <ProfileCardBody profile={preview} name={fallbackName} photoUrl={photoUrl} />
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}

/** Local mode, in one line; what "online" would add waits behind the ⓘ. */
function LocalNote() {
  const t = useT(profileMessages)
  return (
    <p role="note" className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <HardDrive className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">{t("local_title")}</span>
      <InfoHint title={t("local_title")}>
        <p>{t("local_note")}</p>
        <p>{t("local_used")}</p>
      </InfoHint>
    </p>
  )
}

/** Who sees your profile — the Preview's ⓘ. */
function VisibilityInfo({ local }: { local: boolean }) {
  const t = useT(profileMessages)
  const rows: [typeof UsersRound, "visibility_circles" | "visibility_names" | "visibility_admins" | "visibility_public" | "visibility_photo"][] = [
    [UsersRound, "visibility_circles"],
    [Eye, "visibility_names"],
    [ShieldCheck, "visibility_admins"],
    [Globe, "visibility_public"],
    [Lock, "visibility_photo"],
  ]
  return (
    <>
      <p className="text-[13px] leading-5 font-medium text-foreground">{t("visibility_title")}</p>
      {local ? <p>{t("visibility_online")}</p> : null}
      <ul className="flex flex-col gap-2">
        {rows.map(([Icon, key]) => (
          <li key={key} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/* --------------------------------- photo ---------------------------------- */

function PhotoField({ me, photoUrl, name, source }: { me: MyProfile; photoUrl: string | null; name: string; source: ProfilesSource }) {
  const t = useT(profileMessages)
  const describe = useDescribeProfileError()
  const input = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [opening, setOpening] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [problem, setProblem] = useState<unknown>(null)
  const [confirm, confirmDialog] = useConfirm()
  const hasPhoto = Boolean(me.avatar_path)

  async function pick(file: File | undefined) {
    if (!file) return
    setProblem(null)
    const issue = checkPhotoFile(file)
    if (issue) {
      setProblem(new ProfileApiError(issue))
      return
    }
    setOpening(true)
    try {
      setPhoto(await loadPhoto(file))
    } catch (error) {
      setProblem(error)
    } finally {
      setOpening(false)
    }
  }

  async function remove() {
    const ok = await confirm({ title: t("photo_remove_title"), description: t("photo_remove_body"), confirmLabel: t("photo_remove_confirm") })
    if (!ok) return
    setRemoving(true)
    setProblem(null)
    try {
      await profileActions.removePhoto()
      toast.success(t("photo_removed"))
    } catch (error) {
      toast.error(describe(error))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <p className="text-sm leading-5 font-medium">{t("photo_label")}</p>
        <InfoHint title={t("photo_label")}>{t("photo_exif")}</InfoHint>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <ProfileAvatar name={name} photoUrl={photoUrl} alt={photoUrl ? t("photo_alt") : ""} className="size-16" fallbackClassName="text-lg" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={opening || removing} onClick={() => input.current?.click()}>
              {opening ? <Spinner /> : <Camera aria-hidden />}
              {hasPhoto ? t("photo_change") : t("photo_upload")}
            </Button>
            {hasPhoto ? (
              <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={opening || removing} onClick={() => void remove()}>
                {removing ? <Spinner /> : <Trash2 aria-hidden />}
                {t("photo_remove")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("photo_help")}</p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          void pick(file)
        }}
      />
      {problem ? (
        <div role="alert" className="flex min-w-0 flex-wrap items-start gap-2 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
          <p className="min-w-0 flex-1 basis-56 text-pretty">{describe(problem)}</p>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => input.current?.click()}>
            {t("photo_choose_other")}
          </Button>
        </div>
      ) : null}
      <PhotoCropDialog
        photo={photo}
        source={source}
        onClose={() => {
          photo?.release()
          setPhoto(null)
        }}
      />
      {confirmDialog}
    </div>
  )
}

/* --------------------------------- links ---------------------------------- */

function LinksEditor({
  links,
  errors,
  showError,
  onTouch,
  onChange,
}: {
  links: ProfileLinkDraft[]
  errors: Record<string, LinkError>
  showError: (key: string) => boolean
  onTouch: (key: string) => void
  onChange: (links: ProfileLinkDraft[]) => void
}) {
  const t = useT(profileMessages)
  const id = useId()
  const full = links.length >= PROFILE_LIMITS.links
  const update = (key: string, patch: Partial<ProfileLinkDraft>) => onChange(links.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const nextPlatform = (): ProfileLinkPlatform => PROFILE_LINK_PLATFORMS.find((p) => !links.some((l) => l.platform === p)) ?? "website"

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm leading-5 font-medium">{t("links_label")}</legend>
      {links.length ? (
        <ul className="flex flex-col gap-2">
          {links.map((link, i) => {
            const error = errors[link.key] && showError(link.key) ? errors[link.key] : undefined
            const errorId = `${id}-${link.key}-error`
            return (
              <li key={link.key} className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <NativeSelect
                    size="sm"
                    className="w-28 shrink-0 sm:w-36"
                    aria-label={t("link_platform", { n: i + 1 })}
                    value={link.platform}
                    onChange={(e) => update(link.key, { platform: e.target.value as ProfileLinkPlatform })}
                  >
                    {PROFILE_LINK_PLATFORMS.map((p) => (
                      <NativeSelectOption key={p} value={p}>
                        {p === "website" ? t("website") : PLATFORMS[p].label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Input
                    value={link.value}
                    className="h-8 min-w-0"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={PROFILE_LIMITS.linkUrl + 40}
                    placeholder={link.platform === "website" ? t("link_placeholder_website") : t("link_placeholder_handle")}
                    aria-label={t("link_value", { n: i + 1 })}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={(e) => update(link.key, { value: e.target.value })}
                    onBlur={() => onTouch(link.key)}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t("link_remove", { n: i + 1 })}
                    title={t("link_remove", { n: i + 1 })}
                    onClick={() => onChange(links.filter((l) => l.key !== link.key))}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                {error ? (
                  <p id={errorId} className="text-xs text-destructive">
                    {t(LINK_ERROR_KEY[error])}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={full}
          onClick={() => onChange([...links, { key: newLinkKey(), platform: nextPlatform(), value: "" }])}
        >
          <Plus aria-hidden />
          {t("link_add")}
        </Button>
        {full ? <span className="text-xs text-muted-foreground">{t("link_max")}</span> : null}
      </div>
    </fieldset>
  )
}
