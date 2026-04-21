"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Youtube, ChevronDown, ChevronUp, Loader2, GripVertical, Pencil } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import axios from "axios"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { Planificacion } from "@/types/planificaciones"
import { CATEGORIAS, CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import type { PlanDia, PlanEjercicio } from "@/types/planificaciones"
import type { EjercicioLocal, PendingEjercicio } from "./plan-builder"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const SEMANAS = [1, 2, 3, 4, 5, 6]
const CATEGORIA_ORDER = ["ACTIVADOR", "A", "B", "C", "D", "E"]

interface DayBlockProps {
  dia: PlanDia
  planId: number
  localData: Record<number, EjercicioLocal>
  pending: PendingEjercicio[]
  isActive: boolean
  onActivate: () => void
  onDeleted: () => void
  onSemanaChange: (planEjId: number, semana: number, field: "dosis" | "rpe", value: string) => void
  onCategoriaChange: (planEjId: number, categoria: string) => void
  onPendingChange: (pending: PendingEjercicio[]) => void
  onOrderChange: (orderedIds: number[]) => void
  onDeleteEj: (planEjId: number) => void
}

export function DayBlock({
  dia, planId, localData, pending, isActive, onActivate, onDeleted,
  onSemanaChange, onCategoriaChange, onPendingChange, onOrderChange, onDeleteEj,
}: DayBlockProps) {
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nombre, setNombre] = useState(dia.nombre)
  const [savingName, setSavingName] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Orden local de ejercicios guardados (permite DnD)
  const [orderedEjs, setOrderedEjs] = useState<PlanEjercicio[]>(() =>
    [...dia.ejercicios].sort((a, b) => a.orden - b.orden)
  )

  // Sincronizar cuando cambian los ejercicios desde el servidor
  useEffect(() => {
    setOrderedEjs((prev) => {
      const prevIds = new Set(prev.map((e) => e.id))
      const incoming = dia.ejercicios
      // Mantener orden actual, quitar eliminados, agregar nuevos al final
      const kept = prev.filter((e) => incoming.find((i) => i.id === e.id))
      const added = incoming
        .filter((e) => !prevIds.has(e.id))
        .sort((a, b) => a.orden - b.orden)
      // Actualizar datos (dosis/rpe pueden haber cambiado en server)
      const updated = [...kept, ...added].map(
        (e) => incoming.find((i) => i.id === e.id) ?? e
      )
      return updated
    })
  }, [dia.ejercicios])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrderedEjs((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === Number(active.id))
      const newIndex = prev.findIndex((e) => e.id === Number(over.id))
      const reordered = arrayMove(prev, oldIndex, newIndex)
      onOrderChange(reordered.map((e) => e.id))
      return reordered
    })
  }

  const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })

  useEffect(() => {
    if (!isActive) setCollapsed(true)
  }, [isActive])

  useEffect(() => {
    const handler = (e: Event) => {
      const { dayId, ejercicio } = (e as CustomEvent).detail
      if (dayId !== dia.id) return
      const newPending: PendingEjercicio = {
        tempId: `tmp-${Date.now()}-${Math.random()}`,
        ejercicio,
        categoria: "A",
        dosis: {},
        rpe: {},
      }
      onPendingChange([...pending, newPending])
      setCollapsed(false)
    }
    window.addEventListener("add-exercise-to-day", handler)
    return () => window.removeEventListener("add-exercise-to-day", handler)
  }, [dia.id, pending, onPendingChange])

  const saveName = async () => {
    if (!nombre.trim() || nombre === dia.nombre) { setEditingName(false); return }
    setSavingName(true)
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/dias/${dia.id}`, {
        nombre: nombre.trim(), orden: dia.orden,
      })
      await refetch()
    } catch (err) { console.error(err) }
    finally { setSavingName(false); setEditingName(false) }
  }

  const handleDeleteDia = () => setConfirmDeleteOpen(true)

  const confirmDeleteDia = () => {
    setConfirmDeleteOpen(false)

    // Optimistic: sacar el día del cache inmediatamente
    queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) => {
      if (!old) return old
      return {
        ...old,
        hojas: old.hojas.map((h) => ({ ...h, dias: h.dias.filter((d) => d.id !== dia.id) })),
      }
    })
    onDeleted()

    // DELETE en background
    axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/dias/${dia.id}`)
      .catch((err) => {
        console.error(err)
        // Revertir si falla
        queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
      })
  }

  const handleDeleteSaved = (planEjId: number) => {
    setOrderedEjs((prev) => prev.filter((e) => e.id !== planEjId))
    onDeleteEj(planEjId)
  }

  const handleCategoriaForRow = (planEjId: number, categoria: string) => {
    onCategoriaChange(planEjId, categoria)
    if (categoria !== "ACTIVADOR") {
      const idx = orderedEjs.findIndex((e) => e.id === planEjId)
      if (idx !== -1 && idx + 1 < orderedEjs.length) {
        onCategoriaChange(orderedEjs[idx + 1].id, categoria)
      }
    }
  }

  const setPendingField = (tempId: string, field: "categoria" | "dosis" | "rpe", semana: number | null, value: string) => {
    if (field === "categoria") {
      const idx = pending.findIndex((p) => p.tempId === tempId)
      onPendingChange(pending.map((p, i) => {
        if (p.tempId === tempId) return { ...p, categoria: value }
        if (value !== "ACTIVADOR" && i === idx + 1) return { ...p, categoria: value }
        return p
      }))
      return
    }
    onPendingChange(pending.map((p) => {
      if (p.tempId !== tempId) return p
      if (field === "categoria") return { ...p, categoria: value }
      if (field === "dosis" && semana !== null) {
        const newDosis = { ...p.dosis }
        if (semana % 2 === 1) {
          for (let s = semana; s <= 5; s += 2) newDosis[s] = value
        } else {
          newDosis[semana] = value
        }
        return { ...p, dosis: newDosis }
      }
      if (field === "rpe" && semana !== null) {
        const baseRpe = parseInt(value)
        const newRpe = { ...p.rpe }
        if (semana % 2 === 1 && !isNaN(baseRpe)) {
          let step = 0
          for (let s = semana; s <= 5; s += 2) {
            newRpe[s] = String(Math.min(baseRpe + step * 2, 10))
            step++
          }
        } else {
          newRpe[semana] = value
        }
        return { ...p, rpe: newRpe }
      }
      return p
    }))
  }

  const removePending = (tempId: string) => onPendingChange(pending.filter((p) => p.tempId !== tempId))

  const totalCount = dia.ejercicios.length + pending.length

  return (
    <>
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-4 py-3 border-b cursor-pointer transition-colors ${
          isActive ? "bg-[var(--primary-color)]/8" : "bg-muted/50 hover:bg-muted/80"
        }`}
        onClick={() => { if (isActive) { setCollapsed((v) => !v) } else { onActivate(); setCollapsed(false) } }}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

        {editingName ? (
          <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
            <Input autoFocus value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
              className="h-7 text-sm font-medium max-w-xs" />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={saveName} disabled={savingName}>
              {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setNombre(dia.nombre); setEditingName(false) }}>✕</Button>
          </div>
        ) : (
          <span className={`flex-1 text-sm font-semibold ${isActive ? "text-[var(--primary-color)]" : ""}`}>
            DÍA {dia.numero_dia} — {dia.nombre}
            {isActive && <span className="ml-2 text-[10px] font-normal opacity-60">activo</span>}
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground">{totalCount} ejerc.</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
            onClick={() => { setNombre(dia.nombre); setEditingName(true) }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={handleDeleteDia}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? "[grid-template-rows:0fr]" : "[grid-template-rows:1fr]"}`}>
        <div className="overflow-hidden min-h-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1050px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground w-20">Cat.</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ejercicio</th>
                  {SEMANAS.map((s) => (
                    <th key={s} className="px-2 py-2 text-center font-medium text-muted-foreground w-40">
                      Sem. {s}
                    </th>
                  ))}
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedEjs.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y">
                    {totalCount === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                          {isActive ? "Hacé click en un ejercicio del panel para agregarlo." : "Seleccioná este día."}
                        </td>
                      </tr>
                    )}

                    {orderedEjs.map((ej) => (
                      <SortableExerciseRow
                        key={ej.id}
                        ej={ej}
                        localData={localData}
                        onSemanaChange={onSemanaChange}
                        onCategoriaChange={handleCategoriaForRow}
                        onDelete={handleDeleteSaved}
                      />
                    ))}

                    {pending.map((p) => (
                      <tr key={p.tempId} className="border-l-2 border-l-[var(--primary-color)] animate-in fade-in slide-in-from-top-2 duration-200" style={CATEGORIA_ROW_STYLE[p.categoria]}>
                        <td className="px-1 py-1.5">
                          <CategoriaSelect value={p.categoria} onChange={(v) => setPendingField(p.tempId, "categoria", null, v)} />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {p.ejercicio.video_url && (
                              <a href={p.ejercicio.video_url} target="_blank" rel="noopener noreferrer"
                                className="text-red-500 hover:text-red-600 shrink-0">
                                <Youtube className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <span className="font-medium">{p.ejercicio.nombre}</span>
                          </div>
                        </td>
                        {SEMANAS.map((s) => (
                          <td key={s} className="px-1 py-1">
                            <div className="flex gap-1">
                              <Input
                                value={p.dosis[s] ?? ""}
                                onChange={(e) => setPendingField(p.tempId, "dosis", s, e.target.value)}
                                placeholder="Dosis"
                                className="h-7 text-xs text-center px-1 placeholder:text-gray-300 min-w-0 flex-1"
                              />
                              <RpeSelect
                                value={p.rpe[s] ?? ""}
                                onChange={(v) => setPendingField(p.tempId, "rpe", s, v)}
                                exerciseName={p.ejercicio.nombre}
                              />
                            </div>
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removePending(p.tempId)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </div>
        </div>
      </div>
    </div>

    <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar día</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ¿Seguro que querés eliminar <span className="font-medium text-foreground">{dia.nombre}</span>? Se borrarán todos sus ejercicios.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDeleteDia}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function SortableExerciseRow({
  ej, localData, onSemanaChange, onCategoriaChange, onDelete,
}: {
  ej: PlanEjercicio
  localData: Record<number, EjercicioLocal>
  onSemanaChange: (planEjId: number, semana: number, field: "dosis" | "rpe", value: string) => void
  onCategoriaChange: (planEjId: number, categoria: string) => void
  onDelete: (planEjId: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ej.id })

  const local = localData[ej.id]
  const categoria = local?.categoria ?? ej.categoria

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...CATEGORIA_ROW_STYLE[categoria],
  }

  return (
    <tr ref={setNodeRef} style={style}>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-0.5">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
            tabIndex={-1}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <CategoriaSelect value={categoria} onChange={(v) => onCategoriaChange(ej.id, v)} />
        </div>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          {ej.ejercicios.video_url && (
            <a href={ej.ejercicios.video_url} target="_blank" rel="noopener noreferrer"
              className="text-red-500 hover:text-red-600 shrink-0">
              <Youtube className="h-3.5 w-3.5" />
            </a>
          )}
          <span className="font-medium">{ej.ejercicios.nombre}</span>
        </div>
      </td>
      {SEMANAS.map((s) => {
        const sem = local?.semanas?.[s]
        return (
          <td key={s} className="px-1 py-1">
            <div className="flex gap-1">
              <Input
                value={sem?.dosis ?? ""}
                onChange={(e) => onSemanaChange(ej.id, s, "dosis", e.target.value)}
                placeholder="Dosis"
                className="h-7 text-xs text-center px-1 placeholder:text-gray-300 min-w-0 flex-1"
              />
              <RpeSelect
                value={sem?.rpe ?? ""}
                onChange={(v) => onSemanaChange(ej.id, s, "rpe", v)}
                exerciseName={ej.ejercicios.nombre}
              />
            </div>
          </td>
        )
      })}
      <td className="px-2 py-1.5 text-center">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(ej.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  )
}

function RpeSelect({ value, onChange, exerciseName }: { value: string; onChange: (v: string) => void; exerciseName: string }) {
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-7 w-14 text-xs px-1 shrink-0">
        <SelectValue placeholder="RPE" />
      </SelectTrigger>
      <SelectContent>
        <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b mb-1 truncate max-w-[180px]">
          RPE — {exerciseName}
        </div>
        <SelectItem value="none"><span className="text-muted-foreground">—</span></SelectItem>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CategoriaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-14 text-xs border-0 shadow-none px-1 bg-transparent">
        <SelectValue>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[value] ?? ""}`}>
            {value}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CATEGORIAS.map((cat) => (
          <SelectItem key={cat} value={cat}>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[cat] ?? ""}`}>
              {cat}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
