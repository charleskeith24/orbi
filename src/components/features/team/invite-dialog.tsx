"use client"

/**
 * Invite someone into your workspace by email. Beta rule: the invitee needs an Orbi account already, and
 * accounts only come through the admin waitlist — so this never bypasses admin approval, and the wording
 * never reveals whether that email has an account.
 */
import { Copy, Send } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { InfoHint } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { teamMessages } from "@/lib/team/messages"
import { MEMBER_ROLES, type MemberRole } from "@/lib/team/permissions"
import { teamErrorKey, toTeamError } from "@/lib/team/types"
import { cn } from "@/lib/utils"
import { teamActions, useTeamBusy } from "./team-store"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(teamMessages)
  const c = useT(commonMessages)
  const busy = useTeamBusy()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<MemberRole>("editor")
  const [money, setMoney] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = EMAIL_RE.test(email.trim())

  const reset = () => {
    setEmail("")
    setRole("editor")
    setMoney(false)
    setError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid || busy) return
    setError(null)
    const address = email.trim().toLowerCase()
    try {
      await teamActions.run((api) => api.invite({ email: address, role, moneyAccess: money }))
      toast.success(t("invite_sent", { email: address }))
      reset()
      onOpenChange(false)
    } catch (caught) {
      setError(t(teamErrorKey(toTeamError(caught).code)))
    }
  }

  const copySignup = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/signup`)
      toast.success(c("copied"))
    } catch {
      toast.error(c("error_generic"))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("invite_title")}</DialogTitle>
            <DialogDescription>{t("invite_help")}</DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="team-invite-email">{t("invite_email")}</Label>
            <Input
              id="team-invite-email"
              type="email"
              autoComplete="off"
              inputMode="email"
              placeholder={t("invite_email_placeholder")}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError(null)
              }}
            />
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="flex items-center gap-1 text-sm font-medium">
              {t("role_label")}
              <InfoHint title={t("role_label")}>
                {t("role_editor_hint")} {t("role_viewer_hint")}
              </InfoHint>
            </legend>
            <div className="flex gap-2">
              {MEMBER_ROLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={role === option}
                  onClick={() => setRole(option)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    role === option ? "border-brand bg-brand-soft font-medium" : "hover:bg-accent"
                  )}
                >
                  {t(`role_${option}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex min-w-0 items-center justify-between gap-3">
            <Label htmlFor="team-invite-money" className="flex items-center gap-1 font-medium">
              {t("money_access")}
              <InfoHint title={t("money_access")}>{t("money_access_info")}</InfoHint>
            </Label>
            <Switch id="team-invite-money" checked={money} onCheckedChange={setMoney} />
          </div>

          <p className="text-xs text-muted-foreground">
            {t("invite_no_account")}{" "}
            <Button type="button" size="xs" variant="ghost" className="h-auto px-1 font-medium text-foreground" onClick={() => void copySignup()}>
              <Copy aria-hidden />
              {t("invite_request_access")}
            </Button>
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {c("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              <Send aria-hidden />
              {t("invite_send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
