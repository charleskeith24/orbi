"use client"

import { AppWindow, CircleCheck, Download, EllipsisVertical, Info, Share, SquarePlus } from "lucide-react"
import { OrbiMark } from "@/components/app-shell/orbi-logo"
import type { IconComponent } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"
import { m } from "./messages"

/** Platforms without an install API: Orbi explains the browser's own steps instead. */
export type InstructionsMode = "ios" | "android" | "mac-safari"

interface Step {
  icon: IconComponent
  text: string
}

export function InstallInstructionsDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: InstructionsMode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT(m)
  const content: Record<InstructionsMode, { title: string; description: string; steps: Step[]; note?: string }> = {
    ios: {
      title: t("ios_title"),
      description: t("ios_description"),
      steps: [
        { icon: Share, text: t("ios_step_share") },
        { icon: SquarePlus, text: t("ios_step_add") },
        { icon: CircleCheck, text: t("ios_step_confirm") },
      ],
      note: t("ios_share_note"),
    },
    android: {
      title: t("android_title"),
      description: t("android_description"),
      steps: [
        { icon: EllipsisVertical, text: t("android_step_menu") },
        { icon: Download, text: t("android_step_install") },
      ],
      note: t("android_share_note"),
    },
    "mac-safari": {
      title: t("mac_title"),
      description: t("mac_description"),
      steps: [
        { icon: AppWindow, text: t("mac_step_menu") },
        { icon: CircleCheck, text: t("mac_step_add") },
      ],
    },
  }
  const { title, description, steps, note } = content[mode]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card shadow-xs">
              <OrbiMark className="size-7 text-foreground" title="" />
            </span>
            <DialogTitle className="text-base leading-snug font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-pretty">{description}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={step.text} className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5">
              <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 text-sm text-pretty">{step.text}</span>
              <step.icon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </li>
          ))}
        </ol>
        {note ? (
          <p className="flex gap-2 text-xs text-pretty text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{note}</span>
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button>{t("got_it")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
