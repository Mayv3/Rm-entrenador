"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Dumbbell,
  Clock,
} from "lucide-react"
import {
  EntrenamientoHoy,
  ESTADO_FLAGS,
  AVATAR_CLS,
  EstadoBadge,
  estadoVista,
  fechaLocalISO,
  addDays,
  labelFecha,
  formatHora,
} from "./shared"
import { HoyDetalle } from "./hoy-detalle"

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
            const ev = estadoVista(ent.sesion?.estado, fecha, hoy)
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
                  <span className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${AVATAR_CLS[ev]}`}>
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
                  <EstadoBadge estado={ev} />
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

      {/* Modal de detalle: qué hizo el alumno + editar planificación / series */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[calc(100dvh-5rem)]">
          {selected && <HoyDetalle entrenamiento={selected} hoy={hoy} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
