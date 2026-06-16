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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CreditCard } from "lucide-react"
import axios from "axios"
import { calculateDueDate, isoToDisplayDate, displayDateToIso } from "@/lib/utils"
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
  const [selectedBaseId, setSelectedBaseId] = useState("")
  const [selectedMeses, setSelectedMeses] = useState(1)
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dateDisplay, setDateDisplay] = useState(isoToDisplayDate(new Date().toISOString().split("T")[0]))
  const [dueDateDisplay, setDueDateDisplay] = useState(isoToDisplayDate(calculateDueDate(new Date().toISOString().split("T")[0], 1)))

  useEffect(() => { setDateDisplay(isoToDisplayDate(formData.date)) }, [formData.date])
  useEffect(() => { setDueDateDisplay(isoToDisplayDate(formData.dueDate)) }, [formData.dueDate])

  const handleDateDisplayChange = (val: string) => {
    setDateDisplay(val)
    const iso = displayDateToIso(val)
    if (iso) setFormData((prev) => ({ ...prev, date: iso }))
  }
  const handleDueDateDisplayChange = (val: string) => {
    setDueDateDisplay(val)
    const iso = displayDateToIso(val)
    if (iso) setFormData((prev) => ({ ...prev, dueDate: iso }))
  }

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
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, selectedMeses) }))
  }, [formData.date, selectedMeses])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleStudentSelect = (value: string) => {
    const selected = students.find((s) => String(s.id) === String(value))
    setFormData((prev) => ({ ...prev, alumno_id: value, name: selected?.name ?? "" }))
  }

  const handleBaseSelect = (baseId: string) => {
    const base = planes.find((p) => String(p.id) === baseId)
    if (!base) return
    setSelectedBaseId(baseId)
    setSelectedMeses(1)
    setFormData((prev) => ({
      ...prev,
      modalidad: `${base.nombre} · Individual`,
      amount: String(base.precio),
      dueDate: calculateDueDate(prev.date, 1),
    }))
  }

  // Subplanes disponibles del plan base seleccionado, indexados por duración en meses
  const durationOptions = useMemo(() => {
    if (!selectedBaseId) return []
    const subs = subplanMap.get(Number(selectedBaseId)) ?? []
    return subs
      .filter((s) => s.duracion_meses === 3 || s.duracion_meses === 6)
      .sort((a, b) => (a.duracion_meses ?? 0) - (b.duracion_meses ?? 0))
  }, [selectedBaseId, subplanMap])

  const applyDuration = (meses: number) => {
    const base = planes.find((p) => String(p.id) === selectedBaseId)
    if (!base) return
    if (meses === 1) {
      setSelectedMeses(1)
      setFormData((prev) => ({
        ...prev,
        modalidad: `${base.nombre} · Individual`,
        amount: String(base.precio),
        dueDate: calculateDueDate(prev.date, 1),
      }))
      return
    }
    const sub = durationOptions.find((s) => s.duracion_meses === meses)
    if (!sub) return
    setSelectedMeses(meses)
    setFormData((prev) => ({
      ...prev,
      modalidad: `${base.nombre} · ${meses} meses`,
      amount: String(sub.precio),
      dueDate: calculateDueDate(prev.date, meses),
    }))
  }

  // % de descuento del plan multi-mes vs pagar el individual × meses
  const descuento = useMemo(() => {
    if (selectedMeses <= 1 || !selectedBaseId) return 0
    const base = planes.find((p) => String(p.id) === selectedBaseId)
    const monto = Number(formData.amount)
    if (!base || base.precio <= 0 || !monto) return 0
    const full = base.precio * selectedMeses
    if (full <= 0) return 0
    const pct = Math.round((1 - monto / full) * 100)
    return pct > 0 ? pct : 0
  }, [selectedBaseId, selectedMeses, formData.amount, planes])

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
        setSelectedBaseId("")
        setSelectedMeses(1)
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
      <DialogContent className="w-[90vw] !max-w-[560px] p-0 gap-0 overflow-x-hidden h-auto max-h-[calc(100dvh-5rem)] flex flex-col rounded-2xl">
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
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Fecha de pago</span><span className="font-medium">{isoToDisplayDate(formData.date)}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Vencimiento</span><span className="font-medium">{isoToDisplayDate(formData.dueDate)}</span></div>
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
                  <Select value={selectedBaseId} onValueChange={handleBaseSelect}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {basePlans.map((base) => (
                        <SelectItem key={base.id} value={String(base.id)}>
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{base.nombre}</span>
                            {base.precio > 0 && <span className="text-[11px] text-muted-foreground">${base.precio.toLocaleString("es-AR")}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedBaseId && durationOptions.length > 0 && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duración (opcional)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={selectedMeses === 1 ? "default" : "outline"}
                      size="sm"
                      className={`flex-1 h-9 ${selectedMeses === 1 ? "bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white" : ""}`}
                      onClick={() => applyDuration(1)}
                    >
                      Individual
                    </Button>
                    {durationOptions.map((sub) => (
                      <Button
                        key={sub.id}
                        type="button"
                        variant={selectedMeses === sub.duracion_meses ? "default" : "outline"}
                        size="sm"
                        className={`flex-1 h-9 ${selectedMeses === sub.duracion_meses ? "bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white" : ""}`}
                        onClick={() => applyDuration(sub.duracion_meses!)}
                      >
                        {sub.duracion_meses} meses
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="amount" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monto</Label>
                  <div className="relative">
                    {descuento > 0 && (
                      <span
                        className="absolute -top-2.5 -right-2.5 z-10 flex flex-col items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-background leading-none"
                        title={`Descuento aplicado: ${descuento}%`}
                      >
                        <span className="text-[11px] font-bold">-{descuento}%</span>
                      </span>
                    )}
                    <Input id="amount" name="amount" type="number" value={formData.amount} onChange={handleChange} placeholder="0.00" className="h-9" required />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de pago</Label>
                  <Input id="date" name="date" type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} className="h-9" required />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="dueDate" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de vencimiento</Label>
                <Input id="dueDate" name="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))} className="h-9" />
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
