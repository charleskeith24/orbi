/**
 * Collab writes (status moves, follow-ups, ratings, content links, AI ideas saved as collabs). The board,
 * table, sheet, Today and the New content dialog call these so they behave the same everywhere.
 */
import { toast } from "sonner"
import { translate } from "@/lib/i18n/core"
import { collabStatusMessages } from "@/lib/i18n/messages/collabs"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { formatDate } from "@/lib/dates"
import { dataActions, useDataStore } from "@/lib/store"
import type { Collab, CollabStatus, ID, InsertRow } from "@/lib/types"
import {
  collabIdeaValues,
  followedUpPatch,
  ratingPatch,
  statusPatch,
  withLinkedItems,
  withoutLinkedItem,
  type CollabIdeaDraft,
} from "./collab-model"
import { collabActionMessages } from "./messages"

const db = () => useDataStore.getState().db
const t = (key: keyof (typeof collabActionMessages)["en"], vars?: Record<string, string | number>) =>
  translate(collabActionMessages, getUiLang(), key, vars)
const statusLabel = (status: CollabStatus) => translate(collabStatusMessages, getUiLang(), status)

/** The name a toast shows: title, else "Collab with @handle", else "Untitled collab". */
export function collabName(collab: Pick<Collab, "title" | "partner_handle" | "partner_name">): string {
  const partner = collab.partner_handle.trim() || collab.partner_name.trim()
  return collab.title.trim() || (partner ? t("collab_with", { partner }) : t("untitled"))
}

/** Board drops, the card menu, the table and the sheet. */
export function setCollabStatus(collab: Collab, status: CollabStatus, options: { announce?: boolean; now?: Date } = {}) {
  if (collab.status === status) return
  const now = options.now ?? new Date()
  const patch = statusPatch(collab, status, now)
  dataActions.update("collabs", collab.id, patch)
  if (options.announce || patch.follow_up_on) {
    toast.success(t("moved", { status: statusLabel(status) }), {
      description: patch.follow_up_on ? t("follow_up_set", { date: formatDate(patch.follow_up_on, "EEE, MMM d") }) : collabName(collab),
    })
  }
}

/** Today / sheet "Followed up": the next follow-up moves three days out. */
export function markFollowedUp(collab: Collab, now: Date = new Date()) {
  const patch = followedUpPatch(now)
  dataActions.update("collabs", collab.id, patch)
  toast.success(t("followed_up"), { description: t("next_follow_up", { date: formatDate(patch.follow_up_on, "EEE, MMM d") }) })
}

export function rateCollab(collab: Collab, rating: number | null, now: Date = new Date()) {
  const patch = ratingPatch(collab, rating, now)
  dataActions.update("collabs", collab.id, patch)
  if (patch.status === "reviewed") toast.success(t("rated_reviewed", { rating: patch.rating ?? 0 }), { description: collabName(collab) })
}

/** Adds content items to a collab (Link existing, Create content for this collab). */
export function linkContentToCollab(collabId: ID, itemIds: readonly ID[], options: { silent?: boolean } = {}) {
  const collab = db().collabs.find((c) => c.id === collabId)
  if (!collab) return
  const next = withLinkedItems(collab, itemIds)
  if (!next) return
  dataActions.update("collabs", collab.id, { content_item_ids: next })
  if (!options.silent) toast.success(t("linked", { name: collabName(collab) }))
}

export function unlinkContentFromCollab(collab: Collab, itemId: ID, title: string) {
  const next = withoutLinkedItem(collab, itemId)
  if (!next) return
  dataActions.update("collabs", collab.id, { content_item_ids: next })
  toast.success(t("unlinked"), { description: title })
}

export function deleteCollab(collab: Collab) {
  dataActions.remove("collabs", collab.id)
  toast.success(t("deleted"), { description: collabName(collab) })
}

/** "Save as collab idea" from the Collab ideas panel. */
export function saveCollabIdea(idea: CollabIdeaDraft): Collab {
  const lang = getUiLang()
  const values: InsertRow<"collabs"> = collabIdeaValues(idea, {
    lookFor: translate(collabActionMessages, lang, "note_look_for"),
    why: translate(collabActionMessages, lang, "note_why"),
    format: translate(collabActionMessages, lang, "note_format"),
  })
  return dataActions.insert("collabs", values)
}
