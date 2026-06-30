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
import { TrendingUp, AlertTriangle, StickyNote, Loader2 } from "lucide-react"
import type { Planificacion } from "@/types/planificaciones"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"

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

  const savePrescripcion = async (ejId: number, semana: number) => {
    const key = prescripcionKey(ejId, semana)
    const edit = prescripcionEdits[key]
    if (!edit) return
    setSavingKey(key)
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/ejercicios/${ejId}/semanas/${semana}`,
        { dosis: edit.dosis || null, rpe: edit.rpe ? Number(edit.rpe) : null, notas_profesor: edit.notas || null }
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.planificacionById(planId) })
      setPrescripcionEdits((prev) => {
        const next = { ...prev }
        delete next[key]
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
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cat.</th>
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
                            return (
                              <th key={s} className={`px-0 py-2.5 text-center font-semibold w-[200px] relative ${s > 1 ? "border-l-2 border-border" : ""}`}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <span>S{s}</span>
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
                              <td className="px-4 py-3 font-medium text-xs">{ej.ejercicios.nombre}</td>
                              <td className="px-4 py-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[categoria] ?? ""}`}>
                                  {categoria}
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
                                        onClick={() => savePrescripcion(ej.id, semana)}
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
                                  return (
                                    <td key={semana} className={`p-0 align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                      <div className="px-3 py-3 text-center">
                                        <span className="text-muted-foreground/25 text-xs">—</span>
                                      </div>
                                    </td>
                                  )
                                }

                                const series: any[] = registro.series ?? []

                                // Saltado = marcador explícito _saltado, o sin dato real (reps>0).
                                // NO usar peso==0: ejercicios de peso corporal (dominadas) van sin peso.
                                const esSaltado = series.length > 0
                                  ? (series[0]?._saltado === true || series.every((s: any) => (s.repeticiones ?? 0) === 0))
                                  : (registro.repeticiones ?? 0) === 0

                                if (esSaltado) {
                                  return (
                                    <td key={semana} className={`p-0 align-top ${borderSemana}`}>
                                      {prescripcionStrip}
                                      <div className="px-3 py-2 text-center">
                                        <span className="text-[10px] text-amber-400/70 font-medium italic">Saltado</span>
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
