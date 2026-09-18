import { toast } from "sonner"
import { isWinnerTier } from "@/lib/analytics"
import { translator } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions } from "@/lib/store"
import type { ContentItem, PerformanceTier } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { winnerActionMessages } from "./messages"

/** Pin or unpin a post in the Winning Content Library (`pinned_winner`), with undo. */
export function togglePinnedWinner(item: Pick<ContentItem, "id" | "title" | "pinned_winner">, tier: PerformanceTier) {
  const t = translator(winnerActionMessages, getUiLang())
  const next = !item.pinned_winner
  dataActions.update("content_items", item.id, { pinned_winner: next })
  toast.success(next ? t("pinned") : t("unpinned"), {
    description: next || isWinnerTier(tier) ? truncate(item.title || t("untitled_content"), 90) : t("leaves"),
    action: {
      label: t("undo"),
      onClick: () => dataActions.update("content_items", item.id, { pinned_winner: !next }),
    },
  })
}
