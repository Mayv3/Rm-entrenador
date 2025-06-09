"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import axios from "axios"

interface EditPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: any
  onPaymentUpdated: () => void
}

const calculateDueDate = (date: string, months: number): string => {
  if (!date) return ""
  const newDate = new Date(date)
  newDate.setMonth(newDate.getMonth() + months)
  return newDate.toISOString().split("T")[0]
}

export function EditPaymentDialog({ open, onOpenChange, payment, onPaymentUpdated }: EditPaymentDialogProps) {
  const [formData, setFormData] = useState({
    id: "",
    studentId: "",
    name: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
    modality: "",
    whatsapp: ""
  })

  useEffect(() => {
    if (payment) {
      const paymentDate = payment.fecha_de_pago ? new Date(payment.fecha_de_pago).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
      const dueDate = payment.fecha_de_vencimiento ? new Date(payment.fecha_de_vencimiento).toISOString().split("T")[0] : calculateDueDate(paymentDate, 1)

      setFormData({
        id: payment.id_estudiante,
        studentId: payment.id_estudiante || "",
        name: payment.nombre || "",
        amount: payment.monto?.toString() || "",
        date: paymentDate,
        dueDate: dueDate,
        modality: payment.modalidad || "",
        whatsapp: payment.whatsapp || ""
      })
    }
  }, [payment])

  useEffect(() => {
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, 1) }))
  }, [formData.date])

  useEffect(() => {
  
    if (open) {
      history.pushState(null, "", location.href)
      console.log(payment)
      const handlePopState = () => {
        onOpenChange(false)
      }

      window.addEventListener("popstate", handlePopState)

      return () => {
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [open, onOpenChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDueDateChange = (months: number) => {
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, months) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const paymentData = {
        ...formData,
        phone: formData.whatsapp,
        studentId: formData.studentId || payment?.id_estudiante || ""
      }

      console.log("Datos que se van a enviar:", paymentData);

      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/${formData.id}`,
        paymentData
      )

      if (response.status === 200 || response.status === 201) {
        onOpenChange(false)
        onPaymentUpdated()
      }
    } catch (error) {
      console.error("Error al actualizar el pago:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen md:h-auto max-w-full md:max-w-[700px] md:max-h-[90vh]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Pago</DialogTitle>
            <DialogDescription>Actualiza la información del pago. Todos los campos son obligatorios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Alumno</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                readOnly
                className="bg-gray-100"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Fecha de Pago</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                value={formData.dueDate}
                readOnly
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]"
                type="button"
                onClick={() => handleDueDateChange(1)}
              >
                Pagar 1 Mes
              </Button>
              <Button
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]"
                type="button"
                onClick={() => handleDueDateChange(3)}
              >
                Pagar 3 Meses
              </Button>
              <Button
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]"
                type="button"
                onClick={() => handleDueDateChange(6)}
              >
                Pagar 6 Meses
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modality">Modalidad</Label>
              <Select
                value={formData.modality}
                onValueChange={(value) => handleSelectChange("modality", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar modalidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}