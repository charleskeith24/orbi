"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { ColorSwatchPicker, FormField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { dataActions, useTable } from "@/lib/store"
import type { AudiencePersona, CategoricalColor } from "@/lib/types"
import { nextPersonaColor } from "./audience-model"

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
  const personas = useTable("audience_personas")
  const first = personas.length === 0
  const [name, setName] = useState("")
  const [profession, setProfession] = useState("")
  const [color, setColor] = useState<CategoricalColor>(() => nextPersonaColor(personas))
  const [primary, setPrimary] = useState(first)
  const [touched, setTouched] = useState(false)
  const clean = name.replace(/\s+/g, " ").trim()
  const error = touched && !clean ? "Give this persona a name." : null

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
    toast.success("Persona created", { description: "Now add their goals, problems and the words they use." })
    onCreated(row)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New persona</DialogTitle>
        <DialogDescription>Name a person you create for. Their goals, problems and language come next.</DialogDescription>
      </DialogHeader>
      <FormField label="Name" htmlFor={`${id}-name`} required error={error}>
        <Input
          id={`${id}-name`}
          autoFocus
          value={name}
          maxLength={120}
          placeholder="e.g. First-time online seller"
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => {
            setName(event.target.value)
            setTouched(true)
          }}
        />
      </FormField>
      <FormField label="Profession" htmlFor={`${id}-profession`}>
        <Input
          id={`${id}-profession`}
          value={profession}
          maxLength={200}
          placeholder="e.g. Runs a Shopee store on the side"
          onChange={(event) => setProfession(event.target.value)}
        />
      </FormField>
      <FormField label="Colour">
        <ColorSwatchPicker value={color} onChange={setColor} aria-label="Persona colour" />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={primary || first} disabled={first} onCheckedChange={(checked) => setPrimary(checked === true)} />
        {first ? "Your first persona becomes your primary persona" : "Make this my primary persona"}
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!clean}>
          Create persona
        </Button>
      </DialogFooter>
    </form>
  )
}
