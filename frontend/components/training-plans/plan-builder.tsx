"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "@/components/ui/loader"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { queryKeys } from "@/lib/query-keys"
import { ArrowLeft, Plus, Loader2, Save, Eye, EyeOff, Trash2, Dumbbell } from "lucide-react"
import { DayBlock } from "./day-block"
import { ExerciseLibraryPanel } from "./exercise-library-panel"
import { ExerciseLibrarySheet } from "./exercise-library-sheet"
import { MovilidadSection } from "./movilidad-section"
import type { Planificacion, Ejercicio } from "@/types/planificaciones"

const CATEGORIA_ORDER = ["ACTIVADOR", "A", "B", "C", "D", "E"]

export type SemanaLocal = { dosis: string; rpe: string }
export type EjercicioLocal = { categoria: string; semanas: Record<number, SemanaLocal> }
export type PendingEjercicio = {
  tempId: string
  ejercicio: Ejercicio
  categoria: string
  dosis: Record<number, string>
  rpe: Record<number, string>
}

interface PlanBuilderProps {
  planId: number
  onBack: () => void
}

export function PlanBuilder({ planId, onBack }: PlanBuilderProps) {
  const queryClient = useQueryClient()
  const [savingMeta, setSavingMeta] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [newDiaNombre, setNewDiaNombre] = useState("")
  const [activeDayId, setActiveDayId] = useState<number | null>(null)
  const [activeHojaId, setActiveHojaId] = useState<number | null>(null)
  const [creatingHoja, setCreatingHoja] = useState(false)
  const [hojaToDelete, setHojaToDelete] = useState<{ id: number; nombre: string } | null>(null)
  const [libSheetOpen, setLibSheetOpen] = useState(false)
  const [movilidadCollapseSignal, setMovilidadCollapseSignal] = useState(0)

  // Estado centralizado: dosis, rpe y categoría de todos los ejercicios ya guardados
  const [localData, setLocalData] = useState<Record<number, EjercicioLocal>>({})
  // Ejercicios pendientes por día
  const [pendingByDay, setPendingByDay] = useState<Record<number, PendingEjercicio[]>>({})
  // Orden personalizado de ejercicios por día (diaId → [planEjId, ...])
  const [orderByDay, setOrderByDay] = useState<Record<number, number[]>>({})
  // IDs de ejercicios a eliminar al guardar
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const initialized = useRef(false)
  // Movilidad local por hoja (preserva cambios no guardados al cambiar de hoja)
  const [movByHoja, setMovByHoja] = useState<Record<number, { nombre: string; imagen_url: string }[]>>({})

  const { data: plan, isLoading } = useQuery<Planificacion>({
    queryKey: queryKeys.planificacionById(planId),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}`)
      return res.data
    },
  })

  // Inicializar estado local solo la primera vez (o cuando cambia planId)
  useEffect(() => {
    if (!plan || !plan.hojas || initialized.current) return
    const data: Record<number, EjercicioLocal> = {}
    plan.hojas.flatMap((h) => h.dias).forEach((dia) => {
      dia.ejercicios.forEach((ej) => {
        data[ej.id] = {
          categoria: ej.categoria,
          semanas: Object.fromEntries(
            ej.semanas.map((s) => [s.semana, { dosis: s.dosis ?? "", rpe: s.rpe?.toString() ?? "" }])
          ),
        }
      })
    })
    setLocalData(data)
    // Inicializar movilidad por hoja (solo hojas que aún no tienen estado local)
    setMovByHoja((prev) => {
      const next = { ...prev }
      plan.hojas.forEach((hoja) => {
        if (!(hoja.id in next)) {
          next[hoja.id] = (hoja.movilidad ?? []).map((i) => ({ nombre: i.nombre, imagen_url: i.imagen_url ?? "" }))
        }
      })
      return next
    })
    initialized.current = true
  }, [plan])

  // Auto-seleccionar hoja activa
  useEffect(() => {
    if (!plan?.hojas?.length || activeHojaId !== null) return
    // prefer the last 'activa' hoja, or just the last one
    const activa = [...plan.hojas].reverse().find((h) => h.estado === "activa") ?? plan.hojas[plan.hojas.length - 1]
    setActiveHojaId(activa.id)
  }, [plan?.hojas])

  // Cuando cambia activeHojaId, resetear activeDayId
  useEffect(() => {
    setActiveDayId(null)
  }, [activeHojaId])

  // Auto-seleccionar primer día de la hoja activa
  useEffect(() => {
    const activeHoja = plan?.hojas?.find((h) => h.id === activeHojaId)
    if (activeHoja?.dias?.length && activeDayId === null) {
      setActiveDayId(activeHoja.dias[0].id)
    }
  }, [activeHojaId, plan?.hojas])

  // Cuando se agrega un nuevo ejercicio guardado tras refetch, incorporarlo al estado local
  useEffect(() => {
    if (!plan || !plan.hojas || !initialized.current) return
    plan.hojas.flatMap((h) => h.dias).forEach((dia) => {
      dia.ejercicios.forEach((ej) => {
        if (!localData[ej.id]) {
          setLocalData((prev) => ({
            ...prev,
            [ej.id]: {
              categoria: ej.categoria,
              semanas: Object.fromEntries(
                ej.semanas.map((s) => [s.semana, { dosis: s.dosis ?? "", rpe: s.rpe?.toString() ?? "" }])
              ),
            },
          }))
        }
      })
    })
  }, [plan])

  const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })

  const markDirty = () => setIsDirty(true)

  // ── Cambios en semanas ──────────────────────────────────────────────────────
  const handleSemanaChange = (planEjId: number, semana: number, field: "dosis" | "rpe", value: string) => {
    setLocalData((prev) => {
      const newSemanas = { ...prev[planEjId]?.semanas }
      if (field === "dosis") {
        if (semana % 2 === 1) {
          for (let s = semana; s <= 5; s += 2) {
            newSemanas[s] = { ...newSemanas[s], dosis: value }
          }
        } else {
          newSemanas[semana] = { ...newSemanas[semana], dosis: value }
        }
      } else {
        const baseRpe = parseInt(value)
        if (semana % 2 === 1 && !isNaN(baseRpe)) {
          let step = 0
          for (let s = semana; s <= 5; s += 2) {
            newSemanas[s] = { ...newSemanas[s], rpe: String(Math.min(baseRpe + step * 2, 10)) }
            step++
          }
        } else {
          newSemanas[semana] = { ...newSemanas[semana], rpe: value }
        }
      }
      return { ...prev, [planEjId]: { ...prev[planEjId], semanas: newSemanas } }
    })
    markDirty()
  }

  // ── Cambios en categoría ────────────────────────────────────────────────────
  const handleCategoriaChange = (planEjId: number, categoria: string) => {
    setLocalData((prev) => ({
      ...prev,
      [planEjId]: { ...prev[planEjId], categoria },
    }))
    markDirty()
  }

  // ── Pendientes por día ──────────────────────────────────────────────────────
  const handlePendingChange = (diaId: number, pending: PendingEjercicio[]) => {
    setPendingByDay((prev) => ({ ...prev, [diaId]: pending }))
    if (pending.length > 0) markDirty()
  }

  const handleOrderChange = (diaId: number, orderedIds: number[]) => {
    setOrderByDay((prev) => ({ ...prev, [diaId]: orderedIds }))
    markDirty()
  }

  const handleDeleteEj = (planEjId: number) => {
    setPendingDeletes((prev) => [...prev, planEjId])
    markDirty()
  }

  const setSaveStatusWithAutoClear = useCallback((status: "saved" | "error") => {
    setSaveStatus(status)
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000)
  }, [])

  // ── Guardar todo ────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!plan) return

    // Optimistic: limpiar dirty y mostrar saving inmediatamente
    setIsDirty(false)
    setSaveStatus("saving")

    // Snapshot del estado actual para enviar en background (sin tocar la UI todavía)
    const snapshotPendingByDay = { ...pendingByDay }
    const snapshotLocalData = { ...localData }
    const snapshotOrderByDay = { ...orderByDay }
    const snapshotPendingDeletes = [...pendingDeletes]

    try {
      // Construir semanas y categorías de ejercicios ya persistidos
      const semanas: { planificacion_ejercicio_id: number; semana: number; dosis: string | null; rpe: number | null }[] = []
      const categorias: { planificacion_ejercicio_id: number; categoria: string }[] = []

      plan.hojas.flatMap((h) => h.dias).forEach((dia) => {
        dia.ejercicios.forEach((ej) => {
          const local = snapshotLocalData[ej.id]
          if (!local) return
          if (local.categoria !== ej.categoria) {
            categorias.push({ planificacion_ejercicio_id: ej.id, categoria: local.categoria })
          }
          for (let s = 1; s <= 6; s++) {
            const localSem = local.semanas[s]
            const serverSem = ej.semanas.find((sw) => sw.semana === s)
            const dosisChanged = (localSem?.dosis ?? "") !== (serverSem?.dosis ?? "")
            const rpeChanged = (localSem?.rpe ?? "") !== (serverSem?.rpe?.toString() ?? "")
            if (dosisChanged || rpeChanged) {
              semanas.push({
                planificacion_ejercicio_id: ej.id,
                semana: s,
                dosis: localSem?.dosis || null,
                rpe: localSem?.rpe ? Number(localSem.rpe) : null,
              })
            }
          }
        })
      })

      const pendingByDayPayload: Record<string, { ejercicio_id: number; categoria: string; orden: number; semanas: { semana: number; dosis: string | null; rpe: number | null }[] }[]> = {}
      for (const [diaId, pending] of Object.entries(snapshotPendingByDay)) {
        if (!pending.length) continue
        pendingByDayPayload[diaId] = [...pending]
          .sort((a, b) => CATEGORIA_ORDER.indexOf(a.categoria) - CATEGORIA_ORDER.indexOf(b.categoria))
          .map((p, i) => ({
            ejercicio_id: p.ejercicio.id,
            categoria: p.categoria,
            orden: i,
            semanas: [1, 2, 3, 4, 5, 6].map((s) => ({
              semana: s,
              dosis: p.dosis[s] || null,
              rpe: p.rpe[s] ? Number(p.rpe[s]) : null,
            })),
          }))
      }

      const ordenItems = Object.entries(snapshotOrderByDay).flatMap(([, orderedIds]) =>
        orderedIds.map((planEjId, idx) => ({ id: planEjId, orden: idx }))
      )

      // Un solo request — todas las ops corren en paralelo en el backend
      await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/save-all`,
        {
          pendingByDay: pendingByDayPayload,
          semanas,
          categorias,
          deletes: snapshotPendingDeletes,
          orden: ordenItems,
        }
      )

      // Limpiar estado inmediatamente y mostrar "guardado"
      setPendingByDay({})
      setOrderByDay({})
      setPendingDeletes([])
      setSaveStatusWithAutoClear("saved")

      // Refetch en background — no bloqueamos la UI
      initialized.current = false
      refetch()
      queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
    } catch (err) {
      console.error(err)
      // Revertir estado en caso de error
      setIsDirty(true)
      setPendingByDay(snapshotPendingByDay)
      setOrderByDay(snapshotOrderByDay)
      setPendingDeletes(snapshotPendingDeletes)
      setSaveStatusWithAutoClear("error")
    }
  }

  const handleSaveMeta = async (field: "nombre" | "alumno_id" | "estado", value: string | number | null) => {
    if (!plan) return
    setSavingMeta(true)
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}`, {
        nombre: plan.nombre, alumno_id: plan.alumno_id, estado: plan.estado, [field]: value,
      })
      await refetch()
      await queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
    } catch (err) { console.error(err) }
    finally { setSavingMeta(false) }
  }

  const handleSetHojaActiva = (hojaId: number | null) => {
    if (!plan) return
    // Actualizar cache optimistamente
    queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) =>
      old ? { ...old, hoja_activa_id: hojaId } : old
    )
    // Request en background
    axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}`, {
      nombre: plan.nombre,
      alumno_id: plan.alumno_id,
      estado: plan.estado,
      hoja_activa_id: hojaId,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
    }).catch(console.error)
  }

  const confirmDeleteHoja = () => {
    if (!plan || !hojaToDelete) return
    const hojaId = hojaToDelete.id
    setHojaToDelete(null)
    // Actualizar UI y cache optimistamente
    const remaining = plan.hojas.filter((h) => h.id !== hojaId)
    if (activeHojaId === hojaId) {
      setActiveHojaId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
      setActiveDayId(null)
    }
    queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) =>
      old ? { ...old, hojas: remaining } : old
    )
    // Request en background
    axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/hojas/${hojaId}`)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones }))
      .catch(console.error)
  }

  const handleCreateHoja = async () => {
    if (!plan) return
    setCreatingHoja(true)
    try {
      const numero = plan.hojas.length + 1
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/hojas`,
        { nombre: `Hoja ${numero}`, numero }
      )
      setActiveHojaId(res.data.id)
      setActiveDayId(null)
      await refetch()
    } catch (err) { console.error(err) }
    finally { setCreatingHoja(false) }
  }

  const handleAddDia = async () => {
    if (!newDiaNombre.trim() || !activeHojaId) return

    const activeHoja = plan?.hojas.find((h) => h.id === activeHojaId)
    const numeroDia = (activeHoja?.dias.length ?? 0) + 1
    const nombre = newDiaNombre.trim()
    const tempId = -(Date.now()) // ID temporal negativo

    // Optimistic: agregar día al cache inmediatamente
    const tempDia = { id: tempId, hoja_id: activeHojaId, numero_dia: numeroDia, nombre, orden: numeroDia - 1, ejercicios: [] }
    queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) => {
      if (!old) return old
      return {
        ...old,
        hojas: old.hojas.map((h) =>
          h.id === activeHojaId ? { ...h, dias: [...h.dias, tempDia] } : h
        ),
      }
    })
    setNewDiaNombre("")
    setActiveDayId(tempId)

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/hojas/${activeHojaId}/dias`,
        { numero_dia: numeroDia, nombre, orden: numeroDia - 1 }
      )
      // Reemplazar temp ID con el real
      queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) => {
        if (!old) return old
        return {
          ...old,
          hojas: old.hojas.map((h) =>
            h.id === activeHojaId
              ? { ...h, dias: h.dias.map((d) => d.id === tempId ? { ...d, id: res.data.id } : d) }
              : h
          ),
        }
      })
      setActiveDayId(res.data.id)
    } catch (err) {
      console.error(err)
      // Revertir en caso de error
      queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) => {
        if (!old) return old
        return {
          ...old,
          hojas: old.hojas.map((h) =>
            h.id === activeHojaId ? { ...h, dias: h.dias.filter((d) => d.id !== tempId) } : h
          ),
        }
      })
      setNewDiaNombre(nombre)
      setActiveDayId(null)
    }
  }

  const handleExerciseSelect = (ejercicio: Ejercicio) => {
    const activeHoja = plan?.hojas?.find((h) => h.id === activeHojaId) ?? plan?.hojas?.[0]
    const targetId = activeDayId ?? activeHoja?.dias?.[0]?.id ?? null
    if (!targetId) return
    if (!activeDayId) setActiveDayId(targetId)
    window.dispatchEvent(new CustomEvent("add-exercise-to-day", {
      detail: { dayId: targetId, ejercicio }
    }))
  }

  if (isLoading || !plan) return <Loader />
  if (!plan.hojas) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
      <p>Error al cargar el plan. Aplicá la migración de base de datos y recargá.</p>
      <Button variant="outline" size="sm" onClick={onBack}>Volver</Button>
    </div>
  )

  const activeHoja = plan.hojas.find((h) => h.id === activeHojaId)
  const activeDay = activeHoja?.dias.find((d) => d.id === activeDayId)
  const allDias = plan.hojas.flatMap((h) => h.dias)

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ─── Cabecera ─── */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 gap-1.5 text-muted-foreground mt-0.5">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <PlanNameEditor value={plan.nombre} onSave={(v) => handleSaveMeta("nombre", v)} disabled={savingMeta} />
          <Select value={plan.estado} onValueChange={(v) => handleSaveMeta("estado", v)}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* ─── Tabs de hojas ─── */}
      <div className="flex items-center gap-2 flex-wrap border-b pb-3">
        {[...plan.hojas].reverse().map((hoja) => {
          const esVisible = plan.hoja_activa_id === hoja.id
          const esActiva = activeHojaId === hoja.id
          return (
            <div key={hoja.id} className="group/tab flex items-center gap-0.5">
              <button
                onClick={() => { setActiveHojaId(hoja.id); setActiveDayId(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  esActiva
                    ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-[var(--primary-color)]/50 hover:text-foreground"
                }`}
              >
                {hoja.nombre}
                {hoja.estado === "completada" && <span className="opacity-60">✓</span>}
                <span className={`text-[10px] ${esActiva ? "opacity-70" : "opacity-50"}`}>
                  {hoja.dias.length}d
                </span>
              </button>

              {/* Acciones: siempre visibles en mobile, hover en desktop */}
              <div className={`flex items-center gap-1 overflow-hidden transition-all duration-150 md:group-hover/tab:max-w-[64px] ${esVisible ? "max-w-[64px] md:max-w-[24px]" : "max-w-[64px] md:max-w-0"}`}>
                <button
                  onClick={() => handleSetHojaActiva(esVisible ? null : hoja.id)}
                  title={esVisible ? "Alumno ve esta hoja — click para ocultar" : "Mostrar esta hoja al alumno"}
                  className={`rounded-full p-1 transition-colors shrink-0 ${esVisible ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {esVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                {plan.hojas.length > 1 && (
                  <button
                    onClick={() => setHojaToDelete({ id: hoja.id, nombre: hoja.nombre })}
                    title="Eliminar hoja"
                    className="rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateHoja}
          disabled={creatingHoja}
          className="h-7 px-2.5 text-xs border-dashed gap-1"
        >
          {creatingHoja ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Nueva hoja
        </Button>
      </div>

      {/* ─── Layout dos columnas ─── */}
      <div className="flex gap-4 items-start">
        {/* Librería izquierda — solo desktop */}
        <div className="hidden md:block w-80 shrink-0 sticky top-4" style={{ height: "calc(100vh - 140px)" }}>
          <ExerciseLibraryPanel onSelect={handleExerciseSelect} selectedDayName={activeDay?.nombre ?? null} />
        </div>

        {/* Días derecha */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Botón librería + Guardar — solo mobile */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLibSheetOpen(true)}
              className="flex-1 gap-1.5"
            >
              <Dumbbell className="h-4 w-4" />
              Agregar ejercicio
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={!isDirty || saveStatus === "saving"}
              className={`gap-1.5 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white transition-opacity duration-300 ${isDirty ? "opacity-100" : "opacity-40"}`}
            >
              {saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveStatus === "saving" ? "Guardando..." : "Guardar"}
            </Button>
          </div>

          {/* Aviso unsaved — solo desktop */}
          {isDirty && (
            <div className="hidden md:flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
              <span>⚠️ No guardaste todavia gorriau</span>
            </div>
          )}

          {activeHoja && (
            <MovilidadSection
              hojaId={activeHoja.id}
              items={movByHoja[activeHoja.id] ?? activeHoja.movilidad ?? []}
              onItemsChange={(items) => setMovByHoja((prev) => ({ ...prev, [activeHoja.id]: items }))}
              onSaved={refetch}
              onExpand={() => setActiveDayId(null)}
              collapseSignal={movilidadCollapseSignal}
            />
          )}

          {!activeHoja ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground text-sm">
              Seleccioná una hoja o creá la primera.
            </div>
          ) : activeHoja.dias.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground text-sm">
              No hay días en esta hoja. Agregá el primero abajo.
            </div>
          ) : (
            activeHoja.dias.map((dia) => (
              <DayBlock
                key={dia.id}
                dia={dia}
                planId={planId}
                localData={localData}
                pending={pendingByDay[dia.id] ?? []}
                isActive={activeDayId === dia.id}
                onActivate={() => { setActiveDayId(dia.id); setMovilidadCollapseSignal((n) => n + 1) }}
                onDeleted={() => {
                  if (activeDayId === dia.id) setActiveDayId(null)
                }}
                onSemanaChange={handleSemanaChange}
                onCategoriaChange={handleCategoriaChange}
                onPendingChange={(p) => handlePendingChange(dia.id, p)}
                onOrderChange={(ids) => handleOrderChange(dia.id, ids)}
                onDeleteEj={handleDeleteEj}
              />
            ))
          )}

          <div className="flex items-center gap-2 pt-1">
            <Input
              placeholder="Nombre del día (ej: Empuje, Tirón, Piernas...)"
              value={newDiaNombre}
              onChange={(e) => setNewDiaNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddDia() }}
              className="flex-1 min-w-0"
              disabled={!activeHojaId}
            />
            <Button onClick={handleAddDia} disabled={!newDiaNombre.trim() || !activeHojaId}
              className="shrink-0 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Agregar día
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={!isDirty || saveStatus === "saving"}
              className={`md:flex hidden shrink-0 gap-1.5 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white transition-opacity duration-300 ${isDirty ? "opacity-100" : "opacity-40"}`}
            >
              {saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveStatus === "saving" ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Librería mobile */}
      <ExerciseLibrarySheet
        open={libSheetOpen}
        onOpenChange={setLibSheetOpen}
        onSelect={(ej) => { handleExerciseSelect(ej); setLibSheetOpen(false) }}
      />

      <Dialog open={!!hojaToDelete} onOpenChange={(open) => { if (!open) setHojaToDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar hoja</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés eliminar <span className="font-medium text-foreground">{hojaToDelete?.nombre}</span>? Se borrarán todos sus días y ejercicios. Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHojaToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteHoja}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PlanNameEditor({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  const commit = () => {
    if (local.trim() && local !== value) onSave(local.trim())
    setEditing(false)
  }
  if (!editing) {
    return (
      <button onClick={() => { setLocal(value); setEditing(true) }}
        className="text-xl font-bold hover:text-[var(--primary-color)] transition-colors text-left">
        {value}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Input autoFocus value={local} onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
        className="h-8 text-lg font-bold max-w-xs" disabled={disabled} />
      <Button size="sm" variant="ghost" onClick={commit} disabled={disabled} className="h-8 px-2">
        {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}
