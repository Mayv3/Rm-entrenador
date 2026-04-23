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
import { ArrowLeft, Plus, Loader2, Save, Eye, EyeOff, Trash2 } from "lucide-react"
import { DayBlock } from "./day-block"
import { ExerciseLibraryPanel } from "./exercise-library-panel"
import { ExerciseLibrarySheet } from "./exercise-library-sheet"
import { MovilidadSection } from "./movilidad-section"
import type { Planificacion, Ejercicio } from "@/types/planificaciones"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"

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
  const [previewOpen, setPreviewOpen] = useState(false)
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
            newSemanas[s] = { ...newSemanas[s], rpe: String(Math.min(baseRpe + step, 10)) }
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

  const handleMoveDia = async (diaId: number, direction: -1 | 1) => {
    if (!activeHojaId) return

    const planActual = queryClient.getQueryData<Planificacion>(queryKeys.planificacionById(planId))
    const hojaActiva = planActual?.hojas.find((h) => h.id === activeHojaId)
    if (!hojaActiva) return

    const currentIndex = hojaActiva.dias.findIndex((d) => d.id === diaId)
    const targetIndex = currentIndex + direction
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= hojaActiva.dias.length) return

    const diasReordenados = [...hojaActiva.dias]
    const [movido] = diasReordenados.splice(currentIndex, 1)
    diasReordenados.splice(targetIndex, 0, movido)

    const diasNormalizados = diasReordenados.map((d, index) => ({
      ...d,
      numero_dia: index + 1,
      orden: index,
    }))

    queryClient.setQueryData<Planificacion>(queryKeys.planificacionById(planId), (old) => {
      if (!old) return old
      return {
        ...old,
        hojas: old.hojas.map((h) => (h.id === activeHojaId ? { ...h, dias: diasNormalizados } : h)),
      }
    })

    try {
      await Promise.all(
        diasNormalizados
          .filter((d) => d.id > 0)
          .map((d) =>
            axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/dias/${d.id}`, {
              nombre: d.nombre,
              orden: d.orden,
              numero_dia: d.numero_dia,
            })
          )
      )
    } catch (err) {
      console.error(err)
      queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
    }
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
      <div className="flex flex-col gap-5 h-full pb-2">
      {/* ─── Cabecera ─── */}
      <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 gap-1.5 text-muted-foreground mt-0.5 w-full justify-start md:w-auto">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <div className="rounded-xl border bg-card p-3 md:p-0 md:rounded-none md:border-0 md:bg-transparent">
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <PlanNameEditor value={plan.nombre} onSave={(v) => handleSaveMeta("nombre", v)} disabled={savingMeta} />
          </div>
          <Select value={plan.estado} onValueChange={(v) => handleSaveMeta("estado", v)}>
            <SelectTrigger className="w-28 h-8 text-sm shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* ─── Tabs de hojas ─── */}
      <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible flex-nowrap md:flex-wrap border-b pb-3 px-0.5">
        {[...plan.hojas].reverse().map((hoja) => {
          const esVisible = plan.hoja_activa_id === hoja.id
          const esActiva = activeHojaId === hoja.id
          return (
            <div key={hoja.id} className="group/tab flex items-center gap-0.5 shrink-0">
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
      </div>

      <div className="flex items-center gap-2.5 pt-0.5">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateHoja}
          disabled={creatingHoja}
          className="h-8 px-3 text-xs border-dashed gap-1.5 shrink-0"
        >
          {creatingHoja ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Nueva hoja
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          className="h-8 px-3 text-xs gap-1.5 shrink-0 ml-auto"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 flex gap-4 items-start">
        <div className="hidden md:block w-80 lg:w-96 shrink-0 sticky top-4" style={{ maxHeight: "calc(100vh - 180px)" }}>
          <ExerciseLibraryPanel onSelect={handleExerciseSelect} selectedDayName={activeDay?.nombre ?? null} />
        </div>

        {/* ─── Días ─── */}
        <div className="flex-1 min-h-0 min-w-0 space-y-4 overflow-y-auto pb-4">

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
            activeHoja.dias.map((dia, index) => (
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
                canMoveUp={index > 0}
                canMoveDown={index < activeHoja.dias.length - 1}
                onMoveUp={() => handleMoveDia(dia.id, -1)}
                onMoveDown={() => handleMoveDia(dia.id, 1)}
                onOpenLibrary={() => {
                  setActiveDayId(dia.id)
                  setMovilidadCollapseSignal((n) => n + 1)
                  setLibSheetOpen(true)
                }}
              />
            ))
          )}

          <div className="flex flex-col md:flex-row md:items-center gap-2.5 pt-2">
            <Input
              placeholder="Nombre del día (ej: Empuje, Tirón, Piernas...)"
              value={newDiaNombre}
              onChange={(e) => setNewDiaNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddDia() }}
              className="flex-1 min-w-0"
              disabled={!activeHojaId}
            />
            <Button onClick={handleAddDia} disabled={!newDiaNombre.trim() || !activeHojaId}
              className="shrink-0 w-full md:w-auto bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white gap-2">
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

      <ExerciseLibrarySheet
        open={libSheetOpen}
        onOpenChange={setLibSheetOpen}
        onSelect={handleExerciseSelect}
        dayName={activeDay?.nombre ?? null}
      />

      {/* ─── Preview ─── */}
      <PlanPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        activeHoja={activeHoja}
        localData={localData}
        pendingByDay={pendingByDay}
        movilidadItems={activeHoja ? (movByHoja[activeHoja.id] ?? activeHoja.movilidad.map((m) => ({ nombre: m.nombre, imagen_url: m.imagen_url ?? "" }))) : []}
      />

      <Dialog open={!!hojaToDelete} onOpenChange={(open) => { if (!open) setHojaToDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar hoja</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés eliminar <span className="font-medium text-foreground">{hojaToDelete?.nombre}</span>? Se borrarán todos sus días y ejercicios. Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button variant="outline" className="w-1/2" onClick={() => setHojaToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" className="w-1/2" onClick={confirmDeleteHoja}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const SEMANAS_PREVIEW = [1, 2, 3, 4, 5, 6]

function PlanPreviewDialog({
  open, onOpenChange, activeHoja, localData, pendingByDay, movilidadItems,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  activeHoja: Planificacion["hojas"][number] | undefined
  localData: Record<number, EjercicioLocal>
  pendingByDay: Record<number, PendingEjercicio[]>
  movilidadItems: { nombre: string; imagen_url: string }[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full flex flex-col p-0 max-h-[88vh]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base">
            Preview — {activeHoja?.nombre ?? ""}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-8">
          {!activeHoja ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin hoja seleccionada.</p>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">Movilidad</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {movilidadItems.filter((i) => i.nombre.trim()).length} ejerc.
                  </span>
                </div>

                {movilidadItems.filter((i) => i.nombre.trim()).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-1">Sin movilidad.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {movilidadItems
                      .filter((i) => i.nombre.trim())
                      .map((item, idx) => (
                        <div key={`${item.nombre}-${idx}`} className="rounded-lg border overflow-hidden bg-card">
                          <div className="aspect-video bg-muted/30 overflow-hidden flex items-center justify-center">
                            {item.imagen_url ? (
                              <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Sin imagen</span>
                            )}
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-xs font-medium truncate" title={item.nombre}>{item.nombre}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {activeHoja.dias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Sin días en esta hoja.</p>
              ) : (
            activeHoja.dias.map((dia) => {
              const pending = pendingByDay[dia.id] ?? []
              const savedEjs = [...dia.ejercicios]
                .sort((a, b) => a.orden - b.orden)
                .map((ej) => ({
                  key: String(ej.id),
                  nombre: ej.ejercicios.nombre,
                  categoria: localData[ej.id]?.categoria ?? ej.categoria,
                  semanas: localData[ej.id]?.semanas ?? {},
                  isPending: false,
                }))
              const pendingEjs = pending.map((p) => ({
                key: p.tempId,
                nombre: p.ejercicio.nombre,
                categoria: p.categoria,
                semanas: Object.fromEntries(
                  SEMANAS_PREVIEW.map((s) => [s, { dosis: p.dosis[s] ?? "", rpe: p.rpe[s] ?? "" }])
                ),
                isPending: true,
              }))
              const allEjs = [...savedEjs, ...pendingEjs]

              return (
                <div key={dia.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold">
                      DÍA {dia.numero_dia} — {dia.nombre}
                    </h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {allEjs.length} ejerc.
                    </span>
                  </div>

                  {allEjs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-1">Sin ejercicios.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs min-w-[700px]">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16">Cat.</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ejercicio</th>
                            {SEMANAS_PREVIEW.map((s) => (
                              <th key={s} className="px-2 py-2 text-center font-medium text-muted-foreground w-24">
                                Sem. {s}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {allEjs.map((ej) => (
                            <tr key={ej.key} style={CATEGORIA_ROW_STYLE[ej.categoria]}>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[ej.categoria] ?? ""}`}>
                                  {ej.categoria}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium whitespace-nowrap">
                                {ej.nombre}
                                {ej.isPending && (
                                  <span className="ml-1.5 text-[10px] font-normal text-orange-500 italic">sin guardar</span>
                                )}
                              </td>
                              {SEMANAS_PREVIEW.map((s) => {
                                const sem = ej.semanas[s]
                                return (
                                  <td key={s} className="px-2 py-2 text-center">
                                    {sem?.dosis ? (
                                      <div className="space-y-0.5">
                                        <div className="font-medium">{sem.dosis}</div>
                                        {sem.rpe && (
                                          <div className="text-[10px] text-muted-foreground">RPE {sem.rpe}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/30">—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
