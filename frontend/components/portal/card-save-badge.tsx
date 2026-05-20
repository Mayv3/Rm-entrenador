"use client"

import { useSaveStatusForEj } from "@/lib/save-status"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

export function CardSaveBadge({ ejId }: { ejId: number }) {
  const status = useSaveStatusForEj(ejId)
  if (status === "idle") return null

  const cfg = {
    saving: { icon: Loader2, text: "Guardando", spin: true, cls: "bg-muted/60 border-border text-muted-foreground dark:bg-zinc-800/60 dark:border-white/[0.08] dark:text-zinc-400" },
    saved: { icon: CheckCircle2, text: "Guardado", spin: false, cls: "bg-green-500/15 border-green-500/30 text-green-500 dark:text-green-400" },
    error: { icon: AlertCircle, text: "Error", spin: false, cls: "bg-red-500/15 border-red-500/30 text-red-500 dark:text-red-400" },
  }[status]
  const Icon = cfg.icon

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${cfg.cls}`}>
      <Icon className={`h-2.5 w-2.5 ${cfg.spin ? "animate-spin" : ""}`} />
      {cfg.text}
    </span>
  )
}
