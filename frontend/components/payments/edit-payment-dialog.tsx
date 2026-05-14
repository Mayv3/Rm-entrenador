"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Pencil } from "lucide-react"
import { calculateDueDate } from "@/lib/utils"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePlanes, type Plan } from "@/hooks/use-planes"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import axios from "axios"

interface EditPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: any
  onPaymentUpdated: () => void
}

export function EditPaymentDialog({ open, onOpenChange, payment, onPaymentUpdated }: EditPaymentDialogProps) {
  const queryClient = useQueryClient()
  const { data: planes = [] } = usePlanes()

  const { basePlans, subplanMap } = useMemo(() => {
    const base = planes.filter((p) => p.parent_id == null)
    const map = new Map<number, Plan[]>()
    for (const p of planes) {
      if (p.parent_id != null) {
        if (!map.has(p.parent_id)) map.set(p.parent_id, [])
        map.get(p.parent_id)!.push(p)
      }
    }
    return { basePlans: base, subplanMap: map }
  }, [planes])

  const [formData, setFormData] = useState({
    id: "",
    studentId: "",
    name: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
    modality: "",
    whatsapp: "",
  })
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (payment) {
      const paymentDate = payment.fecha_de_pago
        ? new Date(payment.fecha_de_pago).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
      const dueDate = payment.fecha_de_vencimiento
        ? new Date(payment.fecha_de_vencimiento).toISOString().split("T")[0]
        : calculateDueDate(paymentDate, 1)

      setFormData({
        id: String(payment.id),
        studentId: String(payment.alumno_id || payment.id_estudiante || ""),
        name: payment.nombre || "",
        amount: payment.monto?.toString() || "",
        date: paymentDate,
        dueDate,
        modality: payment.modalidad || "",
        whatsapp: payment.whatsapp || "",
      })

      const match = planes.find((p) =>
        payment.modalidad === (p.parent_id == null ? `${p.nombre} · Individual` : `${p.nombre} · ${p.duracion_meses} meses`) ||
        payment.modalidad === p.nombre
      )
      setSelectedPlanId(match ? String(match.id) : "")
    }
  }, [payment, planes])

  useDialogBackButton(open, onOpenChange)

  const handleOpenChange = (val: boolean) => {
    if (!val) setShowConfirm(false)
    onOpenChange(val)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePlanSelect = (planId: string) => {
    const plan = planes.find((p) => String(p.id) === planId)
    if (!plan) return
    setSelectedPlanId(planId)
    const meses = plan.duracion_meses ?? 1
    const label = plan.parent_id == null
      ? `${plan.nombre} · Individual`
      : `${plan.nombre} · ${meses} meses`
    setFormData((prev) => ({
      ...prev,
      modality: label,
      amount: String(plan.precio),
      dueDate: calculateDueDate(prev.date, meses),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const paymentData = {
        ...formData,
        phone: formData.whatsapp,
        studentId: formData.studentId || payment?.id_estudiante || "",
      }
      const response = await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/${formData.id}`, paymentData)
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.payments })
        setShowConfirm(false)
        onOpenChange(false)
        onPaymentUpdated()
      }
    } catch (error) {
      console.error("Error al actualizar el pago:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[560px] p-0 gap-0 overflow-x-hidden h-auto max-h-[80vh] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Editar Pago</DialogTitle>
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <Pencil className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Editar Pago</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Actualizá la información del pago</p>
          </div>
        </div>

        {showConfirm ? (
          <div className="flex flex-col flex-1">
            <div className="px-5 py-6 flex flex-col gap-4 flex-1">
              <p className="text-sm text-muted-foreground">Revisá los datos antes de confirmar el cambio:</p>
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Alumno</span><span className="font-medium">{formData.name}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Plan</span><span className="font-medium">{formData.modality}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Monto</span><span className="font-medium">${Number(formData.amount).toLocaleString("es-AR")}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Fecha de pago</span><span className="font-medium">{formData.date}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Vencimiento</span><span className="font-medium">{formData.dueDate}</span></div>
              </div>
            </div>
            <DialogFooter className="px-5 py-3 border-t bg-muted/40 flex flex-row gap-3">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setShowConfirm(false)} disabled={isLoading}>
                Volver
              </Button>
              <Button type="button" size="sm" className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white" onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-5 py-4 grid gap-4">

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alumno</Label>
                  <Input id="name" name="name" value={formData.name} readOnly className="h-9 bg-muted/50 cursor-default" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan</Label>
                  <Select value={selectedPlanId} onValueChange={handlePlanSelect}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {basePlans.map((base) => (
                        <SelectGroup key={base.id}>
                          <SelectLabel className="text-[10px] font-semibold uppercase tracking-wide">{base.nombre}</SelectLabel>
                          <SelectItem value={String(base.id)}>
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-blue-500">Individual</span>
                              {base.precio > 0 && <span className="text-[11px] text-muted-foreground">${base.precio.toLocaleString("es-AR")}</span>}
                            </span>
                          </SelectItem>
                          {(subplanMap.get(base.id) ?? [])
                            .sort((a, b) => (a.duracion_meses ?? 0) - (b.duracion_meses ?? 0))
                            .map((sub) => (
                              <SelectItem key={sub.id} value={String(sub.id)}>
                                <span className="flex items-center gap-1.5">
                                  <span className={`text-xs font-medium ${sub.duracion_meses === 3 ? "text-amber-500" : "text-emerald-600"}`}>{sub.duracion_meses} meses</span>
                                  {sub.precio > 0 && <span className="text-[11px] text-muted-foreground">${sub.precio.toLocaleString("es-AR")}</span>}
                                </span>
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="amount" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monto</Label>
                  <Input id="amount" name="amount" type="number" value={formData.amount} onChange={handleChange} placeholder="0.00" className="h-9" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de pago</Label>
                  <Input id="date" name="date" type="date" value={formData.date} onChange={handleChange} className="h-9" required />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="dueDate" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de vencimiento</Label>
                <Input id="dueDate" name="dueDate" type="date" value={formData.dueDate} readOnly className="h-9 bg-muted/50 cursor-default" />
              </div>

            </div>

            <DialogFooter className="px-5 py-3 border-t bg-muted/40 mt-auto flex flex-row gap-3">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => handleOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white" disabled={isLoading}>
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
