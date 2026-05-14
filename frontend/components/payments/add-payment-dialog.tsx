"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CreditCard } from "lucide-react"
import axios from "axios"
import { calculateDueDate } from "@/lib/utils"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePlanes, type Plan } from "@/hooks/use-planes"

interface Student {
  id: string;
  name: string;
  whatsapp: string;
}

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaymentUpdated: () => void
}

export function AddPaymentDialog({ open, onOpenChange, onPaymentUpdated }: AddPaymentDialogProps) {
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
    alumno_id: "",
    name: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
    modalidad: "",
  })
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getallstudents`)
      .then((r) => {
        const mapped: Student[] = r.data.map((s: any) => ({
          id: String(s.id),
          name: s.nombre,
          whatsapp: s.telefono,
        }))
        setStudents(mapped)
      })
      .catch((e) => console.error("Error al obtener los nombres:", e))
  }, [])

  useEffect(() => {
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, 1) }))
  }, [formData.date])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleStudentSelect = (value: string) => {
    const selected = students.find((s) => String(s.id) === String(value))
    setFormData((prev) => ({ ...prev, alumno_id: value, name: selected?.name ?? "" }))
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
      modalidad: label,
      amount: String(plan.precio),
      dueDate: calculateDueDate(prev.date, meses),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.alumno_id || !formData.modalidad || !formData.name) {
      alert("Todos los campos son obligatorios")
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const selected = students.find((s) => s.id === formData.alumno_id)
      const paymentData = {
        alumno_id: formData.alumno_id,
        nombre: formData.name,
        monto: Number(formData.amount),
        fecha_de_pago: formData.date,
        fecha_de_vencimiento: formData.dueDate,
        modalidad: formData.modalidad,
        whatsapp: selected?.whatsapp ?? "",
      }
      const response = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/addPayment`, paymentData)
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.payments })
        onOpenChange(false)
        onPaymentUpdated()
        setShowConfirm(false)
        setSelectedPlanId("")
        setFormData({
          alumno_id: "",
          name: "",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
          modalidad: "",
        })
      }
    } catch (error) {
      console.error("Error al registrar el pago:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useDialogBackButton(open, onOpenChange)

  const handleOpenChange = (val: boolean) => {
    if (!val) setShowConfirm(false)
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[560px] p-0 gap-0 overflow-x-hidden h-auto max-h-[80vh] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Registrar Pago</DialogTitle>
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <CreditCard className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Registrar Pago</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Completá la información del nuevo pago</p>
          </div>
        </div>

        {showConfirm ? (
          <div className="flex flex-col flex-1">
            <div className="px-5 py-6 flex flex-col gap-4 flex-1">
              <p className="text-sm text-muted-foreground">Revisá los datos antes de confirmar el registro:</p>
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Alumno</span><span className="font-medium">{formData.name}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Plan</span><span className="font-medium">{formData.modalidad}</span></div>
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
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alumno</Label>
                  <Select value={formData.alumno_id} onValueChange={handleStudentSelect}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                disabled={isLoading || !formData.alumno_id || !formData.amount || !formData.modalidad}
              >
                Registrar pago
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
