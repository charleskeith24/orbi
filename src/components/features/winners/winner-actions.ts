import { toast } from "sonner"
import { isWinnerTier } from "@/lib/analytics"
import { dataActions } from "@/lib/store"
import type { ContentItem, PerformanceTier } from "@/lib/types"
import { truncate } from "@/lib/utils"

/** Pin or unpin a post in the Winning Content Library (`pinned_winner`), with undo. */
export function togglePinnedWinner(item: Pick<ContentItem, "id" | "title" | "pinned_winner">, tier: PerformanceTier) {
  const next = !item.pinned_winner
  dataActions.update("content_items", item.id, { pinned_winner: next })
  toast.success(next ? "Pinned to the Winning Content Library" : "Unpinned", {
    description:
      next || isWinnerTier(tier)
        ? truncate(item.title || "Untitled content", 90)
        : "It leaves the library — it's below your Winner threshold.",
    action: {
      label: "Undo",
      onClick: () => dataActions.update("content_items", item.id, { pinned_winner: !next }),
    },
  })
}
