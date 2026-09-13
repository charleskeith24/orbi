"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { PipelineStage } from "@/lib/types"
import { STAGE_IDS } from "./board-model"

const KEY = "pbos:pipeline:collapsed"
const listeners = new Set<() => void>()
/** Latest value written this session — keeps working when storage is unavailable. */
let memory: string | null = null

function read(): string {
  if (memory !== null) return memory
  try {
    return window.localStorage.getItem(KEY) ?? "[]"
  } catch {
    return "[]"
  }
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return
    memory = null
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function write(stages: PipelineStage[]) {
  memory = JSON.stringify(stages)
  try {
    window.localStorage.setItem(KEY, memory)
  } catch {
    // Storage blocked (private mode): the in-memory value still works for this session.
  }
  listeners.forEach((listener) => listener())
}

function parse(raw: string): Set<PipelineStage> {
  try {
    const value: unknown = JSON.parse(raw)
    return new Set(Array.isArray(value) ? STAGE_IDS.filter((stage) => value.includes(stage)) : [])
  } catch {
    return new Set()
  }
}

/** Collapsed Kanban columns, persisted in this browser. */
export function useCollapsedStages() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]")
  const collapsed = useMemo(() => parse(raw), [raw])

  const setCollapsed = useCallback((stage: PipelineStage, value: boolean) => {
    const next = parse(read())
    if (value) next.add(stage)
    else next.delete(stage)
    write(STAGE_IDS.filter((s) => next.has(s)))
  }, [])

  const setAll = useCallback((stages: PipelineStage[]) => {
    write(STAGE_IDS.filter((s) => stages.includes(s)))
  }, [])

  return { collapsed, setCollapsed, setAll }
}
