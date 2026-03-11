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
import { Loader2, UserPlus } from "lucide-react"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePlanes } from "@/hooks/use-planes"

interface File {
  nameFile: string;
  url: string;
}

interface AddStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentAdded: () => void
}

const DAYS = [
  { key: "monday",    label: "Lun" },
  { key: "tuesday",   label: "Mar" },
  { key: "wednesday", label: "Mié" },
  { key: "thursday",  label: "Jue" },
  { key: "friday",    label: "Vie" },
  { key: "saturday",  label: "Sáb" },
  { key: "sunday",    label: "Dom" },
]

const EMPTY_FORM = {
  name: "",
  modality: "",
  birthDate: "",
  whatsapp: "",
  email: "",
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
}

export function AddStudentDialog({ open, onOpenChange, onStudentAdded }: AddStudentDialogProps) {
  const queryClient = useQueryClient()
  const { data: planes = [] } = usePlanes()
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/files`)
      .then((r) => setFiles(r.data))
      .catch((e) => console.error("Error fetching files:", e))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleScheduleChange = (day: keyof typeof formData.schedule, checked: boolean) => {
    setFormData((prev) => ({ ...prev, schedule: { ...prev.schedule, [day]: checked } }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/add-student`, formData)
      if (response.status === 200) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.students })
        onStudentAdded()
        onOpenChange(false)
        setFormData(EMPTY_FORM)
      } else {
        console.error("Error al agregar alumno:", response.data)
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
            <UserPlus className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Agregar Alumno</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Completá la información del nuevo alumno</p>
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
                    {planes.map((p) => (
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
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {files.map((file, i) => (
                    <SelectItem key={i} value={file.url}>{file.nameFile}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Días de entrenamiento — ancho completo */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Días de entrenamiento</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {DAYS.map(({ key, label }) => {
                  const checked = formData.schedule[key as keyof typeof formData.schedule]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleScheduleChange(key as keyof typeof formData.schedule, !checked)}
                      className={`w-full py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer select-none ${
                        checked
                          ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                          : "bg-background text-muted-foreground border-border hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Horario + Fecha de inicio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="time" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Horario</Label>
                <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} className="h-9" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="startService" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de inicio</Label>
                <Input id="startService" name="startService" type="date" value={formData.startService} onChange={handleChange} className="h-9" required />
              </div>
            </div>

            {/* Última antropometría — ancho completo */}
            <div className="grid gap-1.5">
              <Label htmlFor="lastAntro" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Última antropometría</Label>
              <Input id="lastAntro" name="lastAntro" type="date" value={formData.lastAntro} onChange={handleChange} className="h-9" />
            </div>

          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t bg-muted/40 mt-auto flex flex-row gap-3">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
              disabled={isLoading || !formData.name || !formData.modality || !formData.whatsapp || !formData.planUrl || !formData.time || !formData.startService}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar alumno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
