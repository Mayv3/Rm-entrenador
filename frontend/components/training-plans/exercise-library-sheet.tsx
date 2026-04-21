"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { queryKeys } from "@/lib/query-keys"
import { Search, Plus, Loader2, Dumbbell } from "lucide-react"
import type { Ejercicio } from "@/types/planificaciones"

interface ExerciseLibrarySheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (ejercicio: Ejercicio) => void
}

export function ExerciseLibrarySheet({ open, onOpenChange, onSelect }: ExerciseLibrarySheetProps) {
  const [search, setSearch] = useState("")
  const [newNombre, setNewNombre] = useState("")
  const [newGrupo, setNewGrupo] = useState("")
  const [newVideo, setNewVideo] = useState("")
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data: ejercicios = [], refetch } = useQuery<Ejercicio[]>({
    queryKey: queryKeys.ejercicios,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`)
      return res.data
    },
  })

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const filtered = ejercicios.filter((e) =>
    normalize(e.nombre).includes(normalize(search)) ||
    normalize(e.grupo_muscular ?? "").includes(normalize(search))
  )

  const grupos = Array.from(new Set(ejercicios.map((e) => e.grupo_muscular).filter(Boolean))) as string[]

  const handleCreate = async () => {
    if (!newNombre.trim()) return
    setCreating(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`, {
        nombre: newNombre.trim(),
        grupo_muscular: newGrupo.trim() || null,
        video_url: newVideo.trim() || null,
      })
      await refetch()
      setNewNombre("")
      setNewGrupo("")
      setNewVideo("")
      setShowCreateForm(false)
      onSelect(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle>Librería de ejercicios</SheetTitle>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar ejercicio o grupo muscular..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No se encontraron ejercicios</p>
          ) : (
            <>
              {grupos
                .filter((g) => filtered.some((e) => e.grupo_muscular === g))
                .map((grupo) => (
                  <div key={grupo} className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">
                      {grupo}
                    </p>
                    {filtered
                      .filter((e) => e.grupo_muscular === grupo)
                      .map((ej) => (
                        <button
                          key={ej.id}
                          onClick={() => { onSelect(ej); onOpenChange(false) }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted transition-colors group"
                        >
                          <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1">{ej.nombre}</span>
                          <Plus className="h-4 w-4 text-[var(--primary-color)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                  </div>
                ))}

              {filtered.filter((e) => !e.grupo_muscular).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">
                    Sin categoría
                  </p>
                  {filtered
                    .filter((e) => !e.grupo_muscular)
                    .map((ej) => (
                      <button
                        key={ej.id}
                        onClick={() => { onSelect(ej); onOpenChange(false) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted transition-colors group"
                      >
                        <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1">{ej.nombre}</span>
                        <Plus className="h-4 w-4 text-[var(--primary-color)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t px-5 py-4">
          {!showCreateForm ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4" />
              Crear ejercicio personalizado
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nuevo ejercicio</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <Input
                    placeholder="ej: Press banca inclinado"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Grupo muscular</Label>
                  <Input
                    placeholder="ej: Empuje"
                    value={newGrupo}
                    onChange={(e) => setNewGrupo(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">URL de video (opcional)</Label>
                  <Input
                    placeholder="https://youtube.com/..."
                    value={newVideo}
                    onChange={(e) => setNewVideo(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                  onClick={handleCreate}
                  disabled={creating || !newNombre.trim()}
                >
                  {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Crear y agregar
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
