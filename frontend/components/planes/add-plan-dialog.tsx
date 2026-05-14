"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Tag } from "lucide-react"
import axios from "axios"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { ColorPickerPopover } from "@/components/ui/colorSelector"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

interface AddPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMPTY_FORM = { nombre: "", precio: "", descripcion: "", color: "#22b567" }

export function AddPlanDialog({ open, onOpenChange }: AddPlanDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(false)

  useDialogBackButton(open, onOpenChange)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre) return
    setIsLoading(true)
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planes`, {
        nombre: formData.nombre,
        precio: Number(formData.precio) || 0,
        descripcion: formData.descripcion || null,
        color: formData.color || null,
      })
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.planes })
        onOpenChange(false)
        setFormData(EMPTY_FORM)
      }
    } catch (error) {
      console.error("Error al crear el plan:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const precio = Number(formData.precio) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[480px] p-0 gap-0 overflow-x-hidden h-auto max-h-[90vh] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Nuevo Plan</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <Tag className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Nuevo Plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Completá la información del plan</p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-5 py-4 grid gap-4">

            {/* Nombre + Color */}
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

            {/* Precio mensual */}
            <div className="grid gap-1.5">
              <Label htmlFor="precio" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio mensual</Label>
              <Input id="precio" name="precio" type="number" min="0" value={formData.precio} onChange={handleChange} placeholder="0.00" className="h-9" />
            </div>

            {/* Preview variantes */}
            {precio > 0 && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 grid gap-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Variantes que se crearán</span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex flex-col gap-0.5 rounded-md border bg-background px-2.5 py-1.5">
                    <span className="text-[10px] text-muted-foreground">3 meses (-10%)</span>
                    <span className="text-sm font-semibold">${Math.round(precio * 3 * 0.9).toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-md border bg-background px-2.5 py-1.5">
                    <span className="text-[10px] text-muted-foreground">6 meses (-15%)</span>
                    <span className="text-sm font-semibold">${Math.round(precio * 6 * 0.85).toLocaleString("es-AR")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Descripción */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción</Label>
              <RichTextEditor
                value={formData.descripcion}
                onChange={(html) => setFormData((p) => ({ ...p, descripcion: html }))}
              />
            </div>

          </div>

          {/* Footer */}
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
