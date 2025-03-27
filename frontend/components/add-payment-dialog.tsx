"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import axios from "axios"

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const calculateDueDate = (date: string, months: number): string => {
  if (!date) return ""
  const newDate = new Date(date)
  newDate.setMonth(newDate.getMonth() + months)
  return newDate.toISOString().split("T")[0]
}

export function AddPaymentDialog({ open, onOpenChange }: AddPaymentDialogProps) {
  const [formData, setFormData] = useState({
    studentId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: calculateDueDate(new Date().toISOString().split("T")[0], 1),
    modality: "",
    status: "Pagado",
    phone: ""
  })

  const [students, setStudents] = useState([])

  useEffect(() => {
    const getStudents = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getallstudents`);
        const studentsData = response.data;

        const students = studentsData.map(student => ({
          id:  String(student.id),
          name: student.nombre
        }));

        console.log("estudiantes", students);
        setStudents(students);
      } catch (error) {
        console.error("Error al obtener los nombres:", error);
      }
    };

    getStudents();
  }, []);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, dueDate: calculateDueDate(prev.date, 1) }))
  }, [formData.date])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Formulario enviado:", formData)
    onOpenChange(false)
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Pago</DialogTitle>
            <DialogDescription>Completa la información del pago. Todos los campos son obligatorios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="studentId">Alumno</Label>
              <Select value={formData.studentId} onValueChange={(value) => handleSelectChange("studentId", value)}>
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
              <Input id="amount" name="amount" type="number" value={formData.amount} onChange={handleChange} placeholder="0.00" required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Fecha de Pago</Label>
              <Input id="date" name="date" type="date" value={formData.date} onChange={handleChange} required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input id="dueDate" name="dueDate" type="date" value={formData.dueDate} readOnly />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]" type="button" onClick={() => handleDueDateChange(1)}>Pagar 1 Mes</Button>
              <Button className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]" type="button" onClick={() => handleDueDateChange(3)}>Pagar 3 Meses</Button>
              <Button className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]" type="button" onClick={() => handleDueDateChange(6)}>Pagar 6 Meses</Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modality">Modalidad</Label>
              <Select value={formData.modality} onValueChange={(value) => handleSelectChange("modality", value)}>
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

          <div className="grid gap-2">
              <Label htmlFor="phone">Whatsapp</Label>
              <Input id="phone" name="phone" type="number" value={formData.phone} onChange={handleChange} placeholder="0.00" required />
            </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
