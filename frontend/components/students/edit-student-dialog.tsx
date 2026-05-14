"use client"

import type React from "react"
import axios from "axios"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Pencil } from "lucide-react"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePlanes } from "@/hooks/use-planes"

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
  email: string;
  plan: string;
  dias: string;
  fecha_de_inicio: string;
  ultima_antro: string;
  sexo: string;
}

interface EditStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student
  onStudentUpdated: () => void
}

export function EditStudentDialog({ open, onOpenChange, student, onStudentUpdated }: EditStudentDialogProps) {
  const queryClient = useQueryClient()
  const { data: planes = [] } = usePlanes()
  const [formData, setFormData] = useState({
    id: "",
    studentId: "",
    name: "",
    modality: "",
    birthDate: "",
    whatsapp: "",
    email: "",
    planUrl: "",
    planType: "google",
    daysCount: 0,
    time: "",
    startService: "",
    lastAntro: "",
    sexo: "",
  })
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    if (dateString.includes("/")) {
      const parts = dateString.split("/")
      if (parts.length === 3) {
        const [day, month, year] = parts
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }
    }
    return dateString
  }

  useEffect(() => {
    if (student) {
      const diasParts = (student.dias || "").split(' - ')
      const hora = diasParts.length > 1 ? diasParts[1] : ''
      const diasStr = diasParts[0] || ""
      const countMatch = diasStr.match(/^(\d+)\s*días?/)
      const daysCount = countMatch
        ? parseInt(countMatch[1])
        : diasStr.split(',').filter((d: string) => d.trim()).length
      setFormData({
        id: String(student.id),
        studentId: String(student.alumno_id),
        name: student.nombre || "",
        modality: student.modalidad || "",
        birthDate: formatDate(student.fecha_de_nacimiento),
        whatsapp: student.telefono || "",
        email: student.email || "",
        planUrl: student.plan || "",
        planType: "google",
        daysCount,
        time: hora,
        startService: formatDate(student.fecha_de_inicio),
        lastAntro: formatDate(student.ultima_antro),
        sexo: student.sexo || "",
      })
    }
  }, [student])

  useEffect(() => {
    axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/files`)
      .then((r) => setFiles(r.data))
      .catch((e) => console.error("Error fetching files:", e))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${student.id}`, formData)
      if (response.status === 200) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.students })
        onStudentUpdated()
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Error en la solicitud:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useDialogBackButton(open, onOpenChange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[560px] p-0 gap-0 overflow-x-hidden h-[80vh] max-h-[70vh] flex flex-col rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <Pencil className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Editar Alumno</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Modificá la información del alumno</p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-5 py-4 grid gap-4">

            {/* Nombre + Tipo de plan */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} className="h-9" required />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de plan</Label>
                <Select value={formData.modality} onValueChange={(v) => setFormData((p) => ({ ...p, modality: v }))}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {planes.filter((p) => p.parent_id == null).map((p) => (
                      <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* WhatsApp + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="whatsapp" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WhatsApp</Label>
                <Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+54 9 11..." className="h-9" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="correo@..." className="h-9" />
              </div>
            </div>

            {/* Plan de entrenamiento — ancho completo */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan de entrenamiento</Label>
              <Select value={formData.planUrl} onValueChange={(v) => setFormData((p) => ({ ...p, planUrl: v }))} required>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Seleccioná un plan" />
                </SelectTrigger>
                <SelectContent>
                  {files.map((file, i) => (
                    <SelectItem key={i} value={file.url}>{file.nameFile}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Días de entrenamiento */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Días de entrenamiento {formData.daysCount > 0 && <span className="text-[var(--primary-color)]">— {formData.daysCount} {formData.daysCount === 1 ? "día" : "días"}</span>}
              </Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, daysCount: p.daysCount === n ? 0 : n }))}
                    className={`flex-1 h-9 rounded-md border transition-colors cursor-pointer select-none ${
                      n <= formData.daysCount
                        ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                        : "bg-muted border-border"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Horario + Inicio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="time" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Horario</Label>
                <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} className="h-9" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="startService" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de inicio</Label>
                <Input id="startService" name="startService" type="date" value={formData.startService} onChange={handleChange} className="h-9 w-full" />
              </div>
            </div>

            {/* Nacimiento + Sexo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="birthDate" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nacimiento</Label>
                <Input id="birthDate" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} className="h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sexo</Label>
                <Select value={formData.sexo} onValueChange={(v) => setFormData((p) => ({ ...p, sexo: v }))}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Antropometría */}
            <div className="grid gap-1.5">
              <Label htmlFor="lastAntro" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Antropometría</Label>
              <Input id="lastAntro" name="lastAntro" type="date" value={formData.lastAntro} onChange={handleChange} className="h-9" />
            </div>

          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t bg-muted/40 mt-auto flex flex-row gap-3">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
