"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { ColorSwatchPicker, FormField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { AudiencePersona, CategoricalColor } from "@/lib/types"
import { nextPersonaColor } from "./audience-model"
import { personaMessages } from "./persona-messages"

/** Name + profession + colour; the profile sheet opens next for the rest of §5. */
export function PersonaCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (persona: AudiencePersona) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <CreateForm
            onCancel={() => onOpenChange(false)}
            onCreated={(persona) => {
              onOpenChange(false)
              onCreated(persona)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (persona: AudiencePersona) => void }) {
  const id = useId()
  const t = useT(personaMessages)
  const c = useT(commonMessages)
  const personas = useTable("audience_personas")
  const first = personas.length === 0
  const [name, setName] = useState("")
  const [profession, setProfession] = useState("")
  const [color, setColor] = useState<CategoricalColor>(() => nextPersonaColor(personas))
  const [primary, setPrimary] = useState(first)
  const [touched, setTouched] = useState(false)
  const clean = name.replace(/\s+/g, " ").trim()
  const error = touched && !clean ? t("name_required") : null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!clean) return
    const makePrimary = primary || first
    if (makePrimary) {
      const current = dataActions.getDb().audience_personas.filter((p) => p.is_primary)
      if (current.length) {
        dataActions.updateMany(
          "audience_personas",
          current.map((p) => ({ id: p.id, patch: { is_primary: false } }))
        )
      }
    }
    const row = dataActions.insert("audience_personas", {
      name: clean,
      profession: profession.replace(/\s+/g, " ").trim(),
      color,
      is_primary: makePrimary,
    })
    toast.success(t("created"), { description: t("created_description") })
    onCreated(row)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("create_title")}</DialogTitle>
        <DialogDescription>{t("create_description")}</DialogDescription>
      </DialogHeader>
      <FormField label={t("name")} htmlFor={`${id}-name`} required error={error}>
        <Input
          id={`${id}-name`}
          autoFocus
          value={name}
          maxLength={120}
          placeholder={t("name_placeholder")}
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => {
            setName(event.target.value)
            setTouched(true)
          }}
        />
      </FormField>
      <FormField label={t("profession")} htmlFor={`${id}-profession`}>
        <Input
          id={`${id}-profession`}
          value={profession}
          maxLength={200}
          placeholder={t("profession_create_placeholder")}
          onChange={(event) => setProfession(event.target.value)}
        />
      </FormField>
      <FormField label={t("colour")}>
        <ColorSwatchPicker value={color} onChange={setColor} aria-label={t("colour_aria")} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={primary || first} disabled={first} onCheckedChange={(checked) => setPrimary(checked === true)} />
        {first ? t("first_is_primary") : t("make_primary")}
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!clean}>
          {t("create_persona")}
        </Button>
      </DialogFooter>
    </form>
  )
}
