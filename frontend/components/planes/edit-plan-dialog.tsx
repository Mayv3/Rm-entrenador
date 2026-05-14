"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Pencil } from "lucide-react"
import axios from "axios"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import type { Plan } from "@/hooks/use-planes"
import { usePlanes } from "@/hooks/use-planes"
import { ColorPickerPopover } from "@/components/ui/colorSelector"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

interface EditPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Plan
}

interface SubplanEdit {
  id: number
  duracion_meses: number
  descuento: string
}

export function EditPlanDialog({ open, onOpenChange, plan }: EditPlanDialogProps) {
  const queryClient = useQueryClient()
  const { data: planes = [] } = usePlanes()
  const [formData, setFormData] = useState({ nombre: "", precio: "", descripcion: "", color: "#22b567" })
  const [subplans, setSubplans] = useState<SubplanEdit[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (plan) {
      setFormData({
        nombre: plan.nombre ?? "",
        precio: plan.precio?.toString() ?? "",
        descripcion: plan.descripcion ?? "",
        color: plan.color ?? "#22b567",
      })
      const children = planes.filter((p) => p.parent_id === plan.id)
      setSubplans(children.map((c) => ({ id: c.id, duracion_meses: c.duracion_meses ?? 3, descuento: c.descuento.toString() })))
    }
  }, [plan, planes])

  useDialogBackButton(open, onOpenChange)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubplanDescuento = (id: number, value: string) => {
    const n = Number(value)
    if (value !== "" && (n < 0 || n > 100)) return
    setSubplans((prev) => prev.map((s) => (s.id === id ? { ...s, descuento: value } : s)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre) return
    setIsLoading(true)
    try {
      const basePrecio = Number(formData.precio) || 0
      const subplansPayload = subplans.map((s) => ({
        id: s.id,
        descuento: Number(s.descuento) || 0,
        precio: Math.round(basePrecio * s.duracion_meses * (1 - Number(s.descuento) / 100)),
      }))

      const response = await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planes/${plan.id}`, {
        nombre: formData.nombre,
        precio: basePrecio,
        descripcion: formData.descripcion || null,
        color: formData.color || null,
        subplans: subplansPayload,
      })
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.planes })
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Error al actualizar el plan:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const basePrecio = Number(formData.precio) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[480px] p-0 gap-0 overflow-x-hidden h-auto max-h-[90vh] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Editar Plan</DialogTitle>

        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <Pencil className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Editar Plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Actualizá la información del plan</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-5 py-4 grid gap-4">

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nombre" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre *</Label>
                <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Premium" className="h-9" required />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</Label>
                <ColorPickerPopover
                  value={formData.color}
                  onChange={(c) => setFormData((p) => ({ ...p, color: c }))}
                  label={formData.color}
                  height="36px"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="precio" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio mensual</Label>
              <Input id="precio" name="precio" type="number" min="0" value={formData.precio} onChange={handleChange} placeholder="0.00" className="h-9" />
            </div>

            {subplans.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variantes</Label>
                {subplans.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-xs font-medium">{s.duracion_meses} meses</p>
                      {basePrecio > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ${Math.round(basePrecio * s.duracion_meses * (1 - Number(s.descuento) / 100)).toLocaleString("es-AR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={s.descuento}
                        onChange={(e) => handleSubplanDescuento(s.id, e.target.value)}
                        className="h-8 w-16 text-right"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción</Label>
              <RichTextEditor
                value={formData.descripcion}
                onChange={(html) => setFormData((p) => ({ ...p, descripcion: html }))}
              />
            </div>

          </div>

          <DialogFooter className="px-5 py-3 border-t bg-muted/40 mt-auto flex flex-row gap-3">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
              disabled={isLoading || !formData.nombre}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
