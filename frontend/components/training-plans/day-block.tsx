"use client"

import React, { useState, useEffect, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Youtube, ChevronDown, ChevronUp, Loader2, GripVertical, Pencil, Plus, ArrowUp, ArrowDown } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import axios from "axios"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { Planificacion } from "@/types/planificaciones"
import { CATEGORIAS, CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import type { PlanDia, PlanEjercicio } from "@/types/planificaciones"
import type { EjercicioLocal, PendingEjercicio } from "./plan-builder"

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
  onSemanaChange: (planEjId: number, semana: number, field: "dosis" | "rpe" | "notas", value: string) => void
  onCategoriaChange: (planEjId: number, categoria: string) => void
  onNotasProfesorChange: (planEjId: number, value: string) => void
  onSeriesChange: (planEjId: number, series: number) => void
  onPendingChange: (pending: PendingEjercicio[]) => void
  onOrderChange: (orderedIds: number[]) => void
  onDeleteEj: (planEjId: number) => void
  onReplaceEj: (planEjId: number) => void
  onOpenLibrary: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function DayBlock({
  dia, planId, localData, pending, isActive, onActivate, onDeleted,
  onSemanaChange, onCategoriaChange, onNotasProfesorChange, onSeriesChange, onPendingChange, onOrderChange, onDeleteEj, onReplaceEj, onOpenLibrary,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown,
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

  // Mover ejercicio guardado arriba/abajo con flechas (reemplaza el drag & drop)
  const moveEjercicio = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= orderedEjs.length) return
    const reordered = [...orderedEjs]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    // Reorden visual inmediato (urgente, solo re-renderiza este día)
    setOrderedEjs(reordered)
    // Notificar al padre (dirty + payload de guardado) en transición:
    // no bloquea el reorden visual con el re-render del PlanBuilder completo.
    startTransition(() => onOrderChange(reordered.map((e) => e.id)))
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
        notas_profesor: "",
        series: 3,
        dosis: {},
        rpe: {},
        notas: {},
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
        hojas: old.hojas.map((h) => {
          if (!h.dias.some((d) => d.id === dia.id)) return h
          const diasFiltrados = h.dias.filter((d) => d.id !== dia.id)
          const diasReordenados = diasFiltrados.map((d, index) => ({
            ...d,
            numero_dia: index + 1,
            orden: index,
          }))
          return { ...h, dias: diasReordenados }
        }),
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

  const setPendingField = (tempId: string, field: "categoria" | "dosis" | "rpe" | "notas_profesor" | "notas_semana" | "series", semana: number | null, value: string) => {
    if (field === "series") {
      const n = Math.max(1, Math.min(8, parseInt(value) || 3))
      onPendingChange(pending.map((p) => (p.tempId === tempId ? { ...p, series: n } : p)))
      return
    }
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
      if (field === "notas_profesor") return { ...p, notas_profesor: value }
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
            newRpe[s] = String(Math.min(baseRpe + step, 10))
            step++
          }
        } else {
          newRpe[semana] = value
        }
        return { ...p, rpe: newRpe }
      }
      if (field === "notas_semana" && semana !== null) {
        const newNotas = { ...p.notas }
        newNotas[semana] = value
        return { ...p, notas: newNotas }
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Mover día arriba"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Mover día abajo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
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
            <table className="w-full text-xs min-w-[850px] 2xl:min-w-[1050px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground w-20">Cat.</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ejercicio</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground w-16">Series</th>
                  {SEMANAS.map((s) => (
                    <th key={s} className="px-2 py-2 text-center font-medium text-muted-foreground w-32 2xl:w-40">
                      Sem. {s}
                    </th>
                  ))}
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                    {totalCount === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                          {isActive ? "Hacé click en un ejercicio del panel para agregarlo." : "Seleccioná este día."}
                        </td>
                      </tr>
                    )}

                    {orderedEjs.map((ej, idx) => (
                      <ExerciseRow
                        key={ej.id}
                        ej={ej}
                        localData={localData}
                        onSemanaChange={onSemanaChange}
                        onCategoriaChange={handleCategoriaForRow}
                        onNotasProfesorChange={onNotasProfesorChange}
                        onSeriesChange={onSeriesChange}
                        onDelete={handleDeleteSaved}
                        onReplace={onReplaceEj}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < orderedEjs.length - 1}
                        onMoveUp={() => moveEjercicio(idx, -1)}
                        onMoveDown={() => moveEjercicio(idx, 1)}
                      />
                    ))}

                    {pending.map((p) => (
                      <React.Fragment key={p.tempId}>
                      <tr className="border-l-2 border-l-[var(--primary-color)] animate-in fade-in slide-in-from-top-2 duration-200" style={CATEGORIA_ROW_STYLE[p.categoria]}>
                        <td className="px-1 py-1.5">
                          <CategoriaSelect value={p.categoria} onChange={(v) => setPendingField(p.tempId, "categoria", null, v)} />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {p.ejercicio.video_url && (
                              <a href={p.ejercicio.video_url} target="_blank" rel="noopener noreferrer"
                                className="text-red-500 hover:text-red-600 shrink-0">
                                <Youtube className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <span className="font-medium block max-w-[180px] truncate 2xl:max-w-none 2xl:overflow-visible 2xl:whitespace-normal 2xl:text-clip" title={p.ejercicio.nombre}>{p.ejercicio.nombre}</span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <SeriesSelect value={p.series ?? 3} onChange={(v) => setPendingField(p.tempId, "series", null, String(v))} />
                        </td>
                        {SEMANAS.map((s) => {
                          const pendingRpe = p.rpe[s] || (s % 2 === 0 ? (p.rpe[s - 1] ?? "") : "")
                          return (
                          <td key={s} className="px-1 py-1 align-top">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Input
                                  value={p.dosis[s] ?? ""}
                                  onChange={(e) => setPendingField(p.tempId, "dosis", s, e.target.value)}
                                  placeholder="Dosis"
                                  className="h-7 text-xs text-center px-1 placeholder:text-gray-300 min-w-[80px] md:min-w-0 flex-1"
                                />
                                <RpeSelect
                                  value={pendingRpe}
                                  onChange={(v) => setPendingField(p.tempId, "rpe", s, v)}
                                  exerciseName={p.ejercicio.nombre}
                                />
                              </div>
                              <Input
                                value={p.notas[s] ?? ""}
                                onChange={(e) => setPendingField(p.tempId, "notas_semana", s, e.target.value)}
                                placeholder={`Nota S${s}`}
                                className="h-7 text-xs placeholder:text-muted-foreground/40 bg-background/60 border-dashed"
                              />
                            </div>
                          </td>
                          )
                        })}
                        <td className="px-2 py-1.5 text-center">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removePending(p.tempId)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                      </React.Fragment>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Botón Agregar — siempre visible */}
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 hover:text-[var(--primary-color)]"
          onClick={(e) => {
            e.stopPropagation()
            onActivate()
            setCollapsed(false)
            onOpenLibrary()
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar ejercicio
        </Button>
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

function ExerciseRow({
  ej, localData, onSemanaChange, onCategoriaChange, onNotasProfesorChange, onSeriesChange, onDelete, onReplace,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown,
}: {
  ej: PlanEjercicio
  localData: Record<number, EjercicioLocal>
  onSemanaChange: (planEjId: number, semana: number, field: "dosis" | "rpe" | "notas", value: string) => void
  onCategoriaChange: (planEjId: number, categoria: string) => void
  onNotasProfesorChange: (planEjId: number, value: string) => void
  onSeriesChange: (planEjId: number, series: number) => void
  onDelete: (planEjId: number) => void
  onReplace: (planEjId: number) => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const local = localData[ej.id]
  const categoria = local?.categoria ?? ej.categoria

  return (
    <tr style={CATEGORIA_ROW_STYLE[categoria]}>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Subir ejercicio"
              className="flex items-center justify-center h-7 w-7 md:h-6 md:w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-colors"
            >
              <ArrowUp className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Bajar ejercicio"
              className="flex items-center justify-center h-7 w-7 md:h-6 md:w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-colors"
            >
              <ArrowDown className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </button>
          </div>
          <CategoriaSelect value={categoria} onChange={(v) => onCategoriaChange(ej.id, v)} />
        </div>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {ej.ejercicios.video_url && (
            <a href={ej.ejercicios.video_url} target="_blank" rel="noopener noreferrer"
              className="text-red-500 hover:text-red-600 shrink-0">
              <Youtube className="h-3.5 w-3.5" />
            </a>
          )}
          <span className="font-medium block max-w-[100px] truncate 2xl:max-w-none 2xl:overflow-visible 2xl:whitespace-normal 2xl:text-clip" title={ej.ejercicios.nombre}>{ej.ejercicios.nombre}</span>
        </div>
      </td>
      <td className="px-1 py-1.5 text-center">
        <SeriesSelect value={local?.series ?? ej.series ?? 3} onChange={(v) => onSeriesChange(ej.id, v)} />
      </td>
      {SEMANAS.map((s) => {
        const sem = local?.semanas?.[s]
        const prevSem = s % 2 === 0 ? local?.semanas?.[s - 1] : undefined
        const rpeValue = sem?.rpe || (s % 2 === 0 ? (prevSem?.rpe ?? "") : "")
        const notaSem = sem?.notas ?? ""
        return (
          <td key={s} className="px-1 py-1 align-top">
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <Input
                  value={sem?.dosis ?? ""}
                  onChange={(e) => onSemanaChange(ej.id, s, "dosis", e.target.value)}
                  placeholder="Dosis"
                  className="h-7 text-xs text-center px-1 placeholder:text-gray-300 min-w-[80px] md:min-w-0 flex-1"
                />
                <RpeSelect
                  value={rpeValue}
                  onChange={(v) => onSemanaChange(ej.id, s, "rpe", v)}
                  exerciseName={ej.ejercicios.nombre}
                />
              </div>
              <Input
                value={notaSem}
                onChange={(e) => onSemanaChange(ej.id, s, "notas", e.target.value)}
                placeholder={`Nota S${s}`}
                className="h-7 text-xs placeholder:text-muted-foreground/40 bg-background/60 border-dashed"
              />
            </div>
          </td>
        )
      })}
      <td className="px-2 py-1.5 text-center">
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onReplace(ej.id)}
            title="Reemplazar ejercicio">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(ej.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function SeriesSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-7 w-14 text-xs px-1 shrink-0 mx-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[3, 4].map((n) => (
          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RpeSelect({ value, onChange, exerciseName }: { value: string; onChange: (v: string) => void; exerciseName: string }) {
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-7 w-10 text-xs px-1 shrink-0">
        <SelectValue placeholder="-" />
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
