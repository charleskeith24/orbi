import {
  pointerWithin,
  rectIntersection,
  type ClientRect,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from "@dnd-kit/core"

/** Pointer drags target the day under the cursor; keyboard drags the target the item overlaps most. */
export const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : rectIntersection(args)
}

const DIRECTIONS: Record<string, readonly [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
}

/** Arrow keys jump to the nearest drop target in that direction (day to day, week row to week row, the tray). */
export const directionalCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = DIRECTIONS[event.code]
  if (!direction) return undefined
  event.preventDefault()
  const { active, collisionRect, droppableRects, droppableContainers, over } = context
  if (!active || !collisionRect) return undefined
  const from = (over ? droppableRects.get(over.id) : undefined) ?? collisionRect
  const fromX = from.left + from.width / 2
  const fromY = from.top + from.height / 2
  let best: { rect: ClientRect; score: number } | null = null
  for (const container of droppableContainers.getEnabled()) {
    if (container.id === over?.id) continue
    const rect = droppableRects.get(container.id)
    if (!rect) continue
    const dx = rect.left + rect.width / 2 - fromX
    const dy = rect.top + rect.height / 2 - fromY
    const along = dx * direction[0] + dy * direction[1]
    if (along <= 1) continue
    const across = Math.abs(dx * direction[1]) + Math.abs(dy * direction[0])
    const score = along + across * 3
    if (!best || score < best.score) best = { rect, score }
  }
  if (!best) return undefined
  return {
    x: best.rect.left + best.rect.width / 2 - collisionRect.width / 2,
    y: best.rect.top + best.rect.height / 2 - collisionRect.height / 2,
  }
}

export const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] }

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Press Space to pick up this item. Use the arrow keys to move it between days, then press Space or Enter to drop it, or Escape to cancel. Press Enter instead of Space to open the item's actions.",
}
