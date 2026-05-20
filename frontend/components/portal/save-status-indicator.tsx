"use client"

import { useSaveStatus } from "@/lib/save-status"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

export function SaveStatusIndicator() {
  const { status } = useSaveStatus()
  if (status === "idle") return null

  const cfg = {
    saving: { icon: Loader2, text: "Guardando...", spin: true, cls: "text-muted-foreground dark:text-zinc-400" },
    saved: { icon: CheckCircle2, text: "Guardado", spin: false, cls: "text-green-500 dark:text-green-400" },
    error: { icon: AlertCircle, text: "Error al guardar", spin: false, cls: "text-red-500 dark:text-red-400" },
  }[status]
  const Icon = cfg.icon

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className={`h-3.5 w-3.5 ${cfg.spin ? "animate-spin" : ""}`} />
      <span>{cfg.text}</span>
    </div>
  )
}
