"use client"

import { Sparkles, Star } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ColorDot, DetailSheet } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AudiencePersona } from "@/lib/types"
import { personaName, type PersonaActions } from "./persona-actions"
import { PersonaActionsMenu } from "./persona-actions-menu"
import type { PersonaStats } from "./persona-card"
import { GOALS_AND_PAINS, PersonaListFields, PersonaMediaFields, PersonaProfileFields } from "./persona-fields"
import { PersonaLinked } from "./persona-linked"

type PersonaTab = "profile" | "pains" | "media" | "linked"

/** `/audience?open=<id>` — every §5 persona field, autosaved, plus what the persona is linked to. */
export function PersonaSheet({
  persona,
  open,
  stats,
  actions,
  onOpenChange,
}: {
  persona: AudiencePersona | null
  open: boolean
  stats: PersonaStats | undefined
  actions: PersonaActions
  onOpenChange: (open: boolean) => void
}) {
  if (!persona) return null
  const description = [persona.is_primary ? "Primary persona" : "Persona", persona.profession].filter(Boolean).join(" · ")
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <ColorDot color={persona.color} className="size-2.5" />
          <span className="min-w-0">{personaName(persona)}</span>
        </span>
      }
      description={description}
      actions={<PersonaActionsMenu persona={persona} actions={actions} className="size-7" />}
      footer={
        <>
          {persona.is_primary ? null : (
            <Button type="button" variant="outline" size="sm" onClick={() => actions.setPrimary(persona)}>
              <Star aria-hidden />
              Set as primary
            </Button>
          )}
          <Button type="button" size="sm" asChild>
            <Link href={`/ideas/generator?persona=${persona.id}`}>
              <Sparkles aria-hidden />
              Generate ideas
            </Link>
          </Button>
        </>
      }
    >
      <SheetBody key={persona.id} persona={persona} stats={stats} />
    </DetailSheet>
  )
}

function SheetBody({ persona, stats }: { persona: AudiencePersona; stats: PersonaStats | undefined }) {
  const [tab, setTab] = useState<PersonaTab>("profile")
  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as PersonaTab)} className="min-w-0 gap-4">
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="pains">Goals & pains</TabsTrigger>
          <TabsTrigger value="media">Media & voice</TabsTrigger>
          <TabsTrigger value="linked">Linked</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="profile" className="min-w-0">
        <PersonaProfileFields persona={persona} />
      </TabsContent>
      <TabsContent value="pains" className="min-w-0">
        <PersonaListFields persona={persona} fields={GOALS_AND_PAINS} />
      </TabsContent>
      <TabsContent value="media" className="min-w-0">
        <PersonaMediaFields persona={persona} />
      </TabsContent>
      <TabsContent value="linked" className="min-w-0">
        <PersonaLinked persona={persona} stats={stats} />
      </TabsContent>
    </Tabs>
  )
}
