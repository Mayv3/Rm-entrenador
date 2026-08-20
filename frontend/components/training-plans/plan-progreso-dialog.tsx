"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "@/components/ui/loader"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { queryKeys } from "@/lib/query-keys"
import { TrendingUp, AlertTriangle, StickyNote, Loader2, SkipForward, Undo2, CheckCircle2, Activity } from "lucide-react"
import type { PlanEjercicio, Planificacion, PlanSemana } from "@/types/planificaciones"
import { CATEGORIA_ROW_STYLE } from "@/types/planificaciones"

const SEMANAS_PREVIEW = [1, 2, 3, 4, 5, 6]

// ACTIVADOR siempre primero; el resto conserva su orden manual
const esActivador = (cat: string | null | undefined) => (cat ?? "").toUpperCase() === "ACTIVADOR"

export function PlanProgresoDialog({
  open, onOpenChange, planId, plan, activeHoja, localData = {}, readOnly = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  planId: number
  plan: Planificacion
  activeHoja: Planificacion["hojas"][number] | undefined
  localData?: Record<number, { categoria?: string }>
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [data, setData] = useState<{ sesiones: any[]; registros: any[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [estadoPopover, setEstadoPopover] = useState<string | null>(null)
  const [comentarioModal, setComentarioModal] = useState<{ ejercicio: string; comentario: string } | null>(null)
  const [prescripcionEdits, setPrescripcionEdits] = useState<Record<string, { dosis: string; rpe: string; notas: string }>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [skipKey, setSkipKey] = useState<string | null>(null)

  const cellKey = (diaId: number, semana: number, ejId: number) => `${diaId}-${semana}-${ejId}`

  const refetchProgreso = async () => {
    const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/progreso`)
    setData(res.data)
  }

  // Profesor: marca un ejercicio como saltado en nombre del alumno (crea la sesión si no existe).
  const handleSkip = async (dia: any, semana: number, ejId: number) => {
    const key = cellKey(dia.id, semana, ejId)
    setSkipKey(key)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/progreso/saltar`, {
        alumno_id: plan.alumno_id,
        hoja_id: activeHoja?.id ?? dia.hoja_id,
        dia_id: dia.id,
        semana,
        planificacion_ejercicio_id: ejId,
      })
      await refetchProgreso()
      queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
    } catch (err) {
      console.error("Error al saltar ejercicio:", err)
    } finally {
      setSkipKey(null)
    }
  }

  // Deshace el salto: borra el registro para volver la celda a pendiente.
  const handleUndoSkip = async (dia: any, semana: number, ejId: number, sesionId: number) => {
    const key = cellKey(dia.id, semana, ejId)
    setSkipKey(key)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/progreso/deshacer-salto`, {
        sesion_id: sesionId,
        planificacion_ejercicio_id: ejId,
      })
      await refetchProgreso()
      queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
    } catch (err) {
      console.error("Error al deshacer salto:", err)
    } finally {
      setSkipKey(null)
    }
  }

  const prescripcionKey = (ejId: number, semana: number) => `${ejId}-${semana}`

  const getPrescripcion = (ej: any, semana: number) => {
    const key = prescripcionKey(ej.id, semana)
    if (prescripcionEdits[key]) return prescripcionEdits[key]
    const sem = ej.semanas?.find((sw: any) => sw.semana === semana)
    return { dosis: sem?.dosis ?? "", rpe: sem?.rpe != null ? String(sem.rpe) : "", notas: sem?.notas_profesor ?? "" }
  }

  const setPrescripcionField = (ejId: number, semana: number, field: "dosis" | "rpe" | "notas", value: string, current: { dosis: string; rpe: string; notas: string }) => {
    const key = prescripcionKey(ejId, semana)
    setPrescripcionEdits((prev) => {
      const base = prev[key] ?? current
      return { ...prev, [key]: { ...base, [field]: value } }
    })
  }

  const savePrescripcion = async (ej: PlanEjercicio, semana: number) => {
    const key = prescripcionKey(ej.id, semana)
    const edit = prescripcionEdits[key]
    if (!edit) return
    setSavingKey(key)
    try {
      const notaOriginal = ej.semanas?.find((sw: PlanSemana) => sw.semana === semana)?.notas_profesor ?? ""
      const semanasDestino = edit.notas !== notaOriginal
        ? Array.from({ length: plan.semanas - semana + 1 }, (_, index) => semana + index)
        : [semana]

      await Promise.all(semanasDestino.map((semanaDestino) => {
        const destinoKey = prescripcionKey(ej.id, semanaDestino)
        const destino = semanaDestino === semana
          ? edit
          : prescripcionEdits[destinoKey] ?? getPrescripcion(ej, semanaDestino)
        return axios.put(
          process.env.NEXT_PUBLIC_URL_BACKEND + "/planificaciones/ejercicios/" + ej.id + "/semanas/" + semanaDestino,
          {
            dosis: destino.dosis || null,
            rpe: destino.rpe ? Number(destino.rpe) : null,
            notas_profesor: edit.notas || null,
          }
        )
      }))
      queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
      setPrescripcionEdits((prev) => {
        const next = { ...prev }
        semanasDestino.forEach((semanaDestino) => delete next[prescripcionKey(ej.id, semanaDestino)])
        return next
      })
    } catch (err) {
      console.error("Error guardando prescripción:", err)
    } finally {
      setSavingKey(null)
    }
  }

  useEffect(() => {
    if (!open || !plan.alumno_id) return
    setLoading(true)
    axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/progreso`)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [open, planId, plan.alumno_id])

  const dias = (activeHoja?.dias ?? plan.hojas.flatMap((h) => h.dias)).filter(
    (d, i, arr) => arr.findIndex((x) => x.id === d.id) === i
  )

  if (!plan.alumno_id) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Progreso</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground text-center py-8">
            Esta planificacion no tiene un alumno asignado.
          </p>
        </DialogContent>
      </Dialog>
    )
  }

  const sesionMap = new Map<string, any>()
  data?.sesiones?.forEach((s: any) => {
    sesionMap.set(`${s.dia_id}-${s.semana}`, s)
  })

  // Activadores = solo-vista: sus registros (si quedó alguno viejo en DB) NUNCA entran al progreso,
  // así no aparece "completado" de activadores en ninguna vista (alumno ni profesor).
  const activadorEjIds = new Set<number>(
    dias
      .flatMap((d) => d.ejercicios)
      .filter((e) => esActivador(localData[e.id]?.categoria ?? e.categoria))
      .map((e) => e.id)
  )

  const registroMap = new Map<string, any>()
  data?.registros?.forEach((r: any) => {
    if (activadorEjIds.has(r.planificacion_ejercicio_id)) return
    registroMap.set(`${r.sesion_id}-${r.planificacion_ejercicio_id}`, r)
  })

  // Saltado = marcador explícito _saltado, o sin dato real (reps>0). NO usar peso==0
  // (dominadas/peso corporal van sin peso). Aeróbico (sentinel {hecho}) nunca cuenta
  // como salto por reps=0 — solo el marcador explícito.
  const registroEsSaltado = (registro: any, esAerobico?: boolean) => {
    if (!registro) return false
    const series: any[] = registro.series ?? []
    if (series.length > 0 && series[0]?._saltado === true) return true
    if (esAerobico) return false
    return series.length > 0
      ? series.every((s: any) => (s.repeticiones ?? 0) === 0)
      : (registro.repeticiones ?? 0) === 0
  }

  // Día entero salteado por el alumno en esa semana: existe la sesión y TODOS los
  // ejercicios (no-activadores) quedaron saltados.
  const diaSaltado = (dia: any, semana: number) => {
    const sesion = sesionMap.get(`${dia.id}-${semana}`)
    if (!sesion) return false
    const ejs = (dia.ejercicios ?? []).filter(
      (e: any) => !esActivador(localData[e.id]?.categoria ?? e.categoria)
    )
    if (ejs.length === 0) return false
    return ejs.every((e: any) => registroEsSaltado(registroMap.get(`${sesion.id}-${e.id}`), e.es_aerobico))
  }

  // Compara dos arrays de series (peso/reps/rpe en orden, + hecho para aeróbico). Vacíos o distinto largo => no iguales.
  const serieClave = (s: any) => `${s?.peso_kg ?? ""}|${s?.repeticiones ?? ""}|${s?.rpe ?? ""}|${s?.hecho ?? ""}`
  const seriesIguales = (a: any[], b: any[]) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return false
    return a.every((s, i) => serieClave(s) === serieClave(b[i]))
  }

  // Día "copiado" de la semana anterior: el portal pre-carga los valores de referencia y el alumno
  // manda sin tocar nada => todas las series quedan idénticas a la semana previa. Señal de salto real
  // aunque haya reps>0. Requiere sesión en ambas semanas y TODOS los ejercicios (no-activadores) iguales.
  const diaCopiadoAnterior = (dia: any, semana: number) => {
    if (semana <= 1) return false
    const sesion = sesionMap.get(`${dia.id}-${semana}`)
    const sesionPrev = sesionMap.get(`${dia.id}-${semana - 1}`)
    if (!sesion || !sesionPrev) return false
    const ejs = (dia.ejercicios ?? []).filter(
      (e: any) => !esActivador(localData[e.id]?.categoria ?? e.categoria)
    )
    if (ejs.length === 0) return false
    return ejs.every((e: any) => {
      const cur = registroMap.get(`${sesion.id}-${e.id}`)
      const prev = registroMap.get(`${sesionPrev.id}-${e.id}`)
      if (!cur || !prev) return false
      return seriesIguales(cur.series ?? [], prev.series ?? [])
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] md:max-w-[1500px] flex flex-col p-0 max-h-[calc(100dvh-5rem)]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            {readOnly ? "Mi progreso" : `Progreso — ${plan.alumnos?.nombre ?? `Alumno #${plan.alumno_id}`}`}
            {activeHoja && <span className="text-muted-foreground font-normal">· {activeHoja.nombre}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-2 sm:px-6 py-5 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader /></div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground text-center py-10">Error al cargar datos.</p>
          ) : dias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin dias en esta hoja.</p>
          ) : (
            dias.map((dia) => {
              const ejercicios = [...dia.ejercicios]
                // Alumno (readOnly): sin activadores. Profesor: con activadores, pero siempre primero
                .filter((e) => !readOnly || !esActivador(localData[e.id]?.categoria ?? e.categoria))
                .sort((a, b) => {
                  const aAct = esActivador(localData[a.id]?.categoria ?? a.categoria) ? 0 : 1
                  const bAct = esActivador(localData[b.id]?.categoria ?? b.categoria) ? 0 : 1
                  if (aAct !== bAct) return aAct - bAct
                  return a.orden - b.orden
                })
              if (ejercicios.length === 0) return null

              return (
                <div key={dia.id}>
                  <h3 className="text-sm font-semibold mb-3">
                    DIA {dia.numero_dia} — {dia.nombre}
                    <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {ejercicios.length}
                    </span>
                  </h3>

                  <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full min-w-[1100px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-14">#</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ejercicio</th>
                          {SEMANAS_PREVIEW.map((s) => {
                            const sesion = sesionMap.get(`${dia.id}-${s}`)
                            const flags: { key: string; label: string; color: string; bg: string }[] = [
                              { key: "durmio_mal", label: "Dormí mal", color: "text-indigo-400", bg: "bg-indigo-500/15" },
                              { key: "fatiga", label: "Fatiga", color: "text-amber-400", bg: "bg-amber-500/15" },
                              { key: "desmotivacion", label: "Motivación", color: "text-cyan-400", bg: "bg-cyan-500/15" },
                              { key: "dolor", label: "Dolor", color: "text-rose-400", bg: "bg-rose-500/15" },
                            ]
                            const active = sesion ? flags.filter((f) => !!sesion[f.key]) : []
                            const popoverKey = `${dia.id}-${s}`
                            const esDiaSaltado = diaSaltado(dia, s)
                            const esDiaCopiado = !esDiaSaltado && diaCopiadoAnterior(dia, s)
                            return (
                              <th key={s} className={`px-0 py-2.5 text-center font-semibold w-[200px] relative ${s > 1 ? "border-l-2 border-border" : ""}`}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <span>S{s}</span>
                                  {esDiaSaltado && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" title={`El alumno saltó el día ${dia.numero_dia} en la semana ${s}`}>
                                      <SkipForward className="h-2.5 w-2.5" />
                                      Saltado
                                    </span>
                                  )}
                                  {esDiaCopiado && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" title={`Posible salto: todos los ejercicios del día ${dia.numero_dia} tienen valores idénticos a la semana ${s - 1}`}>
                                      <SkipForward className="h-2.5 w-2.5" />
                                      Saltado
                                    </span>
                                  )}
                                  {sesion && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEstadoPopover(estadoPopover === popoverKey ? null : popoverKey) }}
                                      className={`rounded-full p-0.5 transition-colors ${active.length > 0 ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground/30 hover:text-muted-foreground/50"}`}
                                    >
                                      <AlertTriangle className="h-3 w-3" fill={active.length > 0 ? "currentColor" : "none"} />
                                    </button>
                                  )}
                                </div>
                                {estadoPopover === popoverKey && (
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 rounded-lg border bg-popover p-2 shadow-md min-w-[130px]">
                                    {active.length === 0 ? (
                                      <span className="text-[10px] text-green-400">Perfecto</span>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        {active.map((f) => (
                                          <span key={f.key} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${f.bg} ${f.color}`}>{f.label}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex text-[10px] font-normal text-muted-foreground">
                                  <span className="w-6"></span>
                                  <span className="flex-1 text-center">kg</span>
                                  <span className="flex-1 text-center">reps</span>
                                  <span className="flex-1 text-center">rpe</span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {ejercicios.map((ej, idx) => {
                          const categoria = localData[ej.id]?.categoria ?? ej.categoria
                          const ejEsActivador = esActivador(categoria)
                          return (
                            <tr key={ej.id} style={CATEGORIA_ROW_STYLE[categoria]} className="hover:brightness-95 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-xs">
                                <span className="flex items-center gap-1.5">
                                  {ej.ejercicios.nombre}
                                  {ej.es_aerobico && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/15 text-sky-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                                      <Activity className="h-2.5 w-2.5" />
                                      Aeróbico
                                    </span>
                                  )}
                                </span>
                              </td>
                              {SEMANAS_PREVIEW.map((semana) => {
                                const sesion = sesionMap.get(`${dia.id}-${semana}`)
                                const registro = sesion ? registroMap.get(`${sesion.id}-${ej.id}`) : null
                                const borderSemana = semana > 1 ? "border-l-2 border-border" : ""
                                const presc = getPrescripcion(ej, semana)
                                const presKey = prescripcionKey(ej.id, semana)
                                const isDirty = !!prescripcionEdits[presKey]
                                const isSaving = savingKey === presKey

                                const prescripcionStrip = readOnly ? (
                                  (presc.dosis || presc.rpe || presc.notas) ? (
                                    <div className="px-2 pt-1 pb-1 border-b border-border/40 bg-muted/30 flex flex-col gap-0.5">
                                      <div className="flex items-center justify-center gap-2 text-[11px] leading-tight">
                                        {presc.dosis && <span className="font-semibold text-foreground">{presc.dosis}</span>}
                                        {presc.rpe && <span className="text-muted-foreground">RPE {presc.rpe}</span>}
                                      </div>
                                      {presc.notas && (
                                        <span className="text-[10px] text-muted-foreground italic text-center truncate" title={presc.notas}>
                                          {presc.notas}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="border-b border-border/40" />
                                  )
                                ) : (
                                  <div className="px-1 pt-1 pb-1 border-b border-border/40 bg-muted/30 flex flex-col gap-1">
                                    <div className="flex gap-1">
                                      <Input
                                        value={presc.dosis}
                                        onChange={(e) => setPrescripcionField(ej.id, semana, "dosis", e.target.value, presc)}
                                        placeholder="Dosis"
                                        className="h-7 text-[11px] text-center px-1 flex-1 min-w-0"
                                      />
                                      <Select
                                        value={presc.rpe || "none"}
                                        onValueChange={(v) => {
                                          const newVal = v === "none" ? "" : v
                                          setPrescripcionField(ej.id, semana, "rpe", newVal, presc)
                                        }}
                                      >
                                        <SelectTrigger className="h-7 w-12 text-[11px] px-1 shrink-0">
                                          <SelectValue placeholder="-" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none"><span className="text-muted-foreground">—</span></SelectItem>
                                          {[6, 7, 8, 9, 10].map((n) => (
                                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Input
                                      value={presc.notas}
                                      onChange={(e) => setPrescripcionField(ej.id, semana, "notas", e.target.value, presc)}
                                      placeholder={`Nota S${semana}`}
                                      className="h-7 text-[11px] px-1 placeholder:text-muted-foreground/40 bg-background/60 border-dashed"
                                    />
                                    {isDirty && (
                                      <Button
                                        size="sm"
                                        onClick={() => savePrescripcion(ej, semana)}
                                        disabled={isSaving}
                                        className="h-7 text-[11px] px-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                                      >
                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                                      </Button>
                                    )}
                                  </div>
                                )

                                // Activador (solo profesor): no se rellena → sin slots de datos
                                if (ejEsActivador) {
                                  return (
                                    <td key={semana} className={`p-0 align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                    </td>
                                  )
                                }

                                if (!registro) {
                                  const savingCell = skipKey === cellKey(dia.id, semana, ej.id)
                                  return (
                                    <td key={semana} className={`p-0 align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                      <div className="px-3 py-3 flex justify-center items-center min-h-[40px]">
                                        {readOnly ? (
                                          <span className="text-muted-foreground/25 text-xs">—</span>
                                        ) : (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSkip(dia, semana, ej.id) }}
                                            disabled={savingCell}
                                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-amber-500 transition-colors disabled:opacity-50"
                                            title="Marcar como saltado"
                                          >
                                            {savingCell
                                              ? <Loader2 className="h-3 w-3 animate-spin" />
                                              : <><SkipForward className="h-3 w-3" /> Saltar</>}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  )
                                }

                                const series: any[] = registro.series ?? []
                                const esSaltado = registroEsSaltado(registro, ej.es_aerobico)

                                if (esSaltado) {
                                  const savingCell = skipKey === cellKey(dia.id, semana, ej.id)
                                  return (
                                    <td key={semana} className={`p-0 align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                      <div className="px-3 py-2 text-center flex flex-col items-center gap-0.5">
                                        <span className="text-[10px] text-amber-400/70 font-medium italic">Saltado</span>
                                        {!readOnly && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleUndoSkip(dia, semana, ej.id, sesion.id) }}
                                            disabled={savingCell}
                                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
                                            title="Deshacer salto"
                                          >
                                            {savingCell
                                              ? <Loader2 className="h-3 w-3 animate-spin" />
                                              : <><Undo2 className="h-3 w-3" /> Deshacer</>}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  )
                                }

                                if (series.length === 0) {
                                  const nota = registro.notas as string | null
                                  return (
                                    <td key={semana} className={`p-0 text-center align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                      <div className="grid grid-cols-3 divide-x h-full min-h-[40px]">
                                        <div className="flex items-center justify-center px-2 font-bold text-sm tabular-nums">
                                          {registro.peso_kg ?? "—"}
                                        </div>
                                        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">
                                          {registro.repeticiones ?? "—"}
                                        </div>
                                        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground/70 tabular-nums">
                                          {registro.rpe ?? "—"}
                                        </div>
                                      </div>
                                      {nota && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setComentarioModal({ ejercicio: ej.ejercicios.nombre, comentario: nota }) }}
                                          className="px-1 pb-1 text-[11px] text-blue-400 hover:text-blue-300 italic flex items-center justify-center gap-0.5 w-full"
                                        >
                                          <StickyNote className="h-2.5 w-2.5" />
                                          Comentario
                                        </button>
                                      )}
                                    </td>
                                  )
                                }

                                const nota = registro.notas as string | null

                                if (ej.es_aerobico) {
                                  const hecho = series[0]?.hecho === true
                                  return (
                                    <td key={semana} className={`p-0 text-center align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                      <div className="flex items-center justify-center py-3">
                                        {hecho ? (
                                          <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-bold">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Hecho
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground/50 text-xs">No hecho</span>
                                        )}
                                      </div>
                                      {nota && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setComentarioModal({ ejercicio: ej.ejercicios.nombre, comentario: nota }) }}
                                          className="px-1 pb-1 text-[11px] text-blue-400 hover:text-blue-300 italic flex items-center justify-center gap-0.5 w-full"
                                        >
                                          <StickyNote className="h-2.5 w-2.5" />
                                          Comentario
                                        </button>
                                      )}
                                    </td>
                                  )
                                }

                                return (
                                  <td key={semana} className={`p-0 text-center align-top ${borderSemana}`}>
                                    {prescripcionStrip}
                                    <div className="divide-y">
                                      {series.map((s: any, si: number) => (
                                        <div key={si} className="flex">
                                          <div className="flex items-center justify-center w-6 text-[11px] text-muted-foreground/50 font-medium border-r">
                                            S{si + 1}
                                          </div>
                                          <div className="grid grid-cols-3 divide-x flex-1">
                                            <div className="flex items-center justify-center px-2 py-1.5 font-bold text-sm tabular-nums">
                                              {s.peso_kg ?? "—"}
                                            </div>
                                            <div className="flex items-center justify-center px-2 py-1.5 text-xs text-muted-foreground tabular-nums">
                                              {s.repeticiones ?? "—"}
                                            </div>
                                            <div className="flex items-center justify-center px-2 py-1.5 text-xs text-muted-foreground/70 tabular-nums">
                                              {s.rpe ?? "—"}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {nota && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setComentarioModal({ ejercicio: ej.ejercicios.nombre, comentario: nota }) }}
                                        className="px-1 py-0.5 text-[11px] text-blue-400 hover:text-blue-300 italic flex items-center justify-center gap-0.5 w-full border-t border-border/30"
                                      >
                                        <StickyNote className="h-3 w-3" />
                                        Comentario
                                      </button>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {comentarioModal && (
          <Dialog open={!!comentarioModal} onOpenChange={() => setComentarioModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-blue-400" />
                  Comentario
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground mb-1">{comentarioModal.ejercicio}</p>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {comentarioModal.comentario}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
