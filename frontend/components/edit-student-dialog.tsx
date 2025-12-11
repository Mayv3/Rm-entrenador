"use client"

import type React from "react"
import axios from "axios"
import { useEffect, useState } from "react"
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

// Interfaces de TypeScript
interface File {
  nameFile: string;
  url: string;
}

interface Student {
  id: number;
  alumno_id: number;
  nombre: string;
  modalidad: string;
  fecha_de_nacimiento: string;
  telefono: string;
  plan: string;
  dias: string;
  fecha_de_inicio: string;
  ultima_antro: string;
}

interface EditStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student
  onStudentUpdated: () => void
}

export function EditStudentDialog({ open, onOpenChange, student, onStudentUpdated }: EditStudentDialogProps) {
  const [formData, setFormData] = useState({
    id: "",
    studentId: "",
    name: "",
    modality: "",
    birthDate: "",
    whatsapp: "",
    planUrl: "",
    planType: "google",
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
    startService: "",
    lastAntro: "",
  })

  const [files, setFiles] = useState<File[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  const filteredFiles = files.filter((file) =>
    file.nameFile.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    if (student) {
      const diasParts = student.dias.split(' - ');
      const hora = diasParts.length > 1 ? diasParts[1] : '';

      const formatDate = (dateString: string | null) => {
        if (!dateString) return "";

        // Caso DD/MM/YYYY
        if (dateString.includes("/")) {
          const parts = dateString.split("/");
          if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
        }

        return dateString;
      };

      setFormData({
        id: String(student.id),
        studentId: String(student.alumno_id),
        name: student.nombre || "",
        modality: student.modalidad || "",
        birthDate: formatDate(student.fecha_de_nacimiento) || "",
        whatsapp: student.telefono || "",
        planUrl: student.plan || "",
        planType: "google",
        schedule: {
          monday: student.dias?.includes("Lun") || false,
          tuesday: student.dias?.includes("Mar") || false,
          wednesday: student.dias?.includes("Mié") || false,
          thursday: student.dias?.includes("Jue") || false,
          friday: student.dias?.includes("Vie") || false,
          saturday: student.dias?.includes("Sáb") || false,
          sunday: student.dias?.includes("Dom") || false,
        },
        time: hora || "",
        startService: formatDate(student.fecha_de_inicio) || "",
        lastAntro: formatDate(student.ultima_antro) || "",
      });
    }
  }, [student]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/files`)
        setFiles(response.data)
      } catch (error) {
        console.error("Error fetching files:", error)
      }
    }
    fetchData()
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${student.id}`, formData)

      if (response.status === 200) {
        onStudentUpdated()
        onOpenChange(false)
      } else {
        console.error("Error al actualizar alumno:", response.data)
      }
    } catch (error) {
      console.error("Error en la solicitud:", error)
    }
  }

  // Agregamos el efecto para interceptar el evento "popstate" (botón atrás)
  useEffect(() => {
    if (open) {
      // Inserta un estado en el historial para que el botón "atrás" dispare el evento
      history.pushState(null, "", location.href)

      const handlePopState = () => {
        onOpenChange(false)
      }

      window.addEventListener("popstate", handlePopState)

      // Limpieza del listener cuando se cierra el modal
      return () => {
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen md:h-auto max-w-full md:max-w-[900px] md:max-h-[90vh] overflow-y-scroll">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Alumno</DialogTitle>
            <DialogDescription>
              Modifica la información del alumno. Todos los campos son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nombre */}
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>

            {/* Modalidad */}
            <div className="grid gap-2">
              <Label htmlFor="modality">Tipo de plan</Label>
              <Select
                value={formData.modality}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, modality: value }))}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Seleccionar tipo de plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico</SelectItem>
                  <SelectItem value="Estándar">Estándar</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha de Nacimiento */}
            <div className="grid gap-2">
              <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
              <Input id="birthDate" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} />
            </div>

            {/* WhatsApp */}
            <div className="grid gap-2">
              <Label htmlFor="whatsapp">Contacto WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+54 9 11 1234-5678" required />
            </div>

            {/* Plan de Entrenamiento */}
            <div className="grid gap-2">
              <Label>Plan de Entrenamiento</Label>
              <Select
                name="planUrl"
                value={formData.planUrl}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, planUrl: value }))}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {filteredFiles.map((file, index) => (
                    <SelectItem key={index} value={file.url}>
                      {file.nameFile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Días de Entrenamiento */}
            <div className="grid gap-2">
              <Label>Días de Entrenamiento</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: "monday", label: "Lun" },
                  { key: "tuesday", label: "Mar" },
                  { key: "wednesday", label: "Mié" },
                  { key: "thursday", label: "Jue" },
                  { key: "friday", label: "Vie" },
                  { key: "saturday", label: "Sáb" },
                  { key: "sunday", label: "Dom" },
                ].map(({ key, label }, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={formData.schedule[key as keyof typeof formData.schedule]}
                      onCheckedChange={(checked) => handleScheduleChange(key as keyof typeof formData.schedule, checked as boolean)}
                    />
                    <Label htmlFor={key}>{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Horario */}
            <div className="grid gap-2">
              <Label htmlFor="time">Horario</Label>
              <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} required />
            </div>

            {/* Fecha de inicio */}
            <div className="grid gap-2">
              <Label htmlFor="startService">Fecha de inicio</Label>
              <Input id="startService" name="startService" type="date" value={formData.startService} onChange={handleChange} />
            </div>

            {/* Última antropometría */}
            <div className="grid gap-2 mt-3">
              <Label htmlFor="lastAntro">Última antropometría</Label>
              <Input id="lastAntro" name="lastAntro" type="date" value={formData.lastAntro} onChange={handleChange} />
            </div>
          </div>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
