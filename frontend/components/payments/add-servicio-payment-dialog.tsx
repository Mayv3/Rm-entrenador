"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
import { Loader2, HeartPulse } from "lucide-react"
import axios from "axios"
import { isoToDisplayDate, displayDateToIso } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useServicios } from "@/hooks/use-servicios"

interface Student {
  id: string;
  name: string;
  whatsapp: string;
}

interface AddServicioPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddServicioPaymentDialog({ open, onOpenChange }: AddServicioPaymentDialogProps) {
  const queryClient = useQueryClient()
  const { data: servicios = [] } = useServicios()

  const today = new Date().toISOString().split("T")[0]
  const [formData, setFormData] = useState({
    alumno_id: "",
    name: "",
    amount: "",
    date: today,
    servicioNombre: "",
  })
  const [selectedServicioId, setSelectedServicioId] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dateDisplay, setDateDisplay] = useState(isoToDisplayDate(today))

  useEffect(() => { setDateDisplay(isoToDisplayDate(formData.date)) }, [formData.date])

  const handleDateDisplayChange = (val: string) => {
    setDateDisplay(val)
    const iso = displayDateToIso(val)
    if (iso) setFormData((prev) => ({ ...prev, date: iso }))
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
      .catch((e) => console.error("Error al obtener los alumnos:", e))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleStudentSelect = (value: string) => {
    const selected = students.find((s) => String(s.id) === String(value))
    setFormData((prev) => ({ ...prev, alumno_id: value, name: selected?.name ?? "" }))
  }

  const handleServicioSelect = (servicioId: string) => {
    const servicio = servicios.find((s) => String(s.id) === servicioId)
    if (!servicio) return
    setSelectedServicioId(servicioId)
    setFormData((prev) => ({
      ...prev,
      servicioNombre: servicio.nombre,
      amount: String(servicio.precio ?? 0),
    }))
  }

  const resetForm = () => {
    const t = new Date().toISOString().split("T")[0]
    setFormData({ alumno_id: "", name: "", amount: "", date: t, servicioNombre: "" })
    setSelectedServicioId("")
    setShowConfirm(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.alumno_id || !formData.servicioNombre || !formData.name) {
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
        monto: Number(formData.amount) || 0,
        fecha_de_pago: formData.date,
        fecha_de_vencimiento: formData.date,
        modalidad: `Servicio: ${formData.servicioNombre}`,
        whatsapp: selected?.whatsapp ?? "",
      }
      const response = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/addPayment`, paymentData)
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.payments })
        onOpenChange(false)
        resetForm()
      }
    } catch (error) {
      console.error("Error al registrar el pago del servicio:", error)
    } finally {
      setIsLoading(false)
    }
  }


  const handleOpenChange = (val: boolean) => {
    if (!val) setShowConfirm(false)
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[560px] p-0 gap-0 overflow-x-hidden h-auto max-h-[calc(100dvh-5rem)] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Pagar servicio</DialogTitle>
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <HeartPulse className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Pagar servicio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Registrá el pago de un servicio puntual</p>
          </div>
        </div>

        {showConfirm ? (
          <div className="flex flex-col flex-1">
            <div className="px-5 py-6 flex flex-col gap-4 flex-1">
              <p className="text-sm text-muted-foreground">Revisá los datos antes de confirmar el registro:</p>
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Alumno</span><span className="font-medium">{formData.name}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Servicio</span><span className="font-medium">{formData.servicioNombre}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Monto</span><span className="font-medium">${Number(formData.amount).toLocaleString("es-AR")}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Fecha de pago</span><span className="font-medium">{isoToDisplayDate(formData.date)}</span></div>
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
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Servicio</Label>
                  <Select value={selectedServicioId} onValueChange={handleServicioSelect}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicios.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No hay servicios cargados</div>
                      ) : servicios.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{s.nombre}</span>
                            {s.precio > 0 && <span className="text-[11px] text-muted-foreground">${Number(s.precio).toLocaleString("es-AR")}</span>}
                          </span>
                        </SelectItem>
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
                  <Input id="date" name="date" type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} className="h-9" required />
                </div>
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
                disabled={isLoading || !formData.alumno_id || !formData.amount || !formData.servicioNombre}
              >
                Pagar servicio
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
