"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Save, ChevronDown, ChevronUp, X, Search } from "lucide-react"
import type { MovilidadItem } from "@/types/planificaciones"

interface EjercicioMovilidad {
  id: number
  nombre: string
  video_url: string | null
  imagen_url: string | null
}

interface MovilidadSectionProps {
  hojaId: number
  items: { nombre: string; imagen_url: string }[]
  onItemsChange: (items: { nombre: string; imagen_url: string }[]) => void
  onSaved: () => void
  onExpand?: () => void
  collapseSignal?: number
}

export function MovilidadSection({ hojaId, items, onItemsChange, onSaved, onExpand, collapseSignal }: MovilidadSectionProps) {
  const local = items
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    if (collapseSignal) setCollapsed(true)
  }, [collapseSignal])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<number | null>(null) // slot index
  const [search, setSearch] = useState("")
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: libreria = [] } = useQuery<EjercicioMovilidad[]>({
    queryKey: ["ejercicios-movilidad"],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/ejercicios-movilidad`)
      return res.data
    },
  })

  const cleanImgUrl = (url: string | null) => url ?? null

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const filtered = libreria.filter((e) => normalize(e.nombre).includes(normalize(search)))

  // Focus search when picker opens
  useEffect(() => {
    if (pickerOpen !== null) {
      setSearch("")
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [pickerOpen])

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selectEjercicio = (ej: EjercicioMovilidad) => {
    if (pickerOpen === null) return
    onItemsChange(local.map((item, i) =>
      i === pickerOpen ? { nombre: ej.nombre, imagen_url: ej.imagen_url ?? "" } : item
    ))
    setPickerOpen(null)
    setDirty(true)
  }

  const addSlot = () => {
    if (local.length >= 13) return
    onItemsChange([...local, { nombre: "", imagen_url: "" }])
    setDirty(true)
  }

  const removeSlot = (idx: number) => {
    onItemsChange(local.filter((_, i) => i !== idx))
    if (pickerOpen === idx) setPickerOpen(null)
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/hojas/${hojaId}/movilidad`,
        {
          items: local
            .filter((i) => i.nombre.trim())
            .map((i) => ({ nombre: i.nombre.trim(), imagen_url: i.imagen_url.trim() || null })),
        }
      )
      setDirty(false)
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => {
          const expanding = collapsed
          setCollapsed((v) => !v)
          if (expanding) onExpand?.()
        }}
        className="w-full flex items-center justify-between px-4 py-3 border-b bg-muted/50 hover:bg-muted/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Movilidad</span>
          <span className="text-xs text-muted-foreground">{local.length}/13 ejercicios</span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[10px] text-[var(--primary-color)]">Sin guardar</span>}
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? "[grid-template-rows:0fr]" : "[grid-template-rows:1fr]"}`}>
        <div className="overflow-hidden min-h-0">
          <div className="p-4 space-y-4">

            {/* Exercise grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {local.map((item, idx) => (
                <div key={idx} className="group relative">
                  <button
                    onClick={() => setPickerOpen(pickerOpen === idx ? null : idx)}
                    className={`w-full rounded-lg border overflow-hidden text-left transition-colors hover:border-[var(--primary-color)]/60 ${pickerOpen === idx ? "border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]/30" : "border-border"}`}
                  >
                    {/* Image */}
                    <div className="aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
                      {item.imagen_url ? (
                        <img
                          src={cleanImgUrl(item.imagen_url) ?? ""}
                          alt={item.nombre}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {/* Name */}
                    <div className="px-1.5 py-1 bg-background">
                      <p className="text-[10px] leading-tight truncate text-foreground">
                        {item.nombre || <span className="text-muted-foreground">Seleccionar</span>}
                      </p>
                    </div>
                  </button>

                  {/* Remove button */}
                  <button
                    onClick={() => removeSlot(idx)}
                    className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5 z-10"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}

              {/* Add slot */}
              {local.length < 13 && (
                <button
                  onClick={addSlot}
                  className="rounded-lg border border-dashed aspect-[4/3] flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-[var(--primary-color)]/50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">Agregar</span>
                </button>
              )}
            </div>

            {/* Picker panel */}
            {pickerOpen !== null && (
              <div ref={pickerRef} className="rounded-lg border bg-popover shadow-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Buscar ejercicio de movilidad..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-7 text-xs pl-7"
                    />
                  </div>
                  <button
                    onClick={() => setPickerOpen(null)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                ) : (
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 max-h-60 overflow-y-auto pr-1">
                    {filtered.map((ej) => {
                      const isSelected = local[pickerOpen]?.nombre === ej.nombre
                      return (
                        <button
                          key={ej.id}
                          onClick={() => selectEjercicio(ej)}
                          className={`rounded-md border overflow-hidden text-left transition-colors hover:border-[var(--primary-color)]/60 ${isSelected ? "border-[var(--primary-color)] bg-[var(--primary-color)]/5" : "border-border"}`}
                        >
                          <div className="aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
                            {ej.imagen_url ? (
                              <img
                                src={cleanImgUrl(ej.imagen_url) ?? ""}
                                alt={ej.nombre}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                              />
                            ) : (
                              <span className="text-[8px] text-muted-foreground">Sin imagen</span>
                            )}
                          </div>
                          <div className="px-1 py-0.5 bg-background">
                            <p className="text-[9px] leading-tight line-clamp-2 text-foreground">{ej.nombre}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!dirty || saving}
                className={`gap-1.5 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white transition-opacity ${dirty ? "opacity-100" : "opacity-40"}`}
              >
                <Save className="h-3.5 w-3.5" />
                Guardar movilidad
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
