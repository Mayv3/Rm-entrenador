"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Dumbbell,
  Moon,
  BatteryWarning,
  Frown,
  Activity,
  Trophy,
  StickyNote,
  Clock,
} from "lucide-react"

interface SerieJson {
  peso_kg: number | null
  repeticiones: number | null
  rpe: number | null
  _saltado?: boolean
}

interface RegistroHoy {
  id: number
  sesion_id: number
  planificacion_ejercicio_id: number
  series: SerieJson[] | null
  notas: string | null
  ejercicio_nombre_snapshot: string | null
  categoria_snapshot: string | null
  prescripcion_dosis: string | null
  prescripcion_rpe: number | null
}

interface EntrenamientoHoy {
  asistencia_id: number
  fecha: string
  hora: string | null
  alumno: { id: number; nombre: string }
  sesion_id: number
  sesion: {
    id: number
    semana: number
    estado: string | null
    planificacion_dias: { numero_dia: number; nombre: string | null } | null
    planificacion_hojas: { nombre: string | null } | null
  } | null
  estado_diario: {
    durmio_mal?: boolean
    fatiga?: boolean
    desmotivacion?: boolean
    dolor?: boolean
    excelente?: boolean
  } | null
  registros: RegistroHoy[]
}

function fechaLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return fechaLocalISO(date)
}

function labelFecha(iso: string, hoy: string): string {
  if (iso === hoy) return "Hoy"
  if (iso === addDays(hoy, -1)) return "Ayer"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

function formatHora(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

const ESTADO_FLAGS: { key: keyof NonNullable<EntrenamientoHoy["estado_diario"]>; label: string; icon: typeof Moon; cls: string }[] = [
  { key: "excelente", label: "Excelente", icon: Trophy, cls: "text-green-600 dark:text-green-400" },
  { key: "durmio_mal", label: "Durmió mal", icon: Moon, cls: "text-indigo-500" },
  { key: "fatiga", label: "Fatiga", icon: BatteryWarning, cls: "text-amber-500" },
  { key: "desmotivacion", label: "Desmotivación", icon: Frown, cls: "text-zinc-500" },
  { key: "dolor", label: "Dolor", icon: Activity, cls: "text-red-500" },
]

function EstadoBadge({ completado }: { completado: boolean }) {
  return completado ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
      <CheckCircle2 className="h-3 w-3" /> Completado
    </span>
  ) : (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
      En curso
    </span>
  )
}

export function HoySection() {
  const hoy = fechaLocalISO(new Date())
  const [fecha, setFecha] = useState(hoy)
  const [selected, setSelected] = useState<EntrenamientoHoy | null>(null)

  const { data, isLoading } = useQuery<{ fecha: string; entrenamientos: EntrenamientoHoy[] }>({
    queryKey: ["entrenamientosDia", fecha],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/entrenamientos/dia`, { params: { fecha } })
      return res.data
    },
    refetchInterval: fecha === hoy ? 60_000 : false,
    refetchOnWindowFocus: true,
  })

  const entrenamientos = useMemo(() => data?.entrenamientos ?? [], [data])
  const selectedFlags = ESTADO_FLAGS.filter((f) => selected?.estado_diario?.[f.key])
  const selectedDia = selected?.sesion?.planificacion_dias
  // Activadores (accesorios solo-vista): fuera del detalle, el alumno no los carga.
  // Orden por categoría A → E (mismo orden en que el alumno ve el día).
  const CATEGORIA_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }
  const selectedRegistros = (selected?.registros ?? [])
    .filter((r) => (r.categoria_snapshot ?? "").toUpperCase() !== "ACTIVADOR")
    .sort(
      (a, b) =>
        (CATEGORIA_ORDER[(a.categoria_snapshot ?? "").toUpperCase()] ?? 99) -
        (CATEGORIA_ORDER[(b.categoria_snapshot ?? "").toUpperCase()] ?? 99)
    )

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header con navegación de fecha */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[var(--primary-color)]" />
          <h2 className="text-lg font-semibold capitalize">{labelFecha(fecha, hoy)}</h2>
          <span className="text-xs text-muted-foreground mt-0.5">{fecha.split("-").reverse().join("/")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFecha(addDays(fecha, -1))}
            className="h-8 w-8 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFecha(addDays(fecha, 1))}
            disabled={fecha >= hoy}
            className="h-8 w-8 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {fecha !== hoy && (
            <button
              onClick={() => setFecha(hoy)}
              className="h-8 px-3 rounded-md border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
        </div>
      ) : entrenamientos.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center space-y-2">
          <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {fecha === hoy ? "Todavía no entrenó nadie hoy." : "Nadie entrenó este día."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {entrenamientos.length} {entrenamientos.length === 1 ? "alumno entrenó" : "alumnos entrenaron"}
          </p>
          {entrenamientos.map((ent) => {
            const completado = ent.sesion?.estado === "completado"
            const dia = ent.sesion?.planificacion_dias
            const hora = formatHora(ent.hora)
            const flags = ESTADO_FLAGS.filter((f) => ent.estado_diario?.[f.key])
            const ejerciciosCargados = ent.registros.filter(
              (r) => (r.categoria_snapshot ?? "").toUpperCase() !== "ACTIVADOR"
            ).length
            return (
              <button
                key={ent.asistencia_id}
                onClick={() => setSelected(ent)}
                className="w-full rounded-xl border bg-card text-left hover:bg-muted/40 transition-colors p-4 space-y-3"
              >
                {/* Alumno + día + estado */}
                <span className="flex items-center gap-3">
                  <span className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${completado ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                    {ent.alumno.nombre.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-sm truncate">{ent.alumno.nombre}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      <span className="font-semibold text-foreground/80">
                        {dia ? `Día ${dia.numero_dia}` : "Día —"}
                        {ent.sesion ? ` · Semana ${ent.sesion.semana}` : " · Semana —"}
                      </span>
                      {dia?.nombre ? ` · ${dia.nombre}` : ""}
                    </span>
                  </span>
                  <EstadoBadge completado={completado} />
                </span>

                {/* Datos distribuidos parejo */}
                <span className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock className="h-3.5 w-3.5" /> {hora ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Dumbbell className="h-3.5 w-3.5" /> {ejerciciosCargados} {ejerciciosCargados === 1 ? "ejercicio" : "ejercicios"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {flags.length > 0
                      ? flags.map(({ key, label, icon: Icon, cls }) => (
                          <Icon key={key} className={`h-3.5 w-3.5 ${cls}`} aria-label={label} />
                        ))
                      : <span className="text-muted-foreground/40">—</span>}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal de detalle: qué hizo el alumno */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[85vh]">
          {selected && (
            <>
              <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0 space-y-2">
                <div className="flex items-center gap-3">
                  <span className={`h-10 w-10 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${selected.sesion?.estado === "completado" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                    {selected.alumno.nombre.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base truncate text-left">{selected.alumno.nombre}</DialogTitle>
                    <p className="text-xs text-muted-foreground truncate text-left">
                      {selectedDia ? `Día ${selectedDia.numero_dia}${selectedDia.nombre ? ` · ${selectedDia.nombre}` : ""}` : "—"}
                      {selected.sesion ? ` · Semana ${selected.sesion.semana}` : ""}
                      {selected.sesion?.planificacion_hojas?.nombre ? ` · ${selected.sesion.planificacion_hojas.nombre}` : ""}
                    </p>
                  </div>
                  <EstadoBadge completado={selected.sesion?.estado === "completado"} />
                </div>
                {(formatHora(selected.hora) || selectedFlags.length > 0) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {formatHora(selected.hora) && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {formatHora(selected.hora)}
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

              <div className="flex-1 overflow-y-auto px-2 sm:px-5 py-4">
                {selectedRegistros.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin series cargadas (solo check-in).</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-10">#</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[100px]">Ejercicio</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-12">Cat.</th>
                          <th className="px-0 py-2.5 text-center font-semibold w-[200px]">
                            <div className="mb-1">{selectedDia ? `Día ${selectedDia.numero_dia}` : "Día"}{selected.sesion ? ` · S${selected.sesion.semana}` : ""}</div>
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
                        {selectedRegistros.map((reg, idx) => {
                          const categoria = (reg.categoria_snapshot ?? "").toUpperCase()
                          const series = reg.series ?? []
                          const esSaltado = series.length > 0
                            ? series[0]?._saltado === true || series.every((s) => !s.peso_kg && !s.repeticiones && !s.rpe)
                            : false
                          const conDatos = series.filter((s) => s.peso_kg != null || s.repeticiones != null || s.rpe != null)
                          return (
                            <tr key={reg.id} style={CATEGORIA_ROW_STYLE[categoria]} className="hover:brightness-95 transition-colors">
                              <td className="px-3 py-3 text-muted-foreground text-xs align-top">{idx + 1}</td>
                              <td className="px-3 py-3 font-medium text-xs align-top max-w-[100px] break-words">{reg.ejercicio_nombre_snapshot ?? "Ejercicio"}</td>
                              <td className="px-3 py-3 align-top">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[categoria] ?? ""}`}>
                                  {reg.categoria_snapshot ?? "—"}
                                </span>
                              </td>
                              <td className="p-0 text-center align-top">
                                {/* Prescripción del profesor */}
                                {(reg.prescripcion_dosis || reg.prescripcion_rpe != null) ? (
                                  <div className="px-2 pt-1 pb-1 border-b border-border/40 bg-muted/30 flex items-center justify-center gap-2 text-[11px] leading-tight">
                                    {reg.prescripcion_dosis && <span className="font-semibold text-foreground">{reg.prescripcion_dosis}</span>}
                                    {reg.prescripcion_rpe != null && <span className="text-muted-foreground">RPE {reg.prescripcion_rpe}</span>}
                                  </div>
                                ) : (
                                  <div className="border-b border-border/40" />
                                )}
                                {/* Series del alumno */}
                                {esSaltado ? (
                                  <div className="px-3 py-2 text-center">
                                    <span className="text-[10px] text-amber-400/70 font-medium italic">Saltado</span>
                                  </div>
                                ) : conDatos.length === 0 ? (
                                  <div className="px-3 py-3 text-center">
                                    <span className="text-muted-foreground/25 text-xs">—</span>
                                  </div>
                                ) : (
                                  <div className="divide-y">
                                    {series.map((s, si) => (
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
                                {reg.notas && (
                                  <div className="px-2 py-1 border-t border-border/30 flex items-center justify-center gap-1 text-[11px] text-blue-400 italic">
                                    <StickyNote className="h-3 w-3 shrink-0" /> {reg.notas}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
