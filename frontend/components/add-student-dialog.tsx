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

interface AddStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentAdded: () => void
}

export function AddStudentDialog({ open, onOpenChange, onStudentAdded }: AddStudentDialogProps) {
  const [formData, setFormData] = useState({
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
    lastTraining: "", 
    lastAntro: "",
  })

  const [files, setFiles] = useState([])
  const [searchTerm, setSearchTerm] = useState("")

  const filteredFiles = files.filter((file) =>
    file.nameFile.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
    e.preventDefault();

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/add-student`, formData);
      
      if (response.status === 200) {
        onStudentAdded();
        onOpenChange(false);
      } else {
        console.error("Error al agregar alumno:", response.data);
      }
    } catch (error) {
      console.error("Error en la solicitud:", error);
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/files`)
        setFiles(response.data)
        console.log(response.data)
      } catch (error) {
        console.error("Error fetching files:", error)
      }
    }
    fetchData()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full overflow-y-auto md:h-auto max-w-full sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Alumno</DialogTitle>
            <DialogDescription>
              Completa la información del nuevo alumno. Todos los campos son obligatorios.
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
              <Label htmlFor="modality">Modalidad</Label>
              <Select
                value={formData.modality}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, modality: value }))}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Seleccionar modalidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha de Nacimiento */}

            <div className="grid gap-2">
              <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
              <Input id="birthDate" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} required />
            </div>

            {/* WhatsApp */}

            <div className="grid gap-2">
              <Label htmlFor="whatsapp">Contacto WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+54 9 11 1234-5678" required />
            </div>

            {/* Plan de Entrenamiento */}

            <div className="grid gap-2">
              <Label>Plan de Entrenamiento</Label>
              <input
                type="text"
                placeholder="Buscar plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded sm:w-auto"
              />

              <Select name="planUrl" value={formData.planUrl} onValueChange={(value) => setFormData((prev) => ({ ...prev, planUrl: value }))} required>
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
                  { key: "wednesday", label: "Miér" },
                  { key: "thursday", label: "Jue" },
                  { key: "friday", label: "Vie" },
                  { key: "saturday", label: "Sáb" },
                  { key: "sunday", label: "Dom" },
                ].map(({ key, label }, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={formData.schedule[key]}
                      onCheckedChange={(checked) => handleScheduleChange(key, checked)}
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
          </div>

           {/* Ultimo entrenamiento */}

           <div className="grid gap-2">
              <Label htmlFor="lastTraining">Último Entrenamiento</Label>
              <Input id="lastTraining" name="lastTraining" type="date" value={formData.lastTraining} onChange={handleChange} required />
            </div>    

           {/* Ultimo antropometria */}

            <div className="grid gap-2 mt-3">
              <Label htmlFor="lastAntro">Última antropometria</Label>
              <Input id="lastAntro" name="lastAntro" type="date" value={formData.lastAntro} onChange={handleChange} required />
            </div>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white">
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
