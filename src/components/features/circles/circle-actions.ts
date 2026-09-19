/**
 * "Add to Collabs": an accepted ask becomes a collab in *your own* workspace, through the store like every
 * Collab tracker write (optimistic, persisted by the workspace adapter). Nothing is sent to the circle.
 */
import { collabFromAsk } from "@/lib/circles/ask-to-collab"
import type { CircleAsk } from "@/lib/circles/types"
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions } from "@/lib/store"
import type { Collab, ID } from "@/lib/types"
import { rememberAddedCollab } from "./circle-memory"
import { circleAskMessages } from "./messages"

export function addAskToCollabs(input: { ask: CircleAsk; circleName: string; partnerId: ID; partnerName: string; contact: string | null; now?: Date }): Collab {
  const lang = getUiLang()
  const values = collabFromAsk(
    { ask: input.ask, partnerName: input.partnerName, contact: input.contact, now: input.now ?? new Date() },
    {
      fromCircle: translate(circleAskMessages, lang, "note_from_circle", { circle: input.circleName }),
      contact: translate(circleAskMessages, lang, "note_contact"),
    }
  )
  const row = dataActions.insert("collabs", values)
  rememberAddedCollab(input.ask.id, input.partnerId, row.id)
  return row
}
