"use client"

import { useSaveStatus } from "@/lib/save-status"
import { CheckCircle2, AlertCircle } from "lucide-react"

export function SaveStatusIndicator() {
  const { status } = useSaveStatus()
  // "saving" ya no se muestra acá: cada card tiene su propia barra de carga.
  if (status === "idle" || status === "saving") return null

  const cfg = {
    saved: { icon: CheckCircle2, text: "Guardado", cls: "text-green-500 dark:text-green-400" },
    error: { icon: AlertCircle, text: "Error al guardar", cls: "text-red-500 dark:text-red-400" },
  }[status]
  const Icon = cfg.icon

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{cfg.text}</span>
    </div>
  )
}
