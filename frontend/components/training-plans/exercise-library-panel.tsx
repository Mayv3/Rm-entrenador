"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { queryKeys } from "@/lib/query-keys"
import { Search, Plus, Loader2, Dumbbell, ChevronDown, ChevronUp, X, Pencil, Trash2, Youtube } from "lucide-react"
import type { Ejercicio } from "@/types/planificaciones"

interface ExerciseLibraryPanelProps {
  onSelect: (ejercicio: Ejercicio) => void
  selectedDayName: string | null
}

export function ExerciseLibraryPanel({ onSelect, selectedDayName }: ExerciseLibraryPanelProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [newGrupo, setNewGrupo] = useState("")
  const [newVideo, setNewVideo] = useState("")
  const [creating, setCreating] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  // Edit state
  const [editingEj, setEditingEj] = useState<Ejercicio | null>(null)
  const [editNombre, setEditNombre] = useState("")
  const [editGrupo, setEditGrupo] = useState("")
  const [editVideo, setEditVideo] = useState("")
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deletingEj, setDeletingEj] = useState<Ejercicio | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: ejercicios = [] } = useQuery<Ejercicio[]>({
    queryKey: queryKeys.ejercicios,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`)
      return res.data
    },
  })

  const grupos = Array.from(
    new Set(ejercicios.map((e) => e.grupo_muscular ?? "Sin categoría"))
  ).sort()

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const filtered = ejercicios.filter(
    (e) =>
      normalize(e.nombre).includes(normalize(search)) ||
      normalize(e.grupo_muscular ?? "").includes(normalize(search))
  )

  const toggleGroup = (grupo: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [grupo]: !prev[grupo] }))

  const handleCreate = async () => {
    if (!newNombre.trim()) return
    setCreating(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`, {
        nombre: newNombre.trim(),
        grupo_muscular: newGrupo || null,
        video_url: newVideo.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.ejercicios })
      setNewNombre("")
      setNewGrupo("")
      setNewVideo("")
      setShowCreate(false)
      onSelect(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (ej: Ejercicio) => {
    setEditingEj(ej)
    setEditNombre(ej.nombre)
    setEditGrupo(ej.grupo_muscular ?? "")
    setEditVideo(ej.video_url ?? "")
  }

  const handleSaveEdit = async () => {
    if (!editingEj || !editNombre.trim()) return
    setSaving(true)
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios/${editingEj.id}`, {
        nombre: editNombre.trim(),
        grupo_muscular: editGrupo || null,
        video_url: editVideo.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.ejercicios })
      await queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
      // Invalida cualquier plan abierto (planificacionById) para reflejar el nuevo nombre en los días
      await queryClient.invalidateQueries({ queryKey: ["planificacion"] })
      setEditingEj(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEj) return
    setDeleting(true)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios/${deletingEj.id}`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.ejercicios })
      setDeletingEj(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col h-full border rounded-xl bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Ejercicios</p>
            {selectedDayName ? (
              <span className="text-[10px] bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-medium px-2 py-0.5 rounded-full truncate max-w-[120px]">
                → {selectedDayName}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Seleccioná un día</span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar..."
              className="pl-8 pr-7 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 min-h-0 px-2 py-2 space-y-1 scrollbar-slim">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sin resultados</p>
          ) : search ? (
            filtered.map((ej) => (
              <ExerciseItem key={ej.id} ejercicio={ej} disabled={!selectedDayName}
                onSelect={onSelect} onEdit={openEdit} onDelete={setDeletingEj} />
            ))
          ) : (
            grupos.map((grupo) => {
              const items = filtered.filter((e) => (e.grupo_muscular ?? "Sin categoría") === grupo)
              if (items.length === 0) return null
              const isCollapsed = collapsedGroups[grupo]
              return (
                <div key={grupo}>
                  <button
                    onClick={() => toggleGroup(grupo)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>{grupo}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-normal normal-case">{items.length}</span>
                      {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    </span>
                  </button>
                  {!isCollapsed &&
                    items.map((ej) => (
                      <ExerciseItem key={ej.id} ejercicio={ej} disabled={!selectedDayName}
                        onSelect={onSelect} onEdit={openEdit} onDelete={setDeletingEj} />
                    ))}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-3 shrink-0">
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="h-3 w-3" />
            Crear ejercicio
          </Button>
        </div>
      </div>

      {/* Sheet: crear */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="left" className="w-80 sm:w-96 flex flex-col gap-6">
          <SheetHeader>
            <SheetTitle>Nuevo ejercicio</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ej-nombre">Nombre *</Label>
              <Input id="ej-nombre" placeholder="Ej: Sentadilla trasera" value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ej-grupo">Grupo muscular</Label>
              <Select value={newGrupo} onValueChange={setNewGrupo}>
                <SelectTrigger id="ej-grupo"><SelectValue placeholder="Seleccionar grupo" /></SelectTrigger>
                <SelectContent>
                  {grupos.filter((g) => g !== "Sin categoría").map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ej-video">URL de video <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input id="ej-video" placeholder="https://youtube.com/..." value={newVideo}
                onChange={(e) => setNewVideo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-auto">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
              onClick={handleCreate} disabled={creating || !newNombre.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Crear y agregar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: editar */}
      <Sheet open={!!editingEj} onOpenChange={(open) => { if (!open) setEditingEj(null) }}>
        <SheetContent side="left" className="w-80 sm:w-96 flex flex-col gap-6">
          <SheetHeader>
            <SheetTitle>Editar ejercicio</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-nombre">Nombre *</Label>
              <Input id="edit-nombre" value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit() }} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-grupo">Grupo muscular</Label>
              <Select value={editGrupo} onValueChange={setEditGrupo}>
                <SelectTrigger id="edit-grupo"><SelectValue placeholder="Seleccionar grupo" /></SelectTrigger>
                <SelectContent>
                  {grupos.filter((g) => g !== "Sin categoría").map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-video">URL de video <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input id="edit-video" placeholder="https://youtube.com/..." value={editVideo}
                onChange={(e) => setEditVideo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-auto">
            <Button variant="outline" className="flex-1" onClick={() => setEditingEj(null)}>Cancelar</Button>
            <Button className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
              onClick={handleSaveEdit} disabled={saving || !editNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: confirmar eliminación */}
      <Dialog open={!!deletingEj} onOpenChange={(open) => { if (!open) setDeletingEj(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar ejercicio</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés eliminar <span className="font-medium text-foreground">{deletingEj?.nombre}</span>? Se eliminará de todos los días y planificaciones donde esté asignado.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletingEj(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExerciseItem({
  ejercicio, disabled, onSelect, onEdit, onDelete,
}: {
  ejercicio: Ejercicio
  disabled: boolean
  onSelect: (e: Ejercicio) => void
  onEdit: (e: Ejercicio) => void
  onDelete: (e: Ejercicio) => void
}) {
  return (
    <div className="group flex items-center gap-1 rounded-lg hover:bg-[var(--primary-color)]/10 transition-colors">
      <button
        onClick={() => onSelect(ejercicio)}
        title={disabled ? "Seleccioná un día primero" : undefined}
        className="flex items-center gap-2 px-2 py-2 text-left text-xs flex-1 min-w-0 group-hover:text-[var(--primary-color)]"
      >
        <Dumbbell className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-[var(--primary-color)]" />
        <span className="flex-1 leading-tight truncate">{ejercicio.nombre}</span>
        {ejercicio.video_url && (
          <Youtube className="h-3 w-3 shrink-0 text-red-500" />
        )}
      </button>
      <div className="flex items-center gap-0.5 pr-1 opacity-100">
        <button onClick={() => onEdit(ejercicio)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={() => onDelete(ejercicio)}
          className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
