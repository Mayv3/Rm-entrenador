"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { PlanEjercicio } from "@/types/planificaciones"

interface WeekDosisModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  planEjercicio: PlanEjercicio
  onSaved: () => void
}

export function WeekDosisModal({ open, onOpenChange, planEjercicio, onSaved }: WeekDosisModalProps) {
  const [dosis, setDosis] = useState<string[]>(() => Array.from({ length: 6 }, () => ""))
  const [saving, setSaving] = useState(false)

  const handleDosisChange = (index: number, value: string) => {
    setDosis(prev => {
      const next = [...prev]
      for (let j = index; j < 6; j++) {
        next[j] = value
      }
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const initial = Array(6).fill("")
    planEjercicio.semanas.forEach((s) => {
      initial[s.semana - 1] = s.dosis ?? ""
    })
    setDosis(initial)
  }, [open, planEjercicio])

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/ejercicios/${planEjercicio.id}/semanas`,
        {
          semanas: dosis.map((d, i) => ({ semana: i + 1, dosis: d || null })),
        }
      )
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <div className="space-y-1 mb-2">
          <h2 className="text-base font-semibold">{planEjercicio.ejercicios.nombre}</h2>
          <p className="text-xs text-muted-foreground">Configurá la dosis para cada semana</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs text-muted-foreground">Semana {i + 1}</Label>
              <Input
                placeholder="ej: 3 x 6-8 rpe 7"
                value={dosis[i]}
                onChange={(e) => handleDosisChange(i, e.target.value)}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
