"use client"

import type React from "react"
import axios from "axios";
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
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
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
  })

  const [files, setFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // Agregado estado para searchTerm

  const filteredFiles = files.filter(file =>
    file.nameFile.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    console.log("Nuevo alumno:", formData)
    onOpenChange(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:3001/files");
        setFiles(response.data);
        console.log(response.data)
      } catch (error) {
        console.error("Error fetching files:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Alumno</DialogTitle>
            <DialogDescription>
              Completa la información del nuevo alumno. Todos los campos son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Form Fields */}
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
              <Label>Plan de Entrenamiento</Label>
              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-2">
                  <Select value={formData.planType} onValueChange={(value) => handleSelectChange("planType", value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tipo de plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">Google Sheets</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Buscar plan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-2 p-2 border rounded"
                  />
                  <Select
                    name="planUrl"
                    value={formData.planUrl}
                    onValueChange={(value) => handleSelectChange("planUrl", value)}
                    required
                  >
                    <SelectTrigger>
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
              </div>
            </div>
            {/* Schedule and Time */}
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
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
