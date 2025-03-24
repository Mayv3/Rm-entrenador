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
import { Checkbox } from "@/components/ui/checkbox"

interface Student {
  id: string
  name: string
  modality: string
  birthDate: string
  whatsapp: string
  schedule: string
  lastTraining: string
  attendance: string
  planUrl: string
}

interface EditStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student
}

export function EditStudentDialog({ open, onOpenChange, student }: EditStudentDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    modality: "",
    birthDate: "",
    whatsapp: "",
    planUrl: "",
    schedule: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
    time: "",
  })

  // Cargar los datos del estudiante cuando se abre el modal
  useEffect(() => {
    if (open && student) {
      // Parsear el horario para marcar los días correctos
      const scheduleDays = {
        monday: student.schedule.includes("Lun"),
        tuesday: student.schedule.includes("Mar"),
        wednesday: student.schedule.includes("Mié") || student.schedule.includes("Mie"),
        thursday: student.schedule.includes("Jue"),
        friday: student.schedule.includes("Vie"),
        saturday: student.schedule.includes("Sáb") || student.schedule.includes("Sab"),
        sunday: student.schedule.includes("Dom"),
      }

      // Extraer la hora del horario (asumiendo formato "Lun, Mie, Vie - 18:00")
      const timeMatch = student.schedule.match(/(\d{1,2}:\d{2})/)
      const time = timeMatch ? timeMatch[1] : ""

      setFormData({
        name: student.name,
        modality: student.modality,
        birthDate: student.birthDate,
        whatsapp: student.whatsapp,
        planUrl: student.planUrl,
        schedule: scheduleDays,
        time: time,
      })
    }
  }, [open, student])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleScheduleChange = (day: keyof typeof formData.schedule, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: checked,
      },
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aquí iría la lógica para actualizar el estudiante en la base de datos
    console.log("Estudiante actualizado:", { id: student.id, ...formData })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full overflow-y-auto md:h-auto max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Alumno</DialogTitle>
            <DialogDescription>
              Modifica la información del alumno. Todos los campos son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
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
            <div className="grid gap-2">
              <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp">Contacto WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                placeholder="+54 9 11 1234-5678"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="planUrl">URL del Plan de Entrenamiento</Label>
              <Input
                id="planUrl"
                name="planUrl"
                value={formData.planUrl}
                onChange={handleChange}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Días de Entrenamiento</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="monday"
                    checked={formData.schedule.monday}
                    onCheckedChange={(checked) => handleScheduleChange("monday", checked as boolean)}
                  />
                  <Label htmlFor="monday">Lun</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tuesday"
                    checked={formData.schedule.tuesday}
                    onCheckedChange={(checked) => handleScheduleChange("tuesday", checked as boolean)}
                  />
                  <Label htmlFor="tuesday">Mar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wednesday"
                    checked={formData.schedule.wednesday}
                    onCheckedChange={(checked) => handleScheduleChange("wednesday", checked as boolean)}
                  />
                  <Label htmlFor="wednesday">Mié</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="thursday"
                    checked={formData.schedule.thursday}
                    onCheckedChange={(checked) => handleScheduleChange("thursday", checked as boolean)}
                  />
                  <Label htmlFor="thursday">Jue</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="friday"
                    checked={formData.schedule.friday}
                    onCheckedChange={(checked) => handleScheduleChange("friday", checked as boolean)}
                  />
                  <Label htmlFor="friday">Vie</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="saturday"
                    checked={formData.schedule.saturday}
                    onCheckedChange={(checked) => handleScheduleChange("saturday", checked as boolean)}
                  />
                  <Label htmlFor="saturday">Sáb</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sunday"
                    checked={formData.schedule.sunday}
                    onCheckedChange={(checked) => handleScheduleChange("sunday", checked as boolean)}
                  />
                  <Label htmlFor="sunday">Dom</Label>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Horario</Label>
              <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white">Guardar Cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

