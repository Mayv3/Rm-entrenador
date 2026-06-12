"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/query-keys"
import { Plus, Loader2, Pencil, Trash2, Check, X, Tag } from "lucide-react"
import type { TipoEjercicio, Ejercicio } from "@/types/planificaciones"

const B = process.env.NEXT_PUBLIC_URL_BACKEND

interface TipoEjercicioManagerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function TipoEjercicioManager({ open, onOpenChange }: TipoEjercicioManagerProps) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TipoEjercicio | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [nuevo, setNuevo] = useState("")
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const { data: tipos = [], isLoading } = useQuery<TipoEjercicio[]>({
    queryKey: queryKeys.tiposEjercicio,
    queryFn: async () => (await axios.get(`${B}/tipos-ejercicio`)).data,
    enabled: open,
  })
  const { data: ejercicios = [] } = useQuery<Ejercicio[]>({
    queryKey: queryKeys.ejercicios,
    queryFn: async () => (await axios.get(`${B}/ejercicios`)).data,
    enabled: open,
  })

  const countFor = (nombre: string) => ejercicios.filter((e) => e.grupo_muscular === nombre).length

  // Renombrar/eliminar un tipo propaga a ejercicios.grupo_muscular y a los planes que los anidan.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tiposEjercicio })
    queryClient.invalidateQueries({ queryKey: queryKeys.ejercicios })
    queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
    queryClient.invalidateQueries({ queryKey: ["planificacion"] })
  }

  const startEdit = (t: TipoEjercicio) => {
    setEditingId(t.id)
    setEditName(t.nombre)
    setErrorMsg("")
  }

  const saveEdit = async (id: number) => {
    const nombre = editName.trim()
    if (!nombre) return
    setBusyId(id)
    setErrorMsg("")
    try {
      await axios.put(`${B}/tipos-ejercicio/${id}`, { nombre })
      invalidateAll()
      setEditingId(null)
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null
      setErrorMsg(msg ?? "No se pudo guardar el tipo.")
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async () => {
    const nombre = nuevo.trim()
    if (!nombre) return
    setCreating(true)
    setErrorMsg("")
    try {
      await axios.post(`${B}/tipos-ejercicio`, { nombre })
      invalidateAll()
      setNuevo("")
    } catch {
      setErrorMsg("No se pudo crear el tipo.")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    setErrorMsg("")
    try {
      await axios.delete(`${B}/tipos-ejercicio/${confirmDelete.id}`)
      invalidateAll()
      setConfirmDelete(null)
    } catch {
      setErrorMsg("No se pudo eliminar el tipo.")
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md flex flex-col p-0 max-h-[85vh]">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--primary-color)]" />
              Tipos de ejercicio
              <span className="text-xs font-normal text-muted-foreground">({tipos.length})</span>
            </DialogTitle>
          </DialogHeader>

          {errorMsg && (
            <div className="mx-5 mt-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-2 min-h-[160px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tipos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin tipos todavía</p>
            ) : (
              <div className="space-y-0.5">
                {tipos.map((t) =>
                  editingId === t.id ? (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(t.id) }
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        className="h-8 w-8 shrink-0 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                        onClick={() => saveEdit(t.id)}
                        disabled={busyId === t.id || !editName.trim()}
                        title="Guardar"
                      >
                        {busyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingId(null)} title="Cancelar">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0 text-sm font-medium truncate">{t.nombre}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{countFor(t.nombre)} ej.</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(t)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => { setConfirmDelete(t); setErrorMsg("") }}
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

          <div className="border-t px-4 py-3 shrink-0 flex gap-2">
            <Input
              placeholder="Nuevo tipo (ej: EMPUJE)"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate() } }}
            />
            <Button
              className="shrink-0 gap-1.5 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
              onClick={handleCreate}
              disabled={creating || !nuevo.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar tipo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el tipo <span className="font-medium text-foreground">{confirmDelete?.nombre}</span>?
            {confirmDelete && countFor(confirmDelete.nombre) > 0 && (
              <>
                {" "}
                <span className="font-medium text-foreground">{countFor(confirmDelete.nombre)}</span> ejercicio(s) quedarán sin tipo.
              </>
            )}
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
