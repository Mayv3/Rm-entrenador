import {
  CheckCircle2,
  AlertTriangle,
  Moon,
  BatteryWarning,
  Frown,
  Activity,
  Trophy,
} from "lucide-react"

export interface SerieJson {
  peso_kg: number | null
  repeticiones: number | null
  rpe: number | null
  _saltado?: boolean
}

export interface RegistroHoy {
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

export interface EntrenamientoHoy {
  asistencia_id: number
  fecha: string
  hora: string | null
  alumno: { id: number; nombre: string }
  planificacion_id: number | null
  sesion_id: number
  sesion: {
    id: number
    dia_id: number | null
    hoja_id: number | null
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

export function fechaLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return fechaLocalISO(date)
}

export function labelFecha(iso: string, hoy: string): string {
  if (iso === hoy) return "Hoy"
  if (iso === addDays(hoy, -1)) return "Ayer"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

export function formatHora(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

export const ESTADO_FLAGS: { key: keyof NonNullable<EntrenamientoHoy["estado_diario"]>; label: string; icon: typeof Moon; cls: string }[] = [
  { key: "excelente", label: "Excelente", icon: Trophy, cls: "text-green-600 dark:text-green-400" },
  { key: "durmio_mal", label: "Durmió mal", icon: Moon, cls: "text-indigo-500" },
  { key: "fatiga", label: "Fatiga", icon: BatteryWarning, cls: "text-amber-500" },
  { key: "desmotivacion", label: "Desmotivación", icon: Frown, cls: "text-zinc-500" },
  { key: "dolor", label: "Dolor", icon: Activity, cls: "text-red-500" },
]

export type EstadoVista = "completado" | "incompleto" | "en_curso"

// "Incompleto" = el día ya pasó y la sesión no quedó completada (no terminó todos los ejercicios).
// Se deriva en vista (no se guarda): un día abierto hoy es "En curso" y pasa a "Incompleto" recién
// cuando la fecha queda atrás, sin depender de ningún job nocturno.
export function estadoVista(estado: string | null | undefined, fecha: string, hoy: string): EstadoVista {
  if (estado === "completado") return "completado"
  if (fecha < hoy) return "incompleto"
  return "en_curso"
}

export const AVATAR_CLS: Record<EstadoVista, string> = {
  completado: "bg-green-500/15 text-green-600 dark:text-green-400",
  incompleto: "bg-red-500/15 text-red-600 dark:text-red-400",
  en_curso: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

// Orden por categoría A → E (mismo orden en que el alumno ve el día).
export const CATEGORIA_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }

export function EstadoBadge({ estado }: { estado: EstadoVista }) {
  if (estado === "completado") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
        <CheckCircle2 className="h-3 w-3" /> Completado
      </span>
    )
  }
  if (estado === "incompleto") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
        <AlertTriangle className="h-3 w-3" /> Incompleto
      </span>
    )
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
      En curso
    </span>
  )
}
