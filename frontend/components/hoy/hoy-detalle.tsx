"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import {
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Clock,
  Loader2,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  MinusCircle,
  StickyNote,
  Save,
  Table2,
  Pencil,
} from "lucide-react"
import {
  EntrenamientoHoy,
  RegistroHoy,
  ESTADO_FLAGS,
  AVATAR_CLS,
  CATEGORIA_ORDER,
  EstadoBadge,
  estadoVista,
  formatHora,
} from "./shared"

interface PlanEjercicioDia {
  id: number
  ejercicio_id: number
  nombre: string
  categoria: string
  orden: number
  series: number
  notas_profesor: string | null
  dosis: string | null
  rpe: number | null
  semana_notas_profesor: string | null
}

interface SerieInput {
  peso_kg: string
  repeticiones: string
  rpe: string
}

interface Fila {
  planEjId: number
  ejercicioId: number
  nombre: string
  // Plan (solo lectura: categoría + prescripción de referencia)
  categoria: string
  seriesCount: number
  dosis: string
  rpe: string
  // Sesión del alumno (editable → PUT portal): kg/reps/rpe performado (los mismos inputs que ve el alumno)
  series: SerieInput[]
  saltado: boolean
  notas: string
  tieneRegistro: boolean
}

const numToStr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n))

const emptySerie = (): SerieInput => ({ peso_kg: "", repeticiones: "", rpe: "" })

function buildFila(pe: PlanEjercicioDia, reg: RegistroHoy | undefined): Fila {
  const seriesCount = Math.max(1, Number(pe.series) || 3)
  const regSeries = reg?.series ?? []
  const saltado = regSeries.length > 0 && regSeries[0]?._saltado === true

  let series: SerieInput[]
  if (saltado) {
    series = Array.from({ length: seriesCount }, emptySerie)
  } else {
    series = Array.from({ length: seriesCount }, (_, i) => {
      const s = regSeries[i]
      return {
        peso_kg: numToStr(s?.peso_kg),
        repeticiones: numToStr(s?.repeticiones),
        rpe: numToStr(s?.rpe),
      }
    })
  }

  return {
    planEjId: pe.id,
    ejercicioId: pe.ejercicio_id,
    nombre: pe.nombre,
    categoria: (pe.categoria ?? "A").toUpperCase(),
    seriesCount,
    dosis: pe.dosis ?? "",
    rpe: pe.rpe != null ? String(pe.rpe) : "",
    series,
    saltado,
    notas: reg?.notas ?? "",
    tieneRegistro: !!reg,
  }
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v))
// Una fila cuenta como completa (para el estado de la sesión) si está saltada o todas sus series
// tienen kg y reps. El RPE (que el profe no edita) se preserva pero no exige para completar.
const filaCompleta = (f: Fila) => f.saltado || f.series.every((s) => !!s.peso_kg && !!s.repeticiones)
const filaDatoReal = (f: Fila) => !f.saltado && f.series.some((s) => Number(s.repeticiones) > 0)

const sesionDirty = (f: Fila, i: Fila) =>
  f.saltado !== i.saltado || (f.notas || "") !== (i.notas || "") || JSON.stringify(f.series) !== JSON.stringify(i.series)

export function HoyDetalle({ entrenamiento, hoy }: { entrenamiento: EntrenamientoHoy; hoy: string }) {
  const qc = useQueryClient()
  const diaId = entrenamiento.sesion?.dia_id ?? null
  const hojaId = entrenamiento.sesion?.hoja_id ?? null
  const semana = entrenamiento.sesion?.semana ?? null
  const planId = entrenamiento.planificacion_id ?? null

  const [modo, setModo] = useState<"ver" | "editar">("ver")
  const [filas, setFilas] = useState<Fila[]>([])
  const initialRef = useRef<Map<number, Fila>>(new Map())
  const builtKeyRef = useRef<number | null>(null)
  const [cleanTick, setCleanTick] = useState(0) // fuerza recomputar `dirty` cuando se resetea el baseline
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const { data: planData, isLoading } = useQuery<{ ejercicios: PlanEjercicioDia[] }>({
    queryKey: ["hoyEjerciciosDia", diaId, semana],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/dias/${diaId}/ejercicios`, {
        params: { semana },
      })
      return res.data
    },
    enabled: diaId != null && semana != null,
    staleTime: 30_000,
  })

  // Semilla de las filas: se arma una sola vez por entreno seleccionado. Los refetch del plan
  // (tras guardar) NO re-arman las filas para no pisar las ediciones ya guardadas del profe.
  const regByPlanEj = useMemo(() => {
    const m = new Map<number, RegistroHoy>()
    for (const r of entrenamiento.registros ?? []) m.set(r.planificacion_ejercicio_id, r)
    return m
  }, [entrenamiento.registros])

  useEffect(() => {
    if (!planData) return
    if (builtKeyRef.current === entrenamiento.asistencia_id) return
    const built = (planData.ejercicios ?? [])
      .filter((pe) => (pe.categoria ?? "").toUpperCase() !== "ACTIVADOR")
      .sort(
        (a, b) =>
          (CATEGORIA_ORDER[(a.categoria ?? "").toUpperCase()] ?? 99) -
            (CATEGORIA_ORDER[(b.categoria ?? "").toUpperCase()] ?? 99) || a.orden - b.orden
      )
      .map((pe) => buildFila(pe, regByPlanEj.get(pe.id)))
    setFilas(built)
    initialRef.current = new Map(built.map((f) => [f.planEjId, JSON.parse(JSON.stringify(f))]))
    builtKeyRef.current = entrenamiento.asistencia_id
    setCleanTick((t) => t + 1)
    setSaveMsg(null)
  }, [planData, entrenamiento.asistencia_id, regByPlanEj])

  const patchFila = (planEjId: number, patch: Partial<Fila>) => {
    setSaveMsg(null)
    setFilas((prev) => prev.map((f) => (f.planEjId === planEjId ? { ...f, ...patch } : f)))
  }

  const patchSerie = (planEjId: number, idx: number, field: keyof SerieInput, value: string) => {
    setSaveMsg(null)
    setFilas((prev) =>
      prev.map((f) => {
        if (f.planEjId !== planEjId) return f
        const series = f.series.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
        return { ...f, series }
      })
    )
  }

  const toggleSkip = (planEjId: number) => {
    setSaveMsg(null)
    setFilas((prev) =>
      prev.map((f) => {
        if (f.planEjId !== planEjId) return f
        const saltado = !f.saltado
        return { ...f, saltado, series: saltado ? Array.from({ length: f.seriesCount }, emptySerie) : f.series }
      })
    )
  }

  const dirty = useMemo(
    () => filas.some((f) => { const i = initialRef.current.get(f.planEjId); return i && sesionDirty(f, i) }),
    [filas, cleanTick]
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (planId == null) return
      // Se editan las series del alumno (kg/reps/rpe performado) — los mismos campos que carga el alumno.
      // El RPE de prescripción del profe NO se toca. Sobrescribe la misma sesión vía portal (LWW client_rev).
      const registros: unknown[] = []
      for (const f of filas) {
        if (f.saltado) {
          registros.push({
            planificacion_ejercicio_id: f.planEjId,
            peso_kg: 0,
            repeticiones: 0,
            rpe: 0,
            notas: null,
            series: Array.from({ length: f.seriesCount }, (_, i) =>
              i === 0 ? { peso_kg: 0, repeticiones: 0, rpe: 0, _saltado: true } : { peso_kg: 0, repeticiones: 0, rpe: 0 }
            ),
          })
          continue
        }
        const cleanSeries = f.series.map((s) => ({
          peso_kg: numOrNull(s.peso_kg),
          repeticiones: numOrNull(s.repeticiones),
          rpe: numOrNull(s.rpe),
        }))
        const hasAny = cleanSeries.some((s) => s.peso_kg != null || s.repeticiones != null || s.rpe != null)
        if (!hasAny && !f.tieneRegistro) continue // nunca tuvo registro y sigue vacío → no crear fila vacía
        registros.push({
          planificacion_ejercicio_id: f.planEjId,
          peso_kg: cleanSeries[0]?.peso_kg ?? null,
          repeticiones: cleanSeries[0]?.repeticiones ?? null,
          rpe: cleanSeries[0]?.rpe ?? null,
          notas: f.notas.trim() || null,
          series: cleanSeries,
        })
      }
      const allCompleted = filas.length > 0 && filas.every(filaCompleta)
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planId}/sesiones`, {
        alumno_id: entrenamiento.alumno.id,
        hoja_id: hojaId,
        dia_id: diaId,
        semana,
        estado: allCompleted ? "completado" : "abierta",
        client_rev: Date.now(),
        registros,
      })
    },
    onSuccess: () => {
      // Marca limpio sin re-armar filas (mantiene lo que ve el profe = lo recién guardado).
      initialRef.current = new Map(filas.map((f) => [f.planEjId, JSON.parse(JSON.stringify(f))]))
      setCleanTick((t) => t + 1)
      setSaveMsg({ ok: true, text: "Guardado" })
      qc.invalidateQueries({ queryKey: ["entrenamientosDia"] })
      qc.invalidateQueries({ queryKey: ["hoyEjerciciosDia", diaId, semana] })
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : "Error al guardar"
      setSaveMsg({ ok: false, text: msg })
    },
  })

  const selectedFlags = ESTADO_FLAGS.filter((f) => entrenamiento.estado_diario?.[f.key])
  const selectedDia = entrenamiento.sesion?.planificacion_dias
  const allCompletedLive = filas.length > 0 && filas.every(filaCompleta)
  const estadoLiveStr = allCompletedLive ? "completado" : entrenamiento.sesion?.estado
  const ev = estadoVista(estadoLiveStr, entrenamiento.fecha, hoy)

  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0 space-y-2">
        <div className="flex items-center gap-3">
          <span className={`h-10 w-10 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${AVATAR_CLS[ev]}`}>
            {entrenamiento.alumno.nombre.trim().charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base truncate text-left">{entrenamiento.alumno.nombre}</DialogTitle>
            <p className="text-xs text-muted-foreground truncate text-left">
              {selectedDia ? `Día ${selectedDia.numero_dia}${selectedDia.nombre ? ` · ${selectedDia.nombre}` : ""}` : "—"}
              {entrenamiento.sesion ? ` · Semana ${entrenamiento.sesion.semana}` : ""}
              {entrenamiento.sesion?.planificacion_hojas?.nombre ? ` · ${entrenamiento.sesion.planificacion_hojas.nombre}` : ""}
            </p>
          </div>
          <EstadoBadge estado={ev} />
        </div>
        {(formatHora(entrenamiento.hora) || selectedFlags.length > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {formatHora(entrenamiento.hora) && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {formatHora(entrenamiento.hora)}
              </span>
            )}
            {selectedFlags.map(({ key, label, icon: Icon, cls }) => (
              <span key={key} className={`inline-flex items-center gap-1 text-xs ${cls}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            ))}
          </div>
        )}
      </DialogHeader>

      {/* Toggle Ver tabla / Editar */}
      <div className="px-5 py-2 border-b shrink-0">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs font-medium">
          <button
            onClick={() => setModo("ver")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${modo === "ver" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Table2 className="h-3.5 w-3.5" /> Ver tabla
          </button>
          <button
            onClick={() => setModo("editar")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${modo === "editar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        </div>
      </div>

      {modo === "ver" ? (
        <TablaView entrenamiento={entrenamiento} plan={planData?.ejercicios ?? []} isLoading={isLoading} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
              </div>
            ) : filas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">El día no tiene ejercicios cargados.</p>
            ) : (
              filas.map((f) => <FilaCard key={f.planEjId} fila={f} onPatch={patchFila} onSerie={patchSerie} onSkip={toggleSkip} />)
            )}
          </div>

          <div className="border-t px-5 py-3 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs">
              {saveMsg ? (
                <span className={saveMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}>{saveMsg.text}</span>
              ) : dirty ? (
                <span className="text-amber-600 dark:text-amber-400">Cambios sin guardar</span>
              ) : (
                <span className="text-muted-foreground">Sin cambios</span>
              )}
            </span>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[var(--primary-color)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </button>
          </div>
        </>
      )}
    </>
  )
}

// Vista de solo lectura: tabla con TODOS los ejercicios del día (incluye los que no hizo).
// Se arma desde la lista planificada (plan) y se superpone lo que cargó el alumno (registros).
function TablaView({ entrenamiento, plan, isLoading }: { entrenamiento: EntrenamientoHoy; plan: PlanEjercicioDia[]; isLoading: boolean }) {
  const selectedDia = entrenamiento.sesion?.planificacion_dias

  const regByPlanEj = new Map<number, RegistroHoy>()
  for (const r of entrenamiento.registros ?? []) regByPlanEj.set(r.planificacion_ejercicio_id, r)

  // Fuente de filas: la planificación del día (si cargó); si no llegó, fallback a los registros.
  const planFiltrado = (plan ?? []).filter((pe) => (pe.categoria ?? "").toUpperCase() !== "ACTIVADOR")
  const rows = planFiltrado.length
    ? planFiltrado
        .sort(
          (a, b) =>
            (CATEGORIA_ORDER[(a.categoria ?? "").toUpperCase()] ?? 99) -
              (CATEGORIA_ORDER[(b.categoria ?? "").toUpperCase()] ?? 99) || a.orden - b.orden
        )
        .map((pe) => {
          const reg = regByPlanEj.get(pe.id)
          const series = reg?.series ?? []
          const saltado = series.length > 0 && (series[0]?._saltado === true || series.every((s) => !s.peso_kg && !s.repeticiones && !s.rpe))
          const conDatos = series.filter((s) => s.peso_kg != null || s.repeticiones != null || s.rpe != null)
          return {
            key: `pe-${pe.id}`,
            nombre: reg?.ejercicio_nombre_snapshot ?? pe.nombre,
            categoria: (pe.categoria ?? "").toUpperCase(),
            dosis: reg?.prescripcion_dosis ?? pe.dosis,
            rpe: reg?.prescripcion_rpe ?? pe.rpe,
            series,
            saltado,
            conDatos,
            notas: reg?.notas ?? null,
          }
        })
    : (entrenamiento.registros ?? [])
        .filter((r) => (r.categoria_snapshot ?? "").toUpperCase() !== "ACTIVADOR")
        .sort(
          (a, b) =>
            (CATEGORIA_ORDER[(a.categoria_snapshot ?? "").toUpperCase()] ?? 99) -
            (CATEGORIA_ORDER[(b.categoria_snapshot ?? "").toUpperCase()] ?? 99)
        )
        .map((reg) => {
          const series = reg.series ?? []
          const saltado = series.length > 0 && (series[0]?._saltado === true || series.every((s) => !s.peso_kg && !s.repeticiones && !s.rpe))
          const conDatos = series.filter((s) => s.peso_kg != null || s.repeticiones != null || s.rpe != null)
          return {
            key: `reg-${reg.id}`,
            nombre: reg.ejercicio_nombre_snapshot ?? "Ejercicio",
            categoria: (reg.categoria_snapshot ?? "").toUpperCase(),
            dosis: reg.prescripcion_dosis,
            rpe: reg.prescripcion_rpe,
            series,
            saltado,
            conDatos,
            notas: reg.notas,
          }
        })

  return (
    <div className="flex-1 overflow-y-auto px-2 sm:px-5 py-4">
      {isLoading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">El día no tiene ejercicios cargados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[100px]">Ejercicio</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-12">Cat.</th>
                <th className="px-0 py-2.5 text-center font-semibold w-[200px]">
                  <div className="mb-1">{selectedDia ? `Día ${selectedDia.numero_dia}` : "Día"}{entrenamiento.sesion ? ` · S${entrenamiento.sesion.semana}` : ""}</div>
                  <div className="flex text-[10px] font-normal text-muted-foreground">
                    <span className="w-6"></span>
                    <span className="flex-1 text-center">kg</span>
                    <span className="flex-1 text-center">reps</span>
                    <span className="flex-1 text-center">rpe</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, idx) => (
                <tr key={row.key} style={CATEGORIA_ROW_STYLE[row.categoria]} className="hover:brightness-95 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground text-xs align-top">{idx + 1}</td>
                  <td className="px-3 py-3 font-medium text-xs align-top max-w-[100px] break-words">{row.nombre}</td>
                  <td className="px-3 py-3 align-top">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[row.categoria] ?? ""}`}>
                      {row.categoria || "—"}
                    </span>
                  </td>
                  <td className="p-0 text-center align-top">
                    {/* Prescripción del profesor */}
                    {(row.dosis || row.rpe != null) ? (
                      <div className="px-2 pt-1 pb-1 border-b border-border/40 bg-muted/30 flex items-center justify-center gap-2 text-[11px] leading-tight">
                        {row.dosis && <span className="font-semibold text-foreground">{row.dosis}</span>}
                        {row.rpe != null && <span className="text-muted-foreground">RPE {row.rpe}</span>}
                      </div>
                    ) : (
                      <div className="border-b border-border/40" />
                    )}
                    {/* Series del alumno */}
                    {row.saltado ? (
                      <div className="px-3 py-2 text-center">
                        <span className="text-[10px] text-amber-500/80 font-medium italic">Saltado</span>
                      </div>
                    ) : row.conDatos.length === 0 ? (
                      <div className="px-3 py-2.5 text-center">
                        <span className="text-[10px] text-red-400/80 font-medium italic uppercase tracking-wide">No hizo</span>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {row.series.map((s, si) => (
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
                    )}
                    {row.notas && (
                      <div className="px-2 py-1 border-t border-border/30 flex items-center justify-center gap-1 text-[11px] text-blue-400 italic">
                        <StickyNote className="h-3 w-3 shrink-0" /> {row.notas}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusPill({ fila }: { fila: Fila }) {
  if (fila.saltado)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
        <SkipForward className="h-3 w-3" /> Saltado
      </span>
    )
  if (filaDatoReal(fila))
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
        <CheckCircle2 className="h-3 w-3" /> Hecho
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
      <MinusCircle className="h-3 w-3" /> No hizo
    </span>
  )
}

function FilaCard({
  fila,
  onPatch,
  onSerie,
  onSkip,
}: {
  fila: Fila
  onPatch: (planEjId: number, patch: Partial<Fila>) => void
  onSerie: (planEjId: number, idx: number, field: keyof SerieInput, value: string) => void
  onSkip: (planEjId: number) => void
}) {
  const tienePrescripcion = !!fila.dosis || !!fila.rpe
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Cabecera: nombre + categoría (solo lectura) + estado */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30">
        <span className="flex-1 min-w-0 font-medium text-sm truncate">{fila.nombre}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${CATEGORIA_COLORS[fila.categoria] ?? ""}`}>{fila.categoria}</span>
        <StatusPill fila={fila} />
      </div>

      {/* Prescripción del profe (solo lectura, referencia) */}
      {tienePrescripcion && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b text-[11px] text-muted-foreground bg-muted/20">
          <span className="shrink-0">Prescripción</span>
          {fila.dosis && <span className="font-semibold text-foreground">{fila.dosis}</span>}
          {fila.rpe && <span>RPE {fila.rpe}</span>}
        </div>
      )}

      {/* Series del alumno (editable: solo kg y reps) o estado saltado */}
      {fila.saltado ? (
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium italic">Ejercicio saltado</span>
          <button
            onClick={() => onSkip(fila.planEjId)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1 transition"
          >
            <RotateCcw className="h-3 w-3" /> Deshacer salto
          </button>
        </div>
      ) : (
        <div className="px-3 py-2.5 space-y-1.5">
          <div className="flex text-[10px] font-medium text-muted-foreground uppercase tracking-wider gap-1.5">
            <span className="w-7" />
            <span className="flex-1 text-center">kg</span>
            <span className="flex-1 text-center">reps</span>
            <span className="flex-1 text-center">rpe</span>
          </div>
          {fila.series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-7 text-[11px] text-muted-foreground/60 font-medium">S{i + 1}</span>
              <Input inputMode="decimal" value={s.peso_kg} onChange={(e) => onSerie(fila.planEjId, i, "peso_kg", e.target.value)} placeholder="—" className="h-9 text-center text-sm flex-1 tabular-nums" />
              <Input inputMode="numeric" value={s.repeticiones} onChange={(e) => onSerie(fila.planEjId, i, "repeticiones", e.target.value)} placeholder="—" className="h-9 text-center text-sm flex-1 tabular-nums" />
              <Input inputMode="decimal" value={s.rpe} onChange={(e) => onSerie(fila.planEjId, i, "rpe", e.target.value)} placeholder="—" className="h-9 text-center text-sm flex-1 tabular-nums" />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <Input
              value={fila.notas}
              onChange={(e) => onPatch(fila.planEjId, { notas: e.target.value })}
              placeholder="Nota del ejercicio…"
              className="h-8 text-xs flex-1 border-dashed"
            />
            <button
              onClick={() => onSkip(fila.planEjId)}
              className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1 transition shrink-0"
            >
              <SkipForward className="h-3 w-3" /> Saltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
