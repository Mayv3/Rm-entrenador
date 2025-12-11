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
import { Loader2 } from "lucide-react"
import axios from "axios"

// Interfaces de TypeScript
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

const calculateDueDate = (date: string, months: number): string => {
  if (!date) return ""
  const newDate = new Date(date)
  newDate.setMonth(newDate.getMonth() + months)
  return newDate.toISOString().split("T")[0]
}

export function AddPaymentDialog({ open, onOpenChange, onPaymentUpdated }: AddPaymentDialogProps) {
  const [formData, setFormData] = useState({
    alumno_id: "",
    name: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
    modalidad: "",
  })

  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const getStudents = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getallstudents`)
        const studentsData = response.data

        const students: Student[] = studentsData.map((student: any) => ({
          id: String(student.id),
          name: student.nombre,
          whatsapp: student.telefono
        }));

        console.log(students)
        setStudents(students)
      } catch (error) {
        console.error("Error al obtener los nombres:", error)
      }
    }

    getStudents()
  }, [])

  useEffect(() => {
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, 1) }))
  }, [formData.date])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    if (name === "alumno_id") {
      console.log("Value seleccionado:", value, typeof value)
      console.log("Students disponibles:", students)
      const selectedStudent = students.find(student => String(student.id) === String(value))
      console.log("Student encontrado:", selectedStudent)
      setFormData((prev) => ({
        ...prev,
        alumno_id: value,
        name: selectedStudent ? selectedStudent.name : "",
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }


  const handleDueDateChange = (months: number) => {
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, months) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.alumno_id || !formData.modalidad || !formData.name) {
      alert("Todos los campos son obligatorios")
      return
    }

    setIsLoading(true)

    try {
      const selectedStudent = students.find(student => student.id === formData.alumno_id)
      const whatsapp = selectedStudent?.whatsapp || ""

      const paymentData = {
        alumno_id: formData.alumno_id,
        nombre: formData.name,
        monto: Number(formData.amount),
        fecha_de_pago: formData.date,
        fecha_de_vencimiento: formData.dueDate,
        modalidad: formData.modalidad,
        whatsapp: whatsapp
      };

      console.log(paymentData)

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/addPayment`,
        paymentData
      )

      if (response.status === 200 || response.status === 201) {
        onOpenChange(false)
        onPaymentUpdated()
        setFormData({
          alumno_id: "",
          name: "",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
          modalidad: ""
        })
      }
    } catch (error) {
      console.error("Error al registrar el pago:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      history.pushState(null, "", location.href)

      const handlePopState = () => {
        onOpenChange(false)
      }

      window.addEventListener("popstate", handlePopState)

      return () => {
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen md:h-auto max-w-full md:max-w-[700px] md:max-h-[90vh]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Pago</DialogTitle>
            <DialogDescription>Completa la información del pago. Todos los campos son obligatorios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="alumno_id">Alumno</Label>
              <Select value={formData.alumno_id} onValueChange={(value) => handleSelectChange("alumno_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="modalidad">Tipo de plan</Label>
              <Select
                value={formData.modalidad}
                onValueChange={(value) => handleSelectChange("modalidad", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico</SelectItem>
                  <SelectItem value="Estándar">Estándar</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>

            <div className="flex gap-2">
              <Button type="button" className="w-[50%]" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)] w-[50%]"
                disabled={isLoading || !formData.alumno_id || !formData.amount || !formData.modalidad}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>

          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
