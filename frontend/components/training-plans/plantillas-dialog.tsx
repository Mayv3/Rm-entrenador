"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, Trash2, UserPlus, FileText, Plus, Pencil, Layers, Calendar } from "lucide-react"
import { toast } from "sonner"

interface Plantilla {
  id: number
  nombre: string
  descripcion: string | null
  semanas: number
  workspace_plan_id: number | null
  created_at: string
}

interface Student { id: number; nombre: string }

interface PlantillasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Student[]
  onAsignada?: (planId: number) => void
  onEditar?: (workspacePlanId: number, plantillaId: number) => void
}

export function PlantillasDialog({ open, onOpenChange, students, onAsignada, onEditar }: PlantillasDialogProps) {
  const queryClient = useQueryClient()
  const [asignando, setAsignando] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [popoverPlantillaId, setPopoverPlantillaId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Plantilla | null>(null)

  const { data: plantillas = [], isLoading } = useQuery<Plantilla[]>({
    queryKey: queryKeys.plantillas,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/plantillas`)
      return res.data
    },
    enabled: open,
  })

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/plantillas/${confirmDelete.id}`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.plantillas })
      setConfirmDelete(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async () => {
    if (!newNombre.trim()) return
    setCreating(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/plantillas`, {
        nombre: newNombre.trim(),
        descripcion: newDesc.trim() || null,
        mode: "workspace",
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.plantillas })
      setNewOpen(false)
      setNewNombre("")
      setNewDesc("")
      onOpenChange(false)
      if (res.data?.workspace_plan_id) onEditar?.(res.data.workspace_plan_id, res.data.id)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = async (p: Plantilla) => {
    setEditingId(p.id)
    try {
      let workspaceId = p.workspace_plan_id
      if (!workspaceId) {
        const res = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/plantillas/${p.id}/hidratar`)
        workspaceId = res.data.workspace_plan_id
        await queryClient.invalidateQueries({ queryKey: queryKeys.plantillas })
      }
      if (workspaceId) {
        onOpenChange(false)
        onEditar?.(workspaceId, p.id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setEditingId(null)
    }
  }

  const handleAsignar = async (plantilla: Plantilla, alumnoId: number) => {
    setAsignando(plantilla.id)
    setPopoverPlantillaId(null)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/plantillas/${plantilla.id}/asignar`,
        { alumno_id: alumnoId }
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
      onOpenChange(false)
      const planId = res.data.planificacion_id ?? res.data.id
      if (res.data.appended) {
        toast.success("Hoja agregada al plan existente del alumno")
      } else {
        toast.success("Plan creado y plantilla asignada")
      }
      onAsignada?.(planId)
    } catch (err) {
      console.error(err)
      toast.error("No se pudo asignar la plantilla")
    } finally {
      setAsignando(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
          {/* Header con gradiente */}
          <div className="relative px-6 sm:px-8 py-5 border-b bg-gradient-to-br from-[var(--primary-color)]/8 via-background to-background overflow-hidden">
            <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[var(--primary-color)]/10 blur-3xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-[var(--primary-color)]/15 border border-[var(--primary-color)]/25 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-[var(--primary-color)]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-tight">Plantillas</h2>
                  <p className="text-xs text-muted-foreground">
                    {plantillas.length} {plantillas.length === 1 ? "plantilla" : "plantillas"} disponibles
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setNewOpen(true)}
                className="gap-1.5 h-9 mr-4 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 sm:px-8 py-5 max-h-[65vh] overflow-y-auto">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : plantillas.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">Sin plantillas todavía</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Creá una desde cero o guardá una planificación existente como plantilla reutilizable.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setNewOpen(true)}
                  className="gap-1.5 mt-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear plantilla
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border divide-y overflow-hidden">
                {plantillas.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleEdit(p)}
                    className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="shrink-0 h-7 w-7 rounded-lg bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-[var(--primary-color)] transition-colors">
                          {p.nombre}
                        </p>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {p.semanas}s
                        </span>
                      </div>
                      {p.descripcion && (
                        <p className="text-[11px] text-muted-foreground truncate">{p.descripcion}</p>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Popover
                        open={popoverPlantillaId === p.id}
                        onOpenChange={(o) => setPopoverPlantillaId(o ? p.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-[var(--primary-color)]/10 hover:text-[var(--primary-color)]"
                            disabled={asignando === p.id}
                            title="Asignar a alumno"
                          >
                            {asignando === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-64 p-0"
                          align="end"
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="p-2 border-b">
                            <input
                              type="text"
                              placeholder="Buscar alumno..."
                              className="w-full h-8 px-2 text-sm bg-transparent outline-none"
                              onChange={(e) => {
                                const q = e.target.value.toLowerCase()
                                const items = e.currentTarget.parentElement?.parentElement?.querySelectorAll<HTMLElement>("[data-student-item]")
                                items?.forEach((el) => {
                                  const match = el.dataset.studentName?.toLowerCase().includes(q)
                                  el.style.display = match ? "" : "none"
                                })
                              }}
                            />
                          </div>
                          <div className="max-h-[260px] overflow-y-auto overscroll-contain py-1">
                            {students.length === 0 ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">Sin alumnos</div>
                            ) : students.map((s) => (
                              <button
                                key={s.id}
                                data-student-item
                                data-student-name={s.nombre}
                                onClick={() => handleAsignar(p, s.id)}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                              >
                                {s.nombre}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDelete(p)}
                        disabled={deletingId === p.id}
                        title="Eliminar"
                      >
                        {deletingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                      {editingId === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin mx-1.5 text-[var(--primary-color)]" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>

      {/* Sub-dialog: nueva plantilla */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
          <div className="relative px-6 py-5 border-b bg-gradient-to-br from-[var(--primary-color)]/8 via-background to-background">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--primary-color)]/15 border border-[var(--primary-color)]/25 flex items-center justify-center">
                <Plus className="h-5 w-5 text-[var(--primary-color)]" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-tight">Nueva plantilla</h2>
                <p className="text-xs text-muted-foreground">Empezás vacía, editás después</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre *</Label>
              <Input
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej: Hipertrofia 6 semanas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descripción</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!newNombre.trim() || creating}
              className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear y editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <h2 className="text-base font-semibold">Eliminar plantilla</h2>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">{confirmDelete?.nombre}</span>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="flex-row gap-2 sm:gap-2 mt-2">
            <Button variant="outline" className="w-1/2" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="w-1/2"
              onClick={handleDelete}
              disabled={deletingId === confirmDelete?.id}
            >
              {deletingId === confirmDelete?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
