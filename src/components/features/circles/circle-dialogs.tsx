"use client"

import { ArrowRight, Link2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { CopyButton, FormField } from "@/components/common"
import { useMyProfile } from "@/components/features/profile/profile-store"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { inviteLink, parseInvite } from "@/lib/circles/invite"
import { CIRCLE_LIMITS } from "@/lib/circles/types"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useBrand } from "@/lib/store"
import { useCircleAction } from "./circle-errors"
import { rememberInvite } from "./circle-memory"
import { useCircles } from "./circles-client"
import { circleFormMessages } from "./messages"

/** The name to suggest for "Your name in this circle": your profile's display name, else Brand HQ's name, trimmed to fit. */
export function useSuggestedDisplayName(): string {
  const brand = useBrand()
  const { me } = useMyProfile()
  return (me?.display_name.trim() || brand.name.trim()).slice(0, CIRCLE_LIMITS.displayName).trim()
}

export function isValidName(value: string, max: number): boolean {
  const v = value.trim()
  return v.length > 0 && v.length <= max
}

/** "Create a circle": name + your display name → the invite link to share. */
export function CreateCircleDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open ? <CreateCircleForm onClose={() => onOpenChange(false)} onCreated={onCreated} /> : null}</DialogContent>
    </Dialog>
  )
}

function CreateCircleForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT(circleFormMessages)
  const c = useT(commonMessages)
  const id = useId()
  const router = useRouter()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const [name, setName] = useState("")
  const suggested = useSuggestedDisplayName()
  const [displayName, setDisplayName] = useState(suggested)
  const [touched, setTouched] = useState({ name: false, displayName: false })
  const [created, setCreated] = useState<{ circleId: string; link: string; name: string } | null>(null)

  const errors = {
    name: isValidName(name, CIRCLE_LIMITS.name) ? undefined : t("error_name"),
    displayName: isValidName(displayName, CIRCLE_LIMITS.displayName) ? undefined : t("error_display_name"),
  }
  const valid = !errors.name && !errors.displayName

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ name: true, displayName: true })
    if (!valid || pending) return
    await run("create", async () => {
      const result = await api.createCircle({ name: name.trim(), displayName: displayName.trim() })
      rememberInvite(result.circleId, result.inviteCode)
      setCreated({ circleId: result.circleId, link: inviteLink(window.location.origin, result.inviteCode), name: name.trim() })
      toast.success(t("created_title"), { description: name.trim() })
      onCreated()
    })
  }

  if (created) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("created_title")}</DialogTitle>
          <DialogDescription>{t("created_body", { name: created.name })}</DialogDescription>
        </DialogHeader>
        <FormField label={t("invite_link")} htmlFor={`${id}-link`}>
          <div className="flex min-w-0 items-center gap-2">
            <Input id={`${id}-link`} readOnly value={created.link} className="min-w-0 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={created.link} label={t("copy_link")} successMessage={t("link_copied")} variant="outline" />
          </div>
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {c("close")}
          </Button>
          <Button type="button" onClick={() => router.push(`/circles/${created.circleId}`)}>
            {t("open_circle")}
            <ArrowRight aria-hidden />
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("create_title")}</DialogTitle>
        <DialogDescription>{t("create_description")}</DialogDescription>
      </DialogHeader>
      <FormField label={t("name")} htmlFor={`${id}-name`} error={touched.name ? errors.name : undefined} required>
        <Input
          id={`${id}-name`}
          value={name}
          autoFocus
          maxLength={CIRCLE_LIMITS.name}
          placeholder={t("name_placeholder")}
          aria-invalid={Boolean(touched.name && errors.name) || undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((x) => ({ ...x, name: true }))}
        />
      </FormField>
      <FormField
        label={t("display_name")}
        htmlFor={`${id}-display`}
        description={t("display_name_help")}
        error={touched.displayName ? errors.displayName : undefined}
        required
      >
        <Input
          id={`${id}-display`}
          value={displayName}
          maxLength={CIRCLE_LIMITS.displayName}
          aria-invalid={Boolean(touched.displayName && errors.displayName) || undefined}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => setTouched((x) => ({ ...x, displayName: true }))}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid || pending !== null}>
          {pending ? <Spinner /> : null}
          {pending ? t("creating") : t("create_submit")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** "Join with a link": paste the link or the code → the join page, which shows what you're joining. */
export function JoinCircleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open ? <JoinCircleForm onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function JoinCircleForm({ onClose }: { onClose: () => void }) {
  const t = useT(circleFormMessages)
  const c = useT(commonMessages)
  const id = useId()
  const router = useRouter()
  const [value, setValue] = useState("")
  const [touched, setTouched] = useState(false)
  const code = parseInvite(value)
  const error = touched && value.trim() && !code ? t("error_link") : undefined

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!code) return
    onClose()
    router.push(`/circles/join/${code}`)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("join_title")}</DialogTitle>
        <DialogDescription>{t("join_description")}</DialogDescription>
      </DialogHeader>
      <FormField label={t("invite_link")} htmlFor={`${id}-link`} error={error}>
        <div className="relative">
          <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={`${id}-link`}
            value={value}
            autoFocus
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className="pl-8"
            placeholder={t("join_placeholder")}
            aria-invalid={Boolean(error) || undefined}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </div>
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!code}>
          {t("continue")}
          <ArrowRight aria-hidden />
        </Button>
      </DialogFooter>
    </form>
  )
}
