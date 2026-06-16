"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { queryKeys } from "@/lib/query-keys"
import { TipoEjercicioSelect } from "./tipo-ejercicio-select"
import { Search, Plus, Loader2, Pencil, Trash2, Youtube, Check, X, Dumbbell } from "lucide-react"
import type { Ejercicio } from "@/types/planificaciones"

interface ExerciseListDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  planId: number
}

const emptyForm = { nombre: "", grupo_muscular: "", video_url: "" }

export function ExerciseListDialog({ open, onOpenChange, planId }: ExerciseListDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Ejercicio | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const { data: ejercicios = [], isLoading } = useQuery<Ejercicio[]>({
    queryKey: queryKeys.ejercicios,
    queryFn: async () => (await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`)).data,
    enabled: open,
  })

  // Editar el nombre de un ejercicio se refleja en todos los planes → invalidar también el plan abierto.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ejercicios })
    queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
  }

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  const filtered = [...ejercicios]
    .filter(
      (e) =>
        normalize(e.nombre).includes(normalize(search)) ||
        normalize(e.grupo_muscular ?? "").includes(normalize(search))
    )
    .sort(
      (a, b) =>
        (a.grupo_muscular ?? "zzz").localeCompare(b.grupo_muscular ?? "zzz") ||
        a.nombre.localeCompare(b.nombre)
    )

  const startEdit = (ej: Ejercicio) => {
    setEditingId(ej.id)
    setForm({ nombre: ej.nombre, grupo_muscular: ej.grupo_muscular ?? "", video_url: ej.video_url ?? "" })
    setErrorMsg("")
  }

  const saveEdit = async (id: number) => {
    if (!form.nombre.trim()) return
    setSavingId(id)
    setErrorMsg("")
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios/${id}`, {
        nombre: form.nombre.trim(),
        grupo_muscular: form.grupo_muscular.trim() || null,
        video_url: form.video_url.trim() || null,
      })
      invalidate()
      setEditingId(null)
    } catch (err) {
      console.error(err)
      setErrorMsg("No se pudo guardar el ejercicio.")
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async () => {
    if (!createForm.nombre.trim()) return
    setCreating(true)
    setErrorMsg("")
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`, {
        nombre: createForm.nombre.trim(),
        grupo_muscular: createForm.grupo_muscular.trim() || null,
        video_url: createForm.video_url.trim() || null,
      })
      invalidate()
      setCreateForm(emptyForm)
      setShowCreate(false)
    } catch (err) {
      console.error(err)
      setErrorMsg("No se pudo crear el ejercicio.")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    setErrorMsg("")
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios/${confirmDelete.id}`)
      invalidate()
      setConfirmDelete(null)
    } catch (err) {
      console.error(err)
      setErrorMsg("No se pudo eliminar (puede estar en uso en un plan).")
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg flex flex-col p-0 max-h-[calc(100dvh-5rem)]">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-[var(--primary-color)]" />
              Lista de ejercicios
              <span className="text-xs font-normal text-muted-foreground">({ejercicios.length})</span>
            </DialogTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar ejercicio o grupo..."
                className="pl-8 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </DialogHeader>

          {errorMsg && (
            <div className="mx-5 mt-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-2 min-h-[200px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin resultados</p>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((ej) =>
                  editingId === ej.id ? (
                    <div key={ej.id} className="rounded-lg border border-[var(--primary-color)]/40 bg-muted/40 p-3 space-y-2">
                      <div>
                        <Label className="text-[11px]">Nombre *</Label>
                        <Input
                          value={form.nombre}
                          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Tipo de ejercicio</Label>
                        <TipoEjercicioSelect
                          size="sm"
                          value={form.grupo_muscular}
                          onChange={(v) => setForm((f) => ({ ...f, grupo_muscular: v }))}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Video URL</Label>
                        <Input
                          value={form.video_url}
                          onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                          className="h-8 text-sm"
                          placeholder="https://..."
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                          onClick={() => saveEdit(ej.id)}
                          disabled={savingId === ej.id || !form.nombre.trim()}
                        >
                          {savingId === ej.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={ej.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted">
                      <Dumbbell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{ej.nombre}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{ej.grupo_muscular || "Sin grupo"}</p>
                      </div>
                      {ej.video_url && (
                        <a
                          href={ej.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-500 hover:text-red-600 shrink-0"
                          title="Ver video"
                        >
                          <Youtube className="h-4 w-4" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(ej)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(ej)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3 shrink-0">
            {!showCreate ? (
              <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => { setShowCreate(true); setErrorMsg("") }}>
                <Plus className="h-4 w-4" /> Crear ejercicio
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Nuevo ejercicio</p>
                <Input
                  placeholder="Nombre *"
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm((f) => ({ ...f, nombre: e.target.value }))}
                  autoFocus
                />
                <div>
                  <Label className="text-[11px]">Tipo de ejercicio</Label>
                  <TipoEjercicioSelect
                    value={createForm.grupo_muscular}
                    onChange={(v) => setCreateForm((f) => ({ ...f, grupo_muscular: v }))}
                  />
                </div>
                <Input
                  placeholder="Video URL"
                  value={createForm.video_url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, video_url: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
                  <Button
                    className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                    onClick={handleCreate}
                    disabled={creating || !createForm.nombre.trim()}
                  >
                    {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Crear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar ejercicio</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">{confirmDelete?.nombre}</span> de la librería? Si está usado en algún plan, no se podrá borrar.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
