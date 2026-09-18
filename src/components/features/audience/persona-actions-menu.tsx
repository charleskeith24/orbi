"use client"

import { Copy, Ellipsis, Link2, PanelRightOpen, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useT, useUiLang } from "@/lib/i18n"
import type { AudiencePersona } from "@/lib/types"
import { cn } from "@/lib/utils"
import { audienceMessages } from "./messages"
import { personaName, type PersonaActions } from "./persona-actions"
import { personaMessages } from "./persona-messages"

/** "⋯" menu for one persona: open, set primary, duplicate, copy link, delete. */
export function PersonaActionsMenu({
  persona,
  actions,
  onOpen,
  className,
}: {
  persona: AudiencePersona
  actions: PersonaActions
  /** Adds "Open profile" (omit inside the profile sheet). */
  onOpen?: () => void
  className?: string
}) {
  const t = useT(personaMessages)
  const a = useT(audienceMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("actions_for", { name: personaName(persona, lang) })}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onOpen ? (
          <DropdownMenuItem onSelect={onOpen}>
            <PanelRightOpen aria-hidden />
            {t("open_profile")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={persona.is_primary} onSelect={() => actions.setPrimary(persona)}>
          <Star aria-hidden />
          {persona.is_primary ? t("primary_persona") : t("set_primary")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.duplicate(persona)}>
          <Copy aria-hidden />
          {t("duplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.copyLink(persona)}>
          <Link2 aria-hidden />
          {a("copy_link")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(persona)}>
          <Trash2 aria-hidden />
          {c("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
