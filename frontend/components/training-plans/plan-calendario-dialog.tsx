"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader } from "@/components/ui/loader"
import { Calendar as CalendarIcon, CheckCircle2, AlertTriangle } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { es } from "date-fns/locale"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"

type Asistencia = {
  id: number
  fecha: string
  sesion_id: number | null
  planificacion_id: number | null
  es_de_este_plan: boolean
  sesion: {
    id: number
    dia_id: number
    semana: number
    estado: string
    fecha_entrenamiento: string | null
    hoja_id: number
    planificacion_dias: { numero_dia: number; nombre: string } | null
    planificacion_hojas: { nombre: string } | null
  } | null
  estado_diario: {
    durmio_mal: boolean
    fatiga: boolean
    desmotivacion: boolean
    dolor: boolean
    excelente: boolean
  } | null
  registros: Array<{
    id: number
    ejercicio_nombre_snapshot: string
    categoria_snapshot: string | null
    peso_kg: number | null
    repeticiones: number | null
    rpe: number | null
    series: any[]
    notas: string | null
  }>
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  planId: number
  alumnoNombre?: string | null
  alumnoId: number | null
}

function parseLocalDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function fmtFecha(yyyyMmDd: string) {
  return parseLocalDate(yyyyMmDd).toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  })
}

export function PlanCalendarioDialog({ open, onOpenChange, planId, alumnoNombre, alumnoId }: Props) {
  const [data, setData] = useState<Asistencia[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Date | undefined>(undefined)

  useEffect(() => {
    if (!open || !alumnoId) return
    setLoading(true)
    axios
      .get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${planId}/asistencias`)
      .then((res) => setData(res.data?.asistencias ?? []))
      .catch((e) => { console.error(e); setData([]) })
      .finally(() => setLoading(false))
  }, [open, planId, alumnoId])

  const asistenciaPorFecha = useMemo(() => {
    const m = new Map<string, Asistencia>()
    ;(data ?? []).forEach((a) => m.set(a.fecha, a))
    return m
  }, [data])

  const diasAsistidos = useMemo(
    () => (data ?? []).map((a) => parseLocalDate(a.fecha)),
    [data]
  )

  const selectedKey = selected
    ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`
    : null
  const selectedAsistencia = selectedKey ? asistenciaPorFecha.get(selectedKey) ?? null : null

  if (!alumnoId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Calendario</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground text-center py-8">
            Esta planificación no tiene un alumno asignado.
          </p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] flex flex-col p-0 max-h-none h-auto overflow-visible">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[var(--primary-color)]" />
            Asistencia — {alumnoNombre ?? `Alumno #${alumnoId}`}
            {data && (
              <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {data.length} días
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader /></div>
          ) : (
            <div className="grid md:grid-cols-[360px,1fr] gap-8 items-center">
              <div className="flex justify-center items-center h-full">
                <Calendar
                  mode="single"
                  locale={es}
                  selected={selected}
                  onSelect={setSelected}
                  modifiers={{ asistio: diasAsistidos }}
                  modifiersClassNames={{
                    asistio: "bg-[var(--primary-color)]/20 text-[var(--primary-color)] font-bold rounded-md",
                  }}
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-4",
                    table: "w-full border-collapse",
                    head_row: "flex",
                    head_cell: "text-muted-foreground rounded-md w-11 font-normal text-xs",
                    row: "flex w-full mt-2",
                    cell: "h-11 w-11 text-center text-sm p-0 relative",
                    day: "h-11 w-11 p-0 font-normal hover:bg-accent rounded-md text-sm",
                    day_selected: "bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color)] hover:text-white focus:bg-[var(--primary-color)] focus:text-white rounded-md",
                    day_today: "ring-1 ring-[var(--primary-color)]/40",
                    caption_label: "text-sm font-semibold capitalize",
                  }}
                />
              </div>

              <div className="min-w-0">
                {!selected ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Seleccioná un día para ver el detalle.
                  </p>
                ) : !selectedAsistencia ? (
                  <div className="text-sm text-muted-foreground text-center py-10">
                    Sin asistencia registrada el {fmtFecha(selectedKey!)}.
                  </div>
                ) : (
                  <DetalleAsistencia a={selectedAsistencia} />
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetalleAsistencia({ a }: { a: Asistencia }) {
  const flags: Array<{ key: keyof NonNullable<Asistencia["estado_diario"]>; label: string; className: string }> = [
    { key: "excelente", label: "Excelente", className: "bg-green-500/15 text-green-400" },
    { key: "durmio_mal", label: "Durmió mal", className: "bg-indigo-500/15 text-indigo-400" },
    { key: "fatiga", label: "Fatiga", className: "bg-amber-500/15 text-amber-400" },
    { key: "desmotivacion", label: "Desmotivación", className: "bg-cyan-500/15 text-cyan-400" },
    { key: "dolor", label: "Dolor", className: "bg-rose-500/15 text-rose-400" },
  ]
  const activos = flags.filter((f) => a.estado_diario?.[f.key])

  const maxSeries = Math.max(
    1,
    ...a.registros.map((r) => (Array.isArray(r.series) ? r.series.length : 0))
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold text-base capitalize">{fmtFecha(a.fecha)}</span>
            {!a.es_de_este_plan && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Otro plan
              </span>
            )}
          </div>
          {a.sesion && (
            <p className="text-sm text-muted-foreground mt-1">
              {a.sesion.planificacion_hojas?.nombre ?? ""}
              {a.sesion.planificacion_dias && ` · Día ${a.sesion.planificacion_dias.numero_dia} - ${a.sesion.planificacion_dias.nombre}`}
              {` · Semana ${a.sesion.semana}`}
            </p>
          )}
        </div>

        {activos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end shrink-0 max-w-[50%]">
            {activos.map((f) => (
              <span key={f.key} className={`px-2 py-1 rounded text-xs font-medium ${f.className}`}>
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {a.registros.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-3">
          <AlertTriangle className="h-4 w-4" />
          Marcó salud pero no cargó ejercicios.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-card">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="px-4 py-2.5 text-left font-semibold w-12">#</th>
                <th className="px-4 py-2.5 text-left font-semibold">Ejercicio</th>
                <th className="px-3 py-2.5 text-center font-semibold w-20">Cat.</th>
                {Array.from({ length: maxSeries }).map((_, i) => (
                  <th
                    key={i}
                    colSpan={3}
                    className={`px-2 py-1.5 text-center font-semibold ${i > 0 ? "border-l-2 border-border" : "border-l"}`}
                  >
                    Serie {i + 1}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/30 border-b text-[10px] uppercase tracking-wide text-muted-foreground">
                <th></th>
                <th></th>
                <th></th>
                {Array.from({ length: maxSeries }).map((_, i) => (
                  <Fragment key={i}>
                    <th className={`px-1.5 py-1 text-center font-medium ${i > 0 ? "border-l-2 border-border" : "border-l"}`}>kg</th>
                    <th className="px-1.5 py-1 text-center font-medium">reps</th>
                    <th className="px-1.5 py-1 text-center font-medium">rpe</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {a.registros.map((r, idx) => {
                const cat = r.categoria_snapshot ?? ""
                const rowStyle = CATEGORIA_ROW_STYLE[cat] ?? {}
                const series: any[] = Array.isArray(r.series) && r.series.length > 0
                  ? r.series
                  : [{ peso_kg: r.peso_kg, repeticiones: r.repeticiones, rpe: r.rpe }]
                const esSaltado = series.every((s) => (s.peso_kg ?? 0) === 0)
                return (
                  <tr key={r.id} style={rowStyle} className="hover:brightness-95 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {r.ejercicio_nombre_snapshot}
                      {r.notas && (
                        <p className="text-[11px] text-blue-500 dark:text-blue-300 italic mt-1">"{r.notas}"</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {cat && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[cat] ?? ""}`}>
                          {cat}
                        </span>
                      )}
                    </td>
                    {Array.from({ length: maxSeries }).map((_, i) => {
                      const s = series[i]
                      if (!s) {
                        return (
                          <Fragment key={i}>
                            <td className={`px-1.5 py-3 text-center text-muted-foreground/30 ${i > 0 ? "border-l-2 border-border" : "border-l"}`}>—</td>
                            <td className="px-1.5 py-3 text-center text-muted-foreground/30">—</td>
                            <td className="px-1.5 py-3 text-center text-muted-foreground/30">—</td>
                          </Fragment>
                        )
                      }
                      if (esSaltado) {
                        return (
                          <Fragment key={i}>
                            <td colSpan={3} className={`px-2 py-3 text-center text-amber-500 italic text-xs font-medium ${i > 0 ? "border-l-2 border-border" : "border-l"}`}>
                              Saltado
                            </td>
                          </Fragment>
                        )
                      }
                      return (
                        <Fragment key={i}>
                          <td className={`px-1.5 py-3 text-center font-bold tabular-nums ${i > 0 ? "border-l-2 border-border" : "border-l"}`}>
                            {s.peso_kg ?? "—"}
                          </td>
                          <td className="px-1.5 py-3 text-center tabular-nums">{s.repeticiones ?? "—"}</td>
                          <td className="px-1.5 py-3 text-center tabular-nums text-muted-foreground">{s.rpe ?? "—"}</td>
                        </Fragment>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
