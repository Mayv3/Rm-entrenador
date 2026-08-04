"use client"

import { useSaveStatusForEj } from "@/lib/save-status"
import { CheckCircle2, AlertCircle } from "lucide-react"

export function CardSaveBadge({ ejId }: { ejId: number }) {
  const status = useSaveStatusForEj(ejId)
  // "saving" se muestra como barra de carga (CardSaveBar) debajo del header, no como badge.
  if (status === "idle" || status === "saving") return null

  const cfg = {
    saved: { icon: CheckCircle2, text: "Guardado", cls: "bg-green-500/15 border-green-500/30 text-green-500 dark:text-green-400" },
    error: { icon: AlertCircle, text: "Error", cls: "bg-red-500/15 border-red-500/30 text-red-500 dark:text-red-400" },
  }[status]
  const Icon = cfg.icon

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${cfg.cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.text}
    </span>
  )
}

// Barra de carga fina, pegada al borde inferior del header de la card — reemplaza el
// badge "Guardando" con un efecto de progreso indeterminado. El padre debe ser `relative`.
export function CardSaveBar({ ejId }: { ejId: number }) {
  const status = useSaveStatusForEj(ejId)
  if (status !== "saving") return null

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-black/10 dark:bg-white/10">
      <div className="h-full w-1/3 rounded-full bg-primary animate-save-bar" />
    </div>
  )
}
