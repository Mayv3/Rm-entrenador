"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { queryKeys } from "@/lib/query-keys"
import { Search, Plus, Loader2, Dumbbell, Check, ChevronDown, ChevronUp } from "lucide-react"
import type { Ejercicio } from "@/types/planificaciones"

interface ExerciseLibrarySheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (ejercicio: Ejercicio) => void
  dayName?: string | null
}

export function ExerciseLibrarySheet({ open, onOpenChange, onSelect, dayName }: ExerciseLibrarySheetProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [newNombre, setNewNombre] = useState("")
  const [newGrupo, setNewGrupo] = useState("")
  const [newVideo, setNewVideo] = useState("")
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const { data: ejercicios = [], refetch } = useQuery<Ejercicio[]>({
    queryKey: queryKeys.ejercicios,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios`)
      return res.data
    },
  })

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  const filtered = ejercicios.filter((e) =>
    normalize(e.nombre).includes(normalize(search)) ||
    normalize(e.grupo_muscular ?? "").includes(normalize(search))
  )

  const grupos = Array.from(new Set(ejercicios.map((e) => e.grupo_muscular).filter(Boolean))) as string[]

  const toggleGroup = (grupo: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [grupo]: !prev[grupo] }))

  const handleSelect = (ej: Ejercicio) => {
    onSelect(ej)
    setLastAddedId(ej.id)
    setTimeout(() => setLastAddedId(null), 1200)
  }

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.ejercicios })
      setNewNombre("")
      setNewGrupo("")
      setNewVideo("")
      setShowCreateForm(false)
      handleSelect(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 sm:max-w-sm flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="text-base">Agregar ejercicio</SheetTitle>
          {dayName && (
            <p className="text-xs text-[var(--primary-color)] font-medium">
              Día: {dayName}
            </p>
          )}
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar..."
              className="pl-8 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus={open}
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin resultados</p>
          ) : search ? (
            <div className="px-3 space-y-0.5">
              {filtered.map((ej) => (
                <ExerciseButton key={ej.id} ej={ej} isAdded={lastAddedId === ej.id} onSelect={handleSelect} />
              ))}
            </div>
          ) : (
            grupos
              .filter((g) => filtered.some((e) => e.grupo_muscular === g))
              .map((grupo) => {
                const items = filtered.filter((e) => e.grupo_muscular === grupo)
                const isCollapsed = collapsedGroups[grupo]
                return (
                  <div key={grupo}>
                    <button
                      onClick={() => toggleGroup(grupo)}
                      className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>{grupo}</span>
                      <span className="flex items-center gap-1 normal-case font-normal">
                        {items.length}
                        {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="px-3 space-y-0.5 pb-1">
                        {items.map((ej) => (
                          <ExerciseButton key={ej.id} ej={ej} isAdded={lastAddedId === ej.id} onSelect={handleSelect} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
          )}

          {filtered.filter((e) => !e.grupo_muscular).length > 0 && !search && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sin categoría
              </p>
              <div className="px-3 space-y-0.5 pb-1">
                {filtered.filter((e) => !e.grupo_muscular).map((ej) => (
                  <ExerciseButton key={ej.id} ej={ej} isAdded={lastAddedId === ej.id} onSelect={handleSelect} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3 shrink-0">
          {!showCreateForm ? (
            <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4" />
              Crear ejercicio
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
                    autoFocus
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

function ExerciseButton({ ej, isAdded, onSelect }: { ej: Ejercicio; isAdded: boolean; onSelect: (e: Ejercicio) => void }) {
  return (
    <button
      onClick={() => onSelect(ej)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all group ${
        isAdded
          ? "bg-[var(--primary-color)]/10 text-[var(--primary-color)]"
          : "hover:bg-muted"
      }`}
    >
      <Dumbbell className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
      <span className="text-sm flex-1 leading-tight">{ej.nombre}</span>
      {isAdded
        ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--primary-color)]" />
        : <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--primary-color)] opacity-0 group-hover:opacity-100 transition-opacity" />
      }
    </button>
  )
}
