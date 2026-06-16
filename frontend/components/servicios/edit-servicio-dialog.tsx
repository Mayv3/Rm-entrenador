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
import type { Servicio } from "@/hooks/use-servicios"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { ColorPickerPopover } from "@/components/ui/colorSelector"

interface EditServicioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicio: Servicio
}

export function EditServicioDialog({ open, onOpenChange, servicio }: EditServicioDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({ nombre: "", precio: "", descripcion: "", color: "#22b567" })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (servicio) {
      setFormData({
        nombre: servicio.nombre ?? "",
        precio: servicio.precio?.toString() ?? "",
        descripcion: servicio.descripcion ?? "",
        color: servicio.color ?? "#22b567",
      })
    }
  }, [servicio])


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre) return
    setIsLoading(true)
    try {
      const response = await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/servicios/${servicio.id}`, {
        nombre: formData.nombre,
        precio: Number(formData.precio) || 0,
        descripcion: formData.descripcion || null,
        color: formData.color || null,
      })
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.servicios })
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Error al actualizar el servicio:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[480px] p-0 gap-0 overflow-x-hidden h-auto max-h-[calc(100dvh-5rem)] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Editar Servicio</DialogTitle>

        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <Pencil className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Editar Servicio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Actualizá la información del servicio</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-5 py-4 grid gap-4">

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nombre" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre *</Label>
                <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Consulta personalizada" className="h-9" required />
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
              <Label htmlFor="precio" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio</Label>
              <Input id="precio" name="precio" type="number" min="0" value={formData.precio} onChange={handleChange} placeholder="0.00" className="h-9" />
            </div>

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
